# Tareas Pendientes — FB Studio Mobile

Contexto: actualización para soportar 570,000 registros y tablas nuevas (`followers`, `app_permissions`, `third_party_apps`).

## Ya completado
- `src/i18n/es.ts` — claves nuevas: `nav.followers`, `nav.permissions`, `followers.*`, `permissions.*`, `engagement.love/haha/wow/sad/angry`, `weaknesses.items.noMediaType`, `weaknesses.items.highModeration`, `queries.presets.topFollowed/mutualFollows/permissionsBreakdown/topModerated/mediaTypeBreakdown/yearlyTrend`, `queries.labels` ampliado, `overview.followers`, `kpi_catalog.kpis.totalFollowers/orphanPosts`
- `src/i18n/en.ts` — traducción inglesa de todo lo anterior
- `src/screens/FollowersScreen.tsx` — pantalla nueva con 4 KPIs + 3 gráficas (top seguidos, distribución seguidores, top siguiendo)

---

## 1. Crear `src/screens/PermissionsScreen.tsx`

Pantalla nueva para analizar `app_permissions` (200,499 filas) y `third_party_apps` (20 filas).

**KPIs a mostrar:**
```sql
-- Total permisos
SELECT COUNT(*) AS c FROM app_permissions

-- Apps registradas
SELECT COUNT(*) AS c FROM third_party_apps

-- Usuarios con al menos una app
SELECT COUNT(DISTINCT user_id) AS c FROM app_permissions

-- Promedio de permisos por usuario
SELECT ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT user_id), 1) AS avg FROM app_permissions
```

**Gráficas:**
```sql
-- Apps con más permisos (BarChart)
SELECT ta.name AS app_name, COUNT(ap.permission_id) AS total_permisos
FROM third_party_apps ta
JOIN app_permissions ap ON ta.app_id = ap.app_id
GROUP BY ta.app_id ORDER BY total_permisos DESC LIMIT 10

-- Tipos de permiso (BarChart o PieChart)
SELECT permission_type, COUNT(*) AS count
FROM app_permissions
GROUP BY permission_type ORDER BY count DESC

-- Usuarios con más apps conectadas (GlassCard lista)
SELECT u.first_name || ' ' || u.last_name AS nombre,
       COUNT(DISTINCT ap.app_id) AS apps
FROM app_permissions ap JOIN users u ON ap.user_id = u.user_id
GROUP BY ap.user_id ORDER BY apps DESC LIMIT 10
```

**Imports necesarios:** mismos que `FollowersScreen.tsx` (KpiTile, ChartContainer, SectionHeader, GlassCard, BarChart, PieChart, useDbQuery).

**Claves i18n disponibles:** `t('permissions.title')`, `t('permissions.subtitle')`, `t('permissions.totalPermissions')`, `t('permissions.appsConnected')`, `t('permissions.usersWithApps')`, `t('permissions.topAppsTitle')`, `t('permissions.permissionTypes')`, `t('permissions.highRiskUsers')`, `t('permissions.avgPerUser')`.

---

## 2. Editar `src/navigation/DrawerNavigator.tsx`

Agregar imports y dos pantallas nuevas al Drawer.

```tsx
// Agregar imports al inicio:
import FollowersScreen from '../screens/FollowersScreen'
import PermissionsScreen from '../screens/PermissionsScreen'

// Agregar dentro de <Drawer.Navigator> después de la pantalla "Activity":
<Drawer.Screen
  name="Followers"
  component={FollowersScreen}
  options={{
    title: t('nav.followers'),
    drawerIcon: ({ color }) => <Ionicons name="people-outline" size={20} color={color} />,
  }}
/>
<Drawer.Screen
  name="Permissions"
  component={PermissionsScreen}
  options={{
    title: t('nav.permissions'),
    drawerIcon: ({ color }) => <Ionicons name="shield-checkmark-outline" size={20} color={color} />,
  }}
/>
```

---

## 3. Editar `src/db/DbContext.tsx` — línea 46

Agregar tablas nuevas al array de `getTableInfo`:

```ts
// Cambiar esta línea:
const tables = ['users', 'posts', 'interactions', 'pages', 'ad_campaigns', 'ad_metrics', 'moderation_reports', 'activity_log']

// Por esta:
const tables = ['users', 'posts', 'interactions', 'pages', 'ad_campaigns', 'ad_metrics', 'moderation_reports', 'activity_log', 'followers', 'third_party_apps', 'app_permissions']
```

---

## 4. Editar `src/screens/EngagementScreen.tsx`

**Objetivo:** agregar las 5 reacciones nuevas (love, haha, wow, sad, angry) al análisis.

Reemplazar el bloque `useDbQuery('engKpis', ...)` actual por uno que incluya todas las reacciones:

```ts
const { data: kpis } = useDbQuery('engKpis', async (db) => {
  const likes    = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='like'")
  const love     = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='love'")
  const comments = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='comment'")
  const shares   = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='share'")
  const haha     = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='haha'")
  const wow      = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='wow'")
  const sad      = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='sad'")
  const angry    = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM interactions WHERE type='angry'")
  const avg = await db.queryOne<{ avg: number }>(
    'SELECT ROUND(CAST(COUNT(*) AS REAL) / (SELECT COUNT(*) FROM posts), 2) AS avg FROM interactions'
  )
  return [
    { label: t('engagement.likes'),   value: likes?.c    ?? 0 },
    { label: t('engagement.love'),    value: love?.c     ?? 0 },
    { label: t('engagement.comments'),value: comments?.c ?? 0 },
    { label: t('engagement.shares'),  value: shares?.c   ?? 0 },
    { label: t('engagement.haha'),    value: haha?.c     ?? 0 },
    { label: t('engagement.wow'),     value: wow?.c      ?? 0 },
    { label: t('engagement.sad'),     value: sad?.c      ?? 0 },
    { label: t('engagement.angry'),   value: angry?.c    ?? 0 },
    { label: t('engagement.avgPerPost'), value: avg?.avg ?? 0 },
  ]
})
```

Agregar también un `useDbQuery('allReactions', ...)` para alimentar un `PieChart` con las 8 reacciones usando `t('engagement.reactionsBreakdown')` como título.

Valores reales de la BD:
- like: 96,872 | love: 40,237 | comment: 36,374 | share: 26,600 | haha: 20,032 | wow: 13,962 | sad: 9,988 | angry: 5,935

---

## 5. Editar `src/screens/ContentScreen.tsx`

**Objetivo:** manejar correctamente los 7 tipos de medio reales: `none`, `image`, `video`, `link`, `story`, `reel`, `text`.

El cuarto KpiTile actualmente muestra `'—'`. Cambiar a conteo de posts con `media_type='none'`:

```ts
const noneCount = await db.queryOne<{ c: number }>(
  "SELECT COUNT(*) AS c FROM posts WHERE media_type = 'none' OR media_type IS NULL"
)
// Agregar al array de kpis:
{ label: t('content.noneTypeAlert'), value: noneCount?.c ?? 0 }
```

Agregar debajo de `reachByType` un nuevo `useDbQuery('mediaTypeCount', ...)`:

```sql
SELECT media_type, COUNT(*) AS total,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts), 1) AS pct
FROM posts
WHERE media_type IS NOT NULL
GROUP BY media_type ORDER BY total DESC
```

Renderizar con `BarChart` bajo el título `t('content.mediaTypeCount')`.

---

## 6. Editar `src/screens/WeaknessesHub.tsx`

**Objetivo:** agregar 2 nuevas debilidades: `noMediaType` y `highModeration`.

Agregar dos nuevos `useDbQuery` antes del array `items`:

```ts
const { data: noMediaType } = useDbQuery('noMediaType', async (db) => {
  const r = await db.queryOne<{ c: number }>(
    "SELECT COUNT(*) AS c FROM posts WHERE media_type = 'none' OR media_type IS NULL"
  )
  return r?.c ?? 0
})

const { data: highMod } = useDbQuery('highMod', async (db) => {
  const r = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM moderation_reports')
  return r?.c ?? 0
})
```

Agregar al array `items`:

```ts
{
  id: 'noMediaType', labelKey: 'noMediaType', severity: 'critical', count: noMediaType ?? 0,
  icon: '📭',
  description: t('weaknesses.items.noMediaType.description'),
  impact: t('weaknesses.items.noMediaType.impact'),
  recommendation: t('weaknesses.items.noMediaType.recommendation'),
},
{
  id: 'highModeration', labelKey: 'highModeration', severity: 'warning', count: highMod ?? 0,
  icon: '🚨',
  description: t('weaknesses.items.highModeration.description'),
  impact: t('weaknesses.items.highModeration.impact'),
  recommendation: t('weaknesses.items.highModeration.recommendation'),
},
```

---

## 7. Editar `src/screens/QueriesScreen.tsx`

Agregar 6 presets nuevos al array `PRESETS` (antes del cierre del array):

```ts
{
  key: 'topFollowed',
  icon: '👑',
  sql: `SELECT f.followed_id, u.first_name || ' ' || u.last_name AS nombre, COUNT(*) AS seguidores
        FROM followers f JOIN users u ON f.followed_id = u.user_id
        GROUP BY f.followed_id ORDER BY seguidores DESC LIMIT 15`,
},
{
  key: 'mutualFollows',
  icon: '🤝',
  sql: `SELECT f1.follower_id, u1.first_name || ' ' || u1.last_name AS usuario_a,
               f1.followed_id, u2.first_name || ' ' || u2.last_name AS usuario_b
        FROM followers f1
        JOIN followers f2 ON f1.follower_id = f2.followed_id AND f1.followed_id = f2.follower_id
        JOIN users u1 ON f1.follower_id = u1.user_id
        JOIN users u2 ON f1.followed_id = u2.user_id
        WHERE f1.follower_id < f1.followed_id
        LIMIT 20`,
},
{
  key: 'permissionsBreakdown',
  icon: '🔐',
  sql: `SELECT ta.name AS app_name, COUNT(ap.permission_id) AS total_permisos
        FROM third_party_apps ta JOIN app_permissions ap ON ta.app_id = ap.app_id
        GROUP BY ta.app_id ORDER BY total_permisos DESC`,
},
{
  key: 'topModerated',
  icon: '⚠️',
  sql: `SELECT p.post_id, p.author_id, p.media_type, p.reach_count,
               COUNT(mr.report_id) AS total_reports
        FROM posts p JOIN moderation_reports mr ON p.post_id = mr.post_id
        GROUP BY p.post_id ORDER BY total_reports DESC LIMIT 20`,
},
{
  key: 'mediaTypeBreakdown',
  icon: '🎨',
  sql: `SELECT COALESCE(media_type, 'null') AS media_type,
               COUNT(*) AS total,
               ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts), 2) AS pct
        FROM posts GROUP BY media_type ORDER BY total DESC`,
},
{
  key: 'yearlyTrend',
  icon: '📅',
  sql: `SELECT strftime('%Y', timestamp) AS anio,
               COUNT(*) AS total_posts,
               ROUND(AVG(reach_count), 0) AS avg_reach
        FROM posts WHERE timestamp IS NOT NULL
        GROUP BY anio ORDER BY anio`,
},
```

---

## 8. Editar `src/services/KpiStore.ts`

Agregar al array `DEFAULT_KPIS` dos KPIs nuevos (después del último elemento existente):

```ts
{
  id: 'totalFollowers', name: 'Red de Seguidores', nameKey: 'kpi_catalog.kpis.totalFollowers.name',
  description: 'Total de relaciones seguidor→seguido.',
  descKey: 'kpi_catalog.kpis.totalFollowers.description',
  goalKey: 'kpi_catalog.kpis.totalFollowers.businessGoal', icon: '👥',
  formula: 'COUNT(*) FROM followers', goodValue: 'Crecimiento positivo mes a mes',
  query: 'SELECT COUNT(*) AS avg FROM followers',
  categoryId: 'health_retention', targetExpr: 'value > 0',
  createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
},
{
  id: 'orphanPosts', name: 'Contenido Sin Tipo', nameKey: 'kpi_catalog.kpis.orphanPosts.name',
  description: 'Posts con media_type=none.',
  descKey: 'kpi_catalog.kpis.orphanPosts.description',
  goalKey: 'kpi_catalog.kpis.orphanPosts.businessGoal', icon: '📭',
  formula: 'COUNT(*) WHERE media_type IS NULL OR none', goodValue: '< 5% del total',
  query: "SELECT COUNT(*) AS avg FROM posts WHERE media_type = 'none' OR media_type IS NULL",
  categoryId: 'content_community', targetExpr: 'value < 28500',
  createdAt: Date.now(), updatedAt: Date.now(), isCustom: false,
},
```

---

## 9. Actualizar `README.es.md`

Agregar secciones para:
- `FollowersScreen` (módulo 4.11)
- `PermissionsScreen` (módulo 4.12)
- Actualizar tabla de conteo de registros (570k posts, 200k followers, etc.)
- Actualizar tabla de tablas nuevas detectadas
- Actualizar resumen ETL con nota sobre `only_me` sin normalizar y `media_type=none`

---

## Notas importantes

- **Columnas confirmadas en `followers`:** `follower_id`, `followed_id` (inferidas del nombre de la tabla — verificar con `PRAGMA table_info(followers)` si hay errores)
- **Columnas en `app_permissions`:** `permission_id`, `user_id`, `app_id`, `permission_type` (inferidas — verificar)
- **Columnas en `third_party_apps`:** `app_id`, `name` (inferidas — verificar)
- **Rango de fechas real:** 2020–2026 (no 2021–2024 como asumía la documentación original)
- **`privacy = 'only_me'`** existe en la BD (4.39% de posts) — el ETL no lo normalizó a `private`
- **`media_type` real incluye:** `none` (39.6%), `image` (29.4%), `video` (13.6%), `link` (7%), `story` (4.4%), `reel` (2.9%), `text` (2.9%)
