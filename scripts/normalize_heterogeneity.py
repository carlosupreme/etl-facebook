#!/usr/bin/env python3
"""
normalize_heterogeneity.py
Redistribuye tipos de interacción y reach_count por media_type
para que los datos reflejen patrones realistas de redes sociales.

Uso:
    python scripts/normalize_heterogeneity.py ruta/social_network.db
"""

import sqlite3
import random
import sys
from pathlib import Path

SEED = 42

# Distribución de interacciones inspirada en datos reales de Facebook
# like domina, angry es raro, love supera a share
INTERACTION_DIST = [
    ('like',    0.385),
    ('love',    0.210),
    ('share',   0.148),
    ('comment', 0.118),
    ('haha',    0.082),
    ('wow',     0.037),
    ('sad',     0.013),
    ('angry',   0.007),
]

# Alcance promedio y desviación estándar por tipo de contenido
# Reels/video tienen mayor alcance orgánico; texto plano el menor
REACH_CONFIG = {
    'reel':  {'mean': 10_200, 'std': 3_800},
    'video': {'mean':  7_800, 'std': 2_900},
    'story': {'mean':  5_400, 'std': 2_000},
    'image': {'mean':  4_100, 'std': 1_600},
    'link':  {'mean':  2_700, 'std': 1_200},
    'text':  {'mean':  1_800, 'std':  850},
    'none':  {'mean':  1_100, 'std':  500},
}


def redistribute_interactions(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()

    cur.execute("SELECT interaction_id FROM interactions ORDER BY interaction_id")
    ids = [row[0] for row in cur.fetchall()]
    total = len(ids)
    print(f"Total interacciones: {total:,}")

    random.shuffle(ids)

    idx = 0
    for i, (type_name, pct) in enumerate(INTERACTION_DIST):
        # Last bucket gets all remaining to avoid rounding gaps
        if i == len(INTERACTION_DIST) - 1:
            batch = ids[idx:]
        else:
            batch = ids[idx: idx + int(total * pct)]
        idx += len(batch)

        if batch:
            cur.executemany(
                "UPDATE interactions SET type = ? WHERE interaction_id = ?",
                [(type_name, iid) for iid in batch],
            )

    conn.commit()

    cur.execute(
        "SELECT type, COUNT(*) AS c FROM interactions GROUP BY type ORDER BY c DESC"
    )
    print("\nDistribución final de interacciones:")
    for row in cur.fetchall():
        bar = "█" * int(row[1] / total * 40)
        print(f"  {row[0]:<10} {row[1]:>8,}  {bar}")


def redistribute_reach(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    print("\nActualizando reach_count por media_type...")

    for media_type, cfg in REACH_CONFIG.items():
        cur.execute(
            "SELECT post_id FROM posts WHERE media_type = ?", (media_type,)
        )
        post_ids = [row[0] for row in cur.fetchall()]

        if not post_ids:
            print(f"  {media_type:<8} — sin posts, se omite")
            continue

        updates = [
            (max(0, int(random.gauss(cfg["mean"], cfg["std"]))), pid)
            for pid in post_ids
        ]
        cur.executemany(
            "UPDATE posts SET reach_count = ? WHERE post_id = ?", updates
        )
        print(f"  {media_type:<8} → objetivo avg {cfg['mean']:,}  ({len(post_ids):,} posts)")

    conn.commit()

    cur.execute(
        """
        SELECT media_type,
               ROUND(AVG(reach_count)) AS avg,
               MIN(reach_count)        AS mn,
               MAX(reach_count)        AS mx,
               COUNT(*)                AS n
        FROM posts
        WHERE reach_count > 0 AND media_type IS NOT NULL
        GROUP BY media_type
        ORDER BY avg DESC
        """
    )
    print("\nAlcance real tras actualización:")
    print(f"  {'tipo':<8}  {'avg':>7}  {'min':>6}  {'max':>7}  {'posts':>7}")
    print("  " + "-" * 42)
    for row in cur.fetchall():
        print(
            f"  {row[0]:<8}  {int(row[1]):>7,}  {row[2]:>6,}  {row[3]:>7,}  {row[4]:>7,}"
        )


def main() -> None:
    if len(sys.argv) < 2:
        print("Uso: python scripts/normalize_heterogeneity.py <ruta/social_network.db>")
        sys.exit(1)

    db_path = Path(sys.argv[1])
    if not db_path.exists():
        print(f"Error: no se encontró '{db_path}'")
        sys.exit(1)

    print(f"Base de datos: {db_path}\n{'─' * 50}")

    random.seed(SEED)

    conn = sqlite3.connect(db_path)
    try:
        redistribute_interactions(conn)
        redistribute_reach(conn)
    finally:
        conn.close()

    print(f"\n{'─' * 50}")
    print("✓ Listo. Vuelve a cargar el archivo .db en la app.")


def copy_to_public(db_path: Path) -> None:
    public_dir = db_path.parent.parent / 'public'
    if not public_dir.exists():
        return
    dest = public_dir / 'social_network.db'
    import shutil
    shutil.copy2(db_path, dest)
    print(f"\n✓ Copiado a {dest} (para web)")


if __name__ == "__main__":
    main()
    from pathlib import Path as _Path
    copy_to_public(_Path(sys.argv[1]))
