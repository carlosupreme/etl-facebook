# CLAUDE.md — FB Studio Manager

## Project Overview

React Native (Expo) Android app for managerial analytics on a simulated Facebook social network dataset. Consumes an SQLite database (70K posts, 15.5K users, 50K interactions) produced by the companion ETL pipeline (`script.py`). Built with Bun, TypeScript, glassmorphism space-theme UI.

**Repo structure:**
```
fb-studio-mobile/
├── App.tsx                          # Root: GestureHandler + SafeArea + NavigationContainer + dark theme
├── babel.config.js                  # babel-preset-expo + react-native-reanimated/plugin
├── app.json                         # Expo config: dark bg, expo-sqlite plugin, android package
├── assets/
│   └── social_network.db            # SQLite DB (copied from ../db/)
└── src/
    ├── db/DatabaseService.ts        # Singleton SQLite wrapper, first-launch asset copy
    ├── theme/tokens.ts              # Design tokens: colors, spacing, radius, typography, shadows
    ├── i18n/                        # i18next + react-i18next (es/en)
    ├── hooks/useDbQuery.ts          # Generic async DB query hook
    ├── components/                  # Reusable UI primitives
    ├── navigation/                  # Drawer + Bottom Tab navigators
    └── screens/                     # 8 screens
```

## Tech Stack

| Layer | Package | Notes |
|-------|---------|-------|
| Framework | `expo` ~56.0.4 | SDK 56, managed workflow |
| Language | `typescript` ~6.0.3 | Strict mode |
| SQLite | `expo-sqlite` | Async API (`getAllAsync`, `getFirstAsync`) |
| Navigation | `@react-navigation/native` 7.x + bottom-tabs + drawer | GestureHandler + Reanimated required |
| Charts | `react-native-svg` 15.x | Custom SVG charts in `src/components/charts/`, cross-platform |
| Blur | `expo-blur` | Glass effect backdrop |
| FS | `expo-file-system` | New API: `File`, `Directory`, `Paths` |
| Icons | `@expo/vector-icons` | Ionicons set |
| i18n | `i18next` + `react-i18next` | Language switching via `i18n.changeLanguage()` |
| Animations | `react-native-reanimated` | Required by drawer |
| Gestures | `react-native-gesture-handler` | Required by drawer |
| Package mgr | `bun` 1.3.11 | `bun install / add / run` |

## Architecture Rules

### Database Initialization Flow
1. `App.tsx` mounts → DrawerNavigator renders → first `useDbQuery` hook fires
2. `initDatabase()` checks if `SQLite/social_network.db` exists in app's document dir
3. If not: copy from bundled asset (`assets/social_network.db`) using `expo-file-system` (`File.copy`)
4. Open with `expo-sqlite`: `SQLite.openDatabaseAsync(filePath)`
5. Singleton `db` in module scope — all subsequent calls use `getDb()`

**DB file copy logic** (`src/db/DatabaseService.ts`):
```ts
const docDir = Paths.document
const sqliteDir = new Directory(docDir.uri, 'SQLite')
const dbFile = new File(sqliteDir, 'social_network.db')
if (!dbFile.exists) {
  // create dir, copy from asset
}
db = await SQLite.openDatabaseAsync(dbFile.uri)
```

### Query Pattern
- All screens use `useDbQuery(key, async (db) => { ... })`
- `key` + `i18n.language` as deps → re-queries on language switch
- Raw SQL via `db.getAllAsync()` / `db.getFirstAsync()` — no ORM
- Queries use string interpolation for values (not positional params) to avoid `expo-sqlite` typing issues

### i18n System
- `i18next` initialized in `src/i18n/index.ts` (imported in `App.tsx` for side effect)
- Two resource files: `es.ts` and `en.ts`
- `es.ts` exports type `Translations` — `en.ts` imports and uses it for type safety
- Language switch: `i18n.changeLanguage('es'|'en')` in SettingsScreen
- All components use `useTranslation()` hook → re-render on language change

### Navigation Tree
```
NavigationContainer (dark theme)
└── Drawer.Navigator
    ├── "MainTabs" → Tab.Navigator
    │   ├── "DashboardTab" → DashboardOverview
    │   ├── "WeaknessesTab" → WeaknessesHub
    │   ├── "QueriesTab" → QueriesScreen
    │   └── "SettingsTab" → SettingsScreen
    ├── "Engagement" → EngagementScreen
    ├── "Content" → ContentScreen
    ├── "Advertising" → AdvertisingScreen
    └── "Activity" → ActivityScreen
```

### Design Tokens (`src/theme/tokens.ts`)
- **colors.space**: dark backgrounds (`#0B0D1A`)
- **colors.glass**: translucent card backgrounds with blur
- **colors.accent**: amber (primary), cyan (info), magenta (critical), green (success)
- **colors.status**: critical (red), warning (amber), monitor (cyan)
- **colors.text**: primary (cream), secondary (60% opacity), tertiary (35%)
- **shadows.glass**: soft amber-tinted shadow
- **shadows.glow**: larger spread for active/alert states

### Component API

**GlassCard** — frosted glass container
```tsx
<GlassCard glow="amber|cyan|magenta|green|none" style={{}}>
  {children}
</GlassCard>
```

**KpiTile** — metric display card
```tsx
<KpiTile label="Users" value={15500} trend={{ value: 2.1, positive: true }} />
```

**WeaknessBadge** — severity pill
```tsx
<WeaknessBadge severity="critical|warning|monitor" label="3 users at churn risk" />
```

**SectionHeader** — section title with optional action link
```tsx
<SectionHeader title="Section" action="See All" onAction={handler} />
```

**ChartContainer** — glass card wrapper for Victory charts
```tsx
<ChartContainer title="Posts Over Time" height={200}>
  <VictoryLine data={...} />
</ChartContainer>
```

**DataTable** — horizontal-scrollable data table
```tsx
<DataTable columns={[{key:'name', label:'Name'}]} data={[{name:'Alice'}]} />
```

## Screen Data Queries

### DashboardOverview (`src/screens/DashboardOverview.tsx`)
| Query | SQL |
|-------|-----|
| User count | `SELECT COUNT(*) FROM users` |
| Post count | `SELECT COUNT(*) FROM posts` |
| Interaction count | `SELECT COUNT(*) FROM interactions` |
| Engagement rate | `SELECT AVG(interactions * 100.0 / reach_count) FROM posts JOIN interactions ...` |
| Posts by month | `SELECT strftime('%Y-%m', timestamp), COUNT(*) FROM posts GROUP BY month LIMIT 24` |
| Media distribution | `SELECT media_type, COUNT(*) FROM posts GROUP BY media_type` |
| Top countries | `SELECT country, COUNT(*) FROM users GROUP BY country ORDER BY count DESC LIMIT 5` |
| Privacy breakdown | `SELECT privacy, COUNT(*) FROM posts GROUP BY privacy` |

### EngagementScreen (`src/screens/EngagementScreen.tsx`)
| Query | SQL |
|-------|-----|
| Likes | `SELECT COUNT(*) FROM interactions WHERE type='like'` |
| Comments | `SELECT COUNT(*) FROM interactions WHERE type='comment'` |
| Shares | `SELECT COUNT(*) FROM interactions WHERE type='share'` |
| Avg per post | `SELECT COUNT(*) / (SELECT COUNT(*) FROM posts) FROM interactions` |
| Zero-interaction | `SELECT COUNT(*) FROM posts LEFT JOIN interactions ON ... WHERE interaction_id IS NULL` |

### ContentScreen (`src/screens/ContentScreen.tsx`)
| Query | SQL |
|-------|-----|
| Avg reach | `SELECT AVG(reach_count) FROM posts` |
| Best media type | `SELECT media_type FROM posts GROUP BY media_type ORDER BY AVG(reach_count) DESC LIMIT 1` |
| Dormant pages | `SELECT COUNT(*) FROM pages WHERE page_id NOT IN (SELECT DISTINCT page_id FROM posts)` |

### AdvertisingScreen (`src/screens/AdvertisingScreen.tsx`)
| Query | SQL |
|-------|-----|
| Campaign count | `SELECT COUNT(*) FROM ad_campaigns` |
| Total spend | `SELECT SUM(spend) FROM ad_metrics` |
| Avg CPM | `SELECT AVG(spend * 1000.0 / impressions)` |
| Avg CTR | `SELECT AVG(clicks * 100.0 / impressions)` |
| High-CPM count | `SELECT COUNT(*) FROM ad_metrics WHERE (spend*1000.0/impressions) > threshold` |

### ActivityScreen (`src/screens/ActivityScreen.tsx`)
| Query | SQL |
|-------|-----|
| Total events | `SELECT COUNT(*) FROM activity_log` |
| Logins | `SELECT COUNT(*) FROM activity_log WHERE action='login'` |
| External clicks | `SELECT COUNT(*) FROM activity_log WHERE action='external_click'` |
| Peak hour | `SELECT strftime('%H', timestamp) AS hour, COUNT(*) FROM activity_log GROUP BY hour ORDER BY COUNT(*) DESC LIMIT 1` |
| Churn risk | `SELECT COUNT(*) FROM users WHERE user_id NOT IN (SELECT DISTINCT user_id FROM activity_log WHERE timestamp >= date('now', '-6 months', '+6 years'))` |

### WeaknessesHub (`src/screens/WeaknessesHub.tsx`)
| Category | SQL |
|----------|-----|
| Low reach | `SELECT COUNT(*) FROM posts WHERE reach_count < PERCENTILE(10)` |
| Dormant pages | Same as ContentScreen |
| Churn risk | Same as ActivityScreen |
| High CPM | `SELECT COUNT(*) FROM ad_metrics WHERE (spend*1000.0/impressions) > 8` |
| Zero interaction | Same as EngagementScreen |

## Common Mistakes & Gotchas

1. **`File.exists` is a property, not a method.** Use `dbFile.exists` not `dbFile.exists()`.
2. **`Directory.create()` can throw if parent doesn't exist.** Pass `{ intermediates: true }`.
3. **`File.copy(destination)` copies `this` → `destination`.** Destination must be `File | Directory`.
4. **expo-sqlite params typing is strict.** Use string interpolation or cast with `as any` for positional params.
5. **Drawer requires both `react-native-gesture-handler` and `react-native-reanimated`.** Ensure both installed and `react-native-reanimated/plugin` is last in `babel.config.js`.
6. **Reanimated plugin must be the last plugin** in babel config.
7. **i18n changeLanguage is async.** `await i18n.changeLanguage('en')` if you need to wait for it.
8. **`Asset.fromModule()` needs `require()` path.** The asset must be bundled in the app.
9. **Victory Native 41.x uses `react-native-svg` 15.x.** Ensure SVG is installed separately.
10. **Chart placeholders are `<Text>` components** — replace with actual Victory components for production.

## Build & Run Commands

```bash
bun install                    # Install all deps
bunx expo start                # Start dev server
bunx expo start --android      # Start + open Android
bunx expo run:android          # Build + install on device
bunx expo export --platform android  # Export for production
bunx tsc --noEmit              # TypeScript check
```

## Database Schema (source: social_network.db)

```sql
users (user_id, username, first_name, last_name, email, birth_date, country, city, registration_date)
pages (page_id, page_name, category, owner_id)
posts (post_id, author_id, page_id, content, timestamp, media_type, privacy, reach_count)
interactions (interaction_id, user_id, post_id, type, content, timestamp)
ad_campaigns (campaign_id, advertiser_id, objective, budget, start_date, end_date)
ad_metrics (ad_id, campaign_id, impressions, clicks, spend)
moderation_reports (report_id, reporter_id, target_post_id, target_comment_id, reason, status, timestamp)
activity_log (log_id, user_id, action, target_url, timestamp)
followers (follower_id, followed_user_id, followed_page_id, follow_date)
third_party_apps (app_id, app_name, developer_name)
app_permissions (permission_id, app_id, user_id, permission_type, granted_at)
```
