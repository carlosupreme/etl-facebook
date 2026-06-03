"""
normalize_media_type.py
-----------------------
Updates posts with media_type = 'none' (or NULL) to a random accepted value.

Usage:
    python normalize_media_type.py social_network.db
    python normalize_media_type.py social_network.db --dry-run   # preview only
    python normalize_media_type.py social_network.db --strategy weighted

Strategies:
    weighted  (default) — distributes replacements proportionally to the current
                          distribution of the other 6 types (image > video > link …)
    uniform             — picks each of the 6 types with equal probability
"""

import sqlite3
import random
import sys
import argparse
from collections import Counter

ACCEPTED_TYPES = ['image', 'video', 'link', 'story', 'reel', 'text']


def get_current_distribution(conn: sqlite3.Connection) -> dict[str, int]:
    cur = conn.execute(
        "SELECT media_type, COUNT(*) AS c FROM posts "
        "WHERE media_type IS NOT NULL AND media_type != 'none' "
        "GROUP BY media_type"
    )
    return {row[0]: row[1] for row in cur.fetchall()}


def build_weighted_pool(dist: dict[str, int], pool_size: int = 10_000) -> list[str]:
    total = sum(dist.values())
    if total == 0:
        return ACCEPTED_TYPES * (pool_size // len(ACCEPTED_TYPES))
    pool = []
    for t in ACCEPTED_TYPES:
        count = dist.get(t, 0)
        weight = round((count / total) * pool_size)
        pool.extend([t] * weight)
    # Fill any rounding gap
    while len(pool) < pool_size:
        pool.append(random.choice(ACCEPTED_TYPES))
    return pool


def normalize(db_path: str, strategy: str, dry_run: bool, seed: int | None) -> None:
    if seed is not None:
        random.seed(seed)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Count affected rows
    total = conn.execute(
        "SELECT COUNT(*) FROM posts WHERE media_type = 'none' OR media_type IS NULL"
    ).fetchone()[0]

    if total == 0:
        print("✅  No rows with media_type='none' or NULL found. Nothing to do.")
        conn.close()
        return

    print(f"Found {total:,} rows to normalize (media_type='none' or NULL)")

    dist = get_current_distribution(conn)
    print("\nCurrent distribution (excluding 'none'/NULL):")
    for t, c in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"  {t:<10} {c:>8,}")

    if strategy == 'weighted':
        pool = build_weighted_pool(dist)
        replacements = [random.choice(pool) for _ in range(total)]
    else:
        replacements = [random.choice(ACCEPTED_TYPES) for _ in range(total)]

    print(f"\nReplacement preview ({strategy} strategy):")
    preview = Counter(replacements)
    for t in ACCEPTED_TYPES:
        print(f"  {t:<10} {preview.get(t, 0):>8,}")

    if dry_run:
        print("\n⚠️  DRY RUN — no changes written to database.")
        conn.close()
        return

    # Fetch post_ids of affected rows
    rows = conn.execute(
        "SELECT post_id FROM posts WHERE media_type = 'none' OR media_type IS NULL "
        "ORDER BY post_id"
    ).fetchall()

    print(f"\nUpdating {len(rows):,} rows…")
    updated = 0
    conn.execute("BEGIN TRANSACTION")
    try:
        for row, new_type in zip(rows, replacements):
            conn.execute(
                "UPDATE posts SET media_type = ? WHERE post_id = ?",
                (new_type, row[0])
            )
            updated += 1
            if updated % 50_000 == 0:
                print(f"  … {updated:,} / {total:,}")
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"\n❌  Error during update, rolled back: {e}")
        conn.close()
        sys.exit(1)

    # Verify
    remaining = conn.execute(
        "SELECT COUNT(*) FROM posts WHERE media_type = 'none' OR media_type IS NULL"
    ).fetchone()[0]

    conn.close()
    print(f"\n✅  Done. Updated {updated:,} rows. Remaining 'none'/NULL: {remaining}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Normalize media_type='none' in posts table")
    parser.add_argument('db', help='Path to social_network.db')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--strategy', choices=['weighted', 'uniform'], default='weighted',
                        help='weighted=match existing distribution, uniform=equal chance (default: weighted)')
    parser.add_argument('--seed', type=int, default=None,
                        help='Random seed for reproducibility')
    args = parser.parse_args()

    normalize(args.db, args.strategy, args.dry_run, args.seed)
