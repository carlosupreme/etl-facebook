# FB Studio Manager — User Guide

> Mobile dashboard for analyzing a simulated Facebook social network.
> Built with React Native (Expo) + SQLite. Designed for managers who want
> quick insights, weakness detection, and data exploration on the go.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Navigation Overview](#navigation-overview)
- [Dashboard — Main Panel](#dashboard--main-panel)
- [Engagement Analytics](#engagement-analytics)
- [Content Performance](#content-performance)
- [Advertising ROI](#advertising-roi)
- [User Activity](#user-activity)
- [Weakness Detector](#weakness-detector)
- [Queries — Custom SQL Explorer](#queries--custom-sql-explorer)
- [Settings](#settings)
- [Tips & Tricks](#tips--tricks)
- [Troubleshooting](#troubleshooting)
- [Data Reference](#data-reference)

---

## Getting Started

### Installation

```bash
cd fb-studio-mobile
bun install
bunx expo start
```

Then on your Android device:
1. Install the **Expo Go** app from Google Play
2. Scan the QR code shown in your terminal
3. Wait for the bundle to load

Or connect an Android emulator and press `a` in the terminal.

### First Launch

When the app opens for the first time, it copies the social network database
from the app bundle into the device's storage. This happens once — subsequent
launches are instant. You'll see the main dashboard with live KPIs.

---

## Navigation Overview

The app uses two navigation layers:

| Layer | Purpose |
|-------|---------|
| **Bottom Tabs** | 4 main sections: Dashboard, Weaknesses, Queries, Settings |
| **Drawer Menu** | Swipe from left edge or tap hamburger (≡) for full section list |

**Drawer sections:**
- **Dashboard** → Main dashboard (same as first tab)
- **Engagement** → Likes, comments, shares analysis
- **Content** → Post/media performance
- **Advertising** → Campaign ROI, CPM, CTR
- **Activity** → User behavior & churn risk

All sections are also accessible from the drawer if you need to jump directly.

---

## Dashboard — Main Panel

The first thing you see. Four key metrics at the top:

| Metric | What it tells you |
|--------|-------------------|
| **Users** | Total registered users (15,500) |
| **Posts** | Total content published (70,000) |
| **Interactions** | Total likes + comments + shares (50,000) |
| **Engagement Rate** | Percentage of reach that resulted in interaction (avg ~0.71%) |

The trend arrow next to Engagement Rate shows direction vs previous period.

Below the KPIs, chart areas show:
- **Posts Over Time** — How posting activity has evolved (monthly buckets)
- **Media Distribution** — What types of content are being posted (reel/image/video/text)
- **Privacy Breakdown** — How users configure post visibility
- **Top Countries** — Geographic distribution (all users are from Mexico)

A **Weakness Preview** card at the bottom shows a summary. Tap "See all" to jump
to the full Weakness Detector.

---

## Engagement Analytics

Found in the Drawer → **Engagement**.

Focuses on how users interact with content.

**KPIs:**
- Likes: total count
- Comments: total count
- Shares: total count
- Average interactions per post

**Charts:**
- Interaction type breakdown (pie chart)
- Engagement trend over time

**Weakness flags:**
- Posts with **zero interactions** (content that got no reaction at all)
- **Suspicious posts** — high reach but almost no interaction (possible clickbait or
  miscategorized content)
- **Declining trend** — engagement dropping month-over-month

---

## Content Performance

Found in the Drawer → **Content**.

Analyzes what type of content works best.

**KPIs:**
- Average reach per post (~5,197)
- Best-performing media type
- Total post count

**Charts:**
- Reach by media type (which format drives most views)
- Reach distribution histogram
- Content length vs engagement scatter

**Weakness flags:**
- **Dormant pages** — pages that haven't posted anything
- **Underperforming media types** — formats with significantly lower reach
  than the average

---

## Advertising ROI

Found in the Drawer → **Advertising**.

For analyzing the 50 ad campaigns in the system.

**KPIs:**
- Total campaigns
- Total ad spend
- Average CPM (Cost Per Mille — per 1,000 impressions)
- Average CTR (Click-Through Rate)

**Charts:**
- Spend vs impressions (scatter)
- Budget vs actual spend (comparison bar)
- CPM trend across campaigns

**Weakness flags:**
- **High CPM** — campaigns costing more than the average per 1,000 impressions
- **Overspend** — campaigns that exceeded their budget
- **No clicks** — campaigns with impressions but zero engagement

---

## User Activity

Found in the Drawer → **Activity**.

Shows how users behave on the platform.

**KPIs:**
- Total activity events (20,000)
- Login count
- External click count
- Peak activity hour

**Charts:**
- Activity by hour of day (finds the busiest times)
- Login vs external click trends
- User registration timeline

**Weakness flags:**
- **Churn risk users** — registered users who haven't been active in 6+ months

---

## Weakness Detector

Found in the second tab (warning icon).

Aggregates all auto-detected issues into one place with severity scoring:

| Severity | Color | Meaning |
|----------|-------|---------|
| 🔴 **Critical** | Red | Requires immediate attention |
| 🟠 **Warning** | Amber | Should be addressed soon |
| 🔵 **Monitor** | Cyan | Keep an eye on this |

**7 categories detected automatically:**

1. **Low reach content** — posts in the bottom 10% of reach
2. **Engagement drop** — posts that received zero interactions
3. **Ad waste** — campaigns with CPM above $8.00
4. **Dormant pages** — pages that never posted
5. **Churn risk** — users inactive >6 months
6. **Report spikes** — moderation reports increasing
7. **Content gaps** — underused media types

Each category shows a count badge. Tap any card to drill down into the
relevant section for details.

---

## Queries — Custom SQL Explorer

Found in the third tab (search icon).

Two ways to explore data:

### Predefined Queries (one-tap)
| Button | What it returns |
|--------|----------------|
| Top 10 engaging posts | Posts with highest interaction count |
| Most active users | Users with most activity_log events |
| Posts by privacy type | Count grouped by public/private/friends |
| Campaigns by ROI | Ad campaigns ranked by CPM descending |
| Recent posts | Last 20 posts by timestamp |

### Custom SQL
Want to ask your own questions? Type any SQL query and tap **Run**.

```
Examples to try:

-- Most popular page categories
SELECT category, COUNT(*) FROM pages GROUP BY category;

-- Users with most posts
SELECT author_id, COUNT(*) as post_count
FROM posts GROUP BY author_id ORDER BY post_count DESC LIMIT 10;

-- Engagement by media type
SELECT p.media_type,
       COUNT(i.interaction_id) as total_int,
       ROUND(AVG(p.reach_count), 0) as avg_reach
FROM posts p
LEFT JOIN interactions i ON p.post_id = i.post_id
WHERE p.media_type IS NOT NULL
GROUP BY p.media_type;
```

Results appear in a scrollable table below. Tap **Clear** to reset.

---

## Settings

Found in the fourth tab (gear icon).

### Language
Switch between **Español** and **English** instantly.
The entire UI updates without restarting the app.

### Database Info
View live row counts for every table:
- users, posts, interactions, pages
- ad_campaigns, ad_metrics, moderation_reports, activity_log

### About
Version number and contact info.

---

## Tips & Tricks

1. **Dark mode is always on** — the space-glass theme is designed for dark
   environments. If you prefer light, this app isn't for you.

2. **SQL queries are NOT persisted** — cleared on app restart. Export important
   results manually.

3. **The DB is read-only** — this app only reads data. No accidental edits.

4. **Data freshness** — the database is copied once on first launch. To update
   with new ETL output, reinstall the app or manually replace the file
   at `assets/social_network.db` and re-export.

5. **Charts are placeholders** — the current version shows chart containers
   with descriptive text. Full interactive charts (Victory Native) can be
   added by replacing the `<Text>` placeholders with Victory components.

6. **Swipe from left** — anywhere in the app, swipe from the left edge
   to open the drawer menu.

7. **All data is local** — no internet connection needed after install.
   Works offline.

8. **Performance** — with 70K posts and 50K interactions, queries are
   instant on modern devices thanks to SQLite indexing.

---

## Troubleshooting

| Problem | Likely cause | Solution |
|---------|-------------|----------|
| App shows blank screen | DB copy failed or SQLite error | Restart the app |
| "Database not initialized" | App launched before DB ready | Wait a few seconds, restart |
| Language doesn't switch fully | Query labels cached from old language | Navigate away and back |
| Drawer doesn't open | Gesture conflict with scroll | Swipe from very left edge |
| SQL query errors | Invalid syntax or table name | Check spelling, use `SELECT * FROM users` first |
| App feels slow | Too many queries on one screen | Scroll — lazy loading is built in |
| "Module not found" errors | Missing dependency | Run `bun install` again |

---

## Data Reference

### Source
The database (`social_network.db`) is generated by `script.py` (ETL pipeline)
which cleans `posts_raw.csv` and merges it with existing data. The original
dataset simulates Facebook activity in Mexico with:

| Entity | Count |
|--------|-------|
| Users | 15,500 |
| Posts | 70,000 |
| Interactions | 50,000 |
| Ad Campaigns | 50 |
| Pages | 100 |
| Activity Events | 20,000 |

### Date range
All data spans **2021-01-01** to **2026-12-28** — roughly 6 years of
simulated activity.

### Tables
Core tables used by the app:

| Table | What it stores |
|-------|---------------|
| `users` | User profiles with demographics (country, city, birth date) |
| `posts` | Social media posts with content, media type, privacy, reach |
| `interactions` | Likes, comments, and shares on posts |
| `ad_campaigns` | Advertising campaigns with budget and objectives |
| `ad_metrics` | Campaign performance (impressions, clicks, spend) |
| `activity_log` | User actions (login, external clicks, logout) |
| `pages` | Facebook pages by category (Tech, Sports, Cooking, etc.) |
| `moderation_reports` | Reported content (hate speech, spam) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | May 2026 | Initial release: 8 screens, i18n, SQLite, glassmorphism UI |

---

*FB Studio Manager — Built with React Native, Expo, SQLite & ❤️*
