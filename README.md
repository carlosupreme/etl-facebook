# Documentación

> **Aplicación de visualización analítica** para la red social facebook.
> La app **no realiza extracción, transformación ni carga de datos** (ETL). Solo consulta y presenta los resultados de una base de datos ya procesada.

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Relación con el Proceso ETL](#2-relación-con-el-proceso-etl)
3. [Arquitectura de la Aplicación](#3-arquitectura-de-la-aplicación)
4. [Módulos y Pantallas](#4-módulos-y-pantallas)
   - 4.1 Dashboard Overview · 4.2 Weaknesses Hub · 4.3 KPI Catalog · 4.4 Queries
5. [Componentes Reutilizables](#5-componentes-reutilizables)
6. [Servicios y Lógica de Negocio](#6-servicios-y-lógica-de-negocio)
7. [Navegación](#7-navegación)
8. [Internacionalización (i18n)](#8-internacionalización-i18n)
9. [Stack Tecnológico](#9-stack-tecnológico)
10. [Cómo Ejecutar la App](#10-cómo-ejecutar-la-app)

---

## 1. Descripción General

Aplicación React Native / Expo que actúa como **dashboard analítico móvil** para la base de datos `social_network.db` generada en la práctica ETL.

El flujo de uso es simple:

```
Usuario sube social_network.db → La app la carga en memoria (sql.js / expo-sqlite)
→ Ejecuta queries SQL → Muestra KPIs, gráficas y análisis en pantalla
```

La app **no modifica ni transforma** los datos. Toda la limpieza y normalización fue realizada previamente por el script ETL en Python. Esta herramienta solo consume los resultados.

---

## 2. Relación con el Proceso ETL

La app **consulta directamente las tablas resultantes** del proceso:

| Tabla               | Registros    | Notas                                                             |
| ------------------- | ------------ | ----------------------------------------------------------------- |
| `posts`             | ~570 000     | `media_type` normalizado — 6 tipos: image, video, link, story, reel, text |
| `users`             | 15 500       |                                                                   |
| `interactions`      | ~249 600     | 8 tipos: like, love, comment, share, haha, wow, sad, angry        |
| `followers`         | ~200 000     | Relaciones seguidor→seguido; columnas `follower_id`, `followed_id`|
| `app_permissions`   | ~200 499     | Columnas `permission_id`, `user_id`, `app_id`, `permission_type`  |
| `third_party_apps`  | 20           | Columnas `app_id`, `name`                                         |
| `ad_campaigns`      | 50           |                                                                   |
| `ad_metrics`        | —            |                                                                   |
| `activity_log`      | 20 000       |                                                                   |
| `moderation_reports`| ~500         |                                                                   |
| `pages`             | 100          |                                                                   |

**Notas del ETL relevantes para la app:**

- `privacy = 'only_me'` existe en la BD (≈4.4% de posts) — el ETL **no** lo normalizó a `private`. La app lo muestra tal cual.
- `media_type` normalizado con distribución ponderada sobre 6 tipos: `image`, `video`, `link`, `story`, `reel`, `text`. Los registros que originalmente tenían `'none'` o NULL fueron redistribuidos proporcionalmente mediante `scripts/normalize_media_type.py`.
- Rango de fechas real: **2020–2026** (no 2021–2024 como asumía documentación anterior).
- Todos los campos normalizados por el ETL (`timestamp` en ISO 8601, `reach_count` sin negativos) son consumidos directamente por las queries SQL de la app.

---

## 3. Arquitectura de la Aplicación

```
App.tsx
├── GestureHandlerRootView
├── DbProvider  ←  Contexto global de base de datos
│   ├── DbUploader  (web: carga el archivo .db)
│   ├── NavigationContainer
│   │   └── DrawerNavigator
│   │       ├── TabNavigator  (tabs inferiores)
│   │       │   ├── DashboardOverview
│   │       │   ├── ContentScreen
│   │       │   ├── EngagementScreen
│   │       │   ├── AdvertisingScreen
│   │       │   └── ActivityScreen
│   │       └── Pantallas adicionales (drawer)
│   │           ├── WeaknessesHub
│   │           ├── KpiCatalogScreen
│   │           ├── KpiBuilderScreen
│   │           ├── QueriesScreen
│   │           ├── FollowersScreen
│   │           ├── PermissionsScreen
│   │           └── SettingsScreen
│   └── GlobalLoadingBar
└── StatusBar
```

### Capa de datos (`src/db/`)

`DbContext.tsx` es el núcleo de la aplicación. Expone:

| Función            | Descripción                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `queryAll<T>(sql)` | Ejecuta una query y devuelve todas las filas como objetos tipados |
| `queryOne<T>(sql)` | Devuelve solo la primera fila                                     |
| `getTableInfo()`   | Cuenta registros en las 11 tablas principales                     |
| `uploadDb(file)`   | Carga el archivo `.db` en memoria (solo web)                      |

En **web** usa `sql.js` (SQLite compilado a WebAssembly). En **móvil** usa `expo-sqlite`. Ambos ejecutan el mismo SQL sin diferencias para el resto de la app.

---

## 4. Módulos y Pantallas

### 4.1 Dashboard Overview (`DashboardOverview.tsx`)

**Propósito:** Vista principal con resumen ejecutivo de la plataforma.

**KPIs que muestra:**

- Total de posts, usuarios, interacciones y campañas
- Alcance promedio (`AVG(reach_count)`)
- Tasa de engagement global
- Actividad reciente del log

**Queries principales:**

```sql
SELECT COUNT(*) FROM posts;
SELECT COUNT(*) FROM users;
SELECT AVG(reach_count) FROM posts WHERE reach_count > 0;
SELECT COUNT(*) FROM interactions;
```

---

### 4.2 Weaknesses Hub (`WeaknessesHub.tsx`)

**Propósito:** Panel de alertas y puntos débiles detectados automáticamente.

Detecta 8 tipos de problemas con severidad clasificada:

| ID               | Problema                                   | Severidad      | Fuente SQL                    |
| ---------------- | ------------------------------------------ | -------------- | ----------------------------- |
| `lowReach`       | Posts con alcance < 30% del promedio       | 🔴 Crítico     | tabla `posts`                 |
| `zeroInt`        | Posts sin ninguna interacción              | 🔴 Crítico     | JOIN `posts` + `interactions` |
| `noMediaType`    | Posts sin tipo de medio (post-normalización) | 🔴 Crítico   | tabla `posts`                 |
| `adWaste`        | Campañas con CPM sobre el promedio         | 🟡 Advertencia | tabla `ad_metrics`            |
| `dormant`        | Páginas sin publicaciones recientes        | 🟡 Advertencia | tabla `pages`                 |
| `churn`          | Usuarios inactivos (riesgo de abandono)    | 🟡 Advertencia | `activity_log`                |
| `highModeration` | Alto volumen de reportes de moderación     | 🟡 Advertencia | `moderation_reports`          |
| `adFatigue`      | Alta frecuencia de exposición al anuncio   | 🔵 Monitorear  | `ad_metrics`                  |

Cada tarjeta es expandible y muestra descripción, impacto de negocio y recomendación accionable.

---

### 4.3 KPI Catalog (`KpiCatalogScreen.tsx`)

**Propósito:** Panel central de inteligencia analítica. Evalúa en tiempo real todos los KPIs predefinidos contra la base de datos cargada, muestra su estado de salud con código de color, y permite exportar el snapshot completo.

---

#### Modos de vista

| Modo       | Acceso                          | Descripción                                      |
| ---------- | ------------------------------- | ------------------------------------------------ |
| `catalog`  | Vista por defecto               | Listado completo de KPIs con valores en vivo     |
| `builder`  | Botón "Constructor" en cabecera | Abre `KpiBuilderScreen` embebido dentro del mismo componente |

---

#### Acciones de cabecera

| Botón      | Ícono                    | Función                                                                          |
| ---------- | ------------------------ | -------------------------------------------------------------------------------- |
| Recargar   | `refresh-outline`        | Invalida el caché de todas las queries (`refreshAllQueries()`), relanza consultas SQL y muestra barra de progreso animada (0 → 100%) |
| Constructor| `build-outline`          | Alterna a modo `builder` para crear KPIs personalizados                          |
| Exportar   | `download-outline`       | Descarga un JSON con todos los KPIs, sus valores actuales y estados (web: descarga directa; móvil: Share sheet nativo) |

---

#### Filtro por categoría

Barra horizontal scrollable. Filtra las tarjetas por categoría de KPI:

| ID                  | Etiqueta             | Ícono                       |
| ------------------- | -------------------- | --------------------------- |
| `all`               | Todas                | —                           |
| `paid_media`        | Medios Pagados       | `cash-outline`              |
| `health_retention`  | Salud y Retención    | `heart-outline`             |
| `content_community` | Contenido/Comunidad  | `document-text-outline`     |
| `production`        | Producción           | `create-outline`            |
| `content`           | Contenido            | `folder-outline`            |

---

#### Tarjetas de KPI

Cada tarjeta es expandible y tiene dos estados:

**Colapsada** — muestra:
- Barra lateral de acento con color de estado (verde / amarillo / rojo)
- Tag de categoría + chip de estado (`Saludable` / `Necesita Atención` / `Requiere Acción`)
- Ícono · Nombre · Descripción (2 líneas) · **Valor actual** (grande, color-coded)
- Objetivo en texto pequeño (`goodValue`)

**Expandida** — agrega:
- Objetivo de negocio (`businessGoal`)
- Valor objetivo (`goodValue`) con ícono de check
- Pill de estado actual (con spinner si la query está cargando)
- Fórmula SQL en bloque monospace
- **Gráfica inline contextual** (solo para algunos KPIs):

| KPI              | Gráfica inline                                |
| ---------------- | --------------------------------------------- |
| `totalPosts`     | `BarChart` — posts por año (tendencia anual)  |
| `topMedia`       | `PieChart` — distribución de `media_type`     |
| `privacyLeader`  | `PieChart` — distribución de `privacy`        |
| `cpm`            | `BarChart` — CPM promedio por objetivo de campaña |

---

#### Sistema de estados

Los estados se evalúan con `evalTargetExpression(kpi.targetExpr, { value, pct, trend })` y tienen umbrales de fallback por KPI:

| Estado              | Color  | Condición ejemplo                       |
| ------------------- | ------ | --------------------------------------- |
| `good` — Saludable  | Verde  | ROAS ≥ 2×, CTR ≥ 1.5%, ER ≥ 2%        |
| `ok` — Atención     | Amarillo | CPM entre $8–$12, Churn < 25%        |
| `bad` — Acción      | Rojo   | CPM > $12, Churn ≥ 25%, CPC ≥ $1      |

---

#### KPIs predefinidos (16 total)

| ID               | Nombre                    | Categoría           | Meta              |
| ---------------- | ------------------------- | ------------------- | ----------------- |
| `roas`           | Retorno Publicitario      | paid_media          | ≥ 2×              |
| `ctr`            | Efectividad del Anuncio   | paid_media          | ≥ 1.5%            |
| `cpc`            | Costo por Visita          | paid_media          | < $0.50           |
| `cpm`            | Costo de Visibilidad      | paid_media          | < $8.00           |
| `churnRisk`      | Usuarios que se van       | health_retention    | < 10% del total   |
| `adFatigue`      | Anuncios Agotados         | health_retention    | 0 campañas        |
| `frequency`      | Repetición de Anuncios    | health_retention    | < 4× por persona  |
| `totalFollowers` | Red de Seguidores         | health_retention    | Crecimiento +     |
| `engagementRate` | ¿Tu contenido engancha?   | content_community   | ≥ 2%              |
| `orphanPosts`    | Contenido Sin Tipo        | content_community   | < 28 500          |
| `totalPosts`     | Volumen de Contenido      | production          | Tendencia creciente|
| `postsPerYear`   | Ritmo de Publicación      | production          | ≥ 12/año          |
| `avgReach`       | ¿A cuántos llegás?        | content             | ≥ 5 000 por post  |
| `topMedia`       | Formato Favorito          | content             | Coincidencia uso/rendimiento |
| `privacyLeader`  | Visibilidad del Contenido | content             | Mayoría "public"  |
| `dormantPages`   | Páginas sin Actividad     | content             | 0 páginas         |

---

#### Exportación JSON

El botón de descarga genera un archivo `fb-studio-kpi-catalog-{idioma}.json` con la siguiente estructura por KPI:

```json
{
  "exportedAt": "2026-06-03T...",
  "language": "es",
  "kpis": [
    {
      "id": "roas",
      "icon": "📈",
      "name": "Retorno Publicitario",
      "formula": "Estimated Revenue / Total Spend",
      "target": "> 2.0 (2× return)",
      "currentValue": "3.12x",
      "status": "good"
    }
  ]
}
```

---

### 4.4 Queries Screen (`QueriesScreen.tsx`)

**Propósito:** Explorador SQL interactivo con consultas preconfiguradas.

**Consultas predefinidas disponibles:**

| Clave                  | Descripción                                     | Tablas involucradas                     |
| ---------------------- | ----------------------------------------------- | --------------------------------------- |
| `topEngaging`          | Top 10 posts por interacciones + tasa ER        | `posts`, `interactions`                 |
| `mostActive`           | Top 10 usuarios más activos                     | `users`, `activity_log`                 |
| `privacyBreakdown`     | Distribución por privacidad                     | `posts`                                 |
| `adRoi`                | ROI de campañas (CPM, CTR)                      | `ad_campaigns`, `ad_metrics`            |
| `recentPosts`          | Últimos 20 posts publicados                     | `posts`                                 |
| `lowReach`             | Posts con alcance < 30% del promedio            | `posts`                                 |
| `highCpm`              | Campañas con mayor CPM                          | `ad_campaigns`, `ad_metrics`            |
| `zeroInteractions`     | Posts sin interacciones                         | `posts`, `interactions`                 |
| `topFollowed`          | Top 15 usuarios con más seguidores              | `followers`, `users`                    |
| `mutualFollows`        | Pares de usuarios que se siguen mutuamente      | `followers`, `users`                    |
| `permissionsBreakdown` | Permisos totales por app conectada              | `third_party_apps`, `app_permissions`   |
| `topModerated`         | Posts con más reportes de moderación            | `posts`, `moderation_reports`           |
| `mediaTypeBreakdown`   | Distribución de posts por tipo de medio (%)     | `posts`                                 |
| `yearlyTrend`          | Posts por año y alcance promedio anual          | `posts`                                 |

El usuario también puede escribir SQL libre y ver los resultados en una tabla paginada.

---

## 5. Componentes Reutilizables

Ubicados en `src/components/`:

| Componente         | Descripción                                             |
| ------------------ | ------------------------------------------------------- |
| `ChartContainer`   | Contenedor con título y padding para cualquier gráfica  |
| `DataTable`        | Tabla paginada con soporte para columnas dinámicas      |
| `DateRangeFilter`  | Selector de rango de fechas para filtrar queries        |
| `DbUploader`       | Pantalla de carga del archivo `.db` (solo web)          |
| `GlassCard`        | Tarjeta con efecto glassmorphism y glow opcional        |
| `GlobalLoadingBar` | Barra de progreso global durante queries pesadas        |
| `KpiTile`          | Tarjeta compacta para mostrar un valor KPI con etiqueta |
| `SectionHeader`    | Encabezado de sección con separador visual              |
| `WeaknessBadge`    | Insignia de severidad (critical / warning / monitor)    |

### Gráficas (`src/components/charts/`)

| Componente     | Tipo de gráfica                  |
| -------------- | -------------------------------- |
| `BarChart`     | Barras verticales u horizontales |
| `LineChart`    | Línea temporal                   |
| `PieChart`     | Torta / dona                     |
| `ScatterChart` | Dispersión (X vs Y)              |

Todas las gráficas están implementadas con `react-native-svg` sin dependencias de charting externas.

---

## 6. Servicios y Lógica de Negocio

### `src/db/DbContext.tsx`

Contexto React que gestiona el ciclo de vida de la base de datos:

- Inicialización de `sql.js` (web) o `expo-sqlite` (móvil)
- Carga del archivo `.db` desde el sistema de archivos
- Exposición de `queryAll`, `queryOne` y `getTableInfo` a toda la app

### `src/services/KpiStore.ts`

Gestión del catálogo de KPIs:

- Almacena KPIs predefinidos (`DEFAULT_KPIS`) y personalizados
- Persistencia local (AsyncStorage o similar)
- CRUD de KPIs personalizados

### `src/services/evalExpression.ts`

Evalúa expresiones de meta de KPIs en texto (ej. `"value >= 2"`) contra el valor calculado por SQL, determinando si el KPI cumple o no su objetivo.

### `src/hooks/useDbQuery.ts`

Hook personalizado que:

1. Recibe una clave única y una función async que recibe el objeto `db`
2. Ejecuta la función al montar el componente
3. Maneja estados de `loading`, `data` y `error`
4. Evita re-ejecuciones innecesarias con caché por clave

### `src/theme/tokens.ts`

Sistema de diseño centralizado: colores, tipografía, espaciado y radios de borde.

---

## 7. Navegación

```
DrawerNavigator (menú lateral)
│
├── TabNavigator (barra inferior)
│   ├── 🏠 Dashboard       → DashboardOverview
│   ├── 📝 Contenido       → ContentScreen
│   ├── 💬 Engagement      → EngagementScreen
│   ├── 📢 Publicidad      → AdvertisingScreen
│   └── 📊 Actividad       → ActivityScreen
│
├── ⚠️  Debilidades         → WeaknessesHub
├── 📋 Catálogo KPI         → KpiCatalogScreen
├── 🔧 Constructor KPI      → KpiBuilderScreen
├── 🔍 Consultas SQL        → QueriesScreen
├── 👥 Seguidores           → FollowersScreen
├── 🔐 Permisos             → PermissionsScreen
└── ⚙️  Configuración       → SettingsScreen
```

---

## 8. Internacionalización (i18n)

La app soporta dos idiomas configurados en `src/i18n/`:

| Archivo          | Idioma                |
| ---------------- | --------------------- |
| `src/i18n/es.ts` | Español (por defecto) |
| `src/i18n/en.ts` | Inglés                |

Usa la librería `i18next` con `react-i18next`. Todos los textos visibles al usuario usan el hook `useTranslation()` con claves tipadas.

---

## 9. Stack Tecnológico

| Tecnología           | Versión  | Rol                                 |
| -------------------- | -------- | ----------------------------------- |
| React Native         | 0.81.5   | Framework de UI multiplataforma     |
| Expo                 | ~54.0.35 | Toolchain y APIs nativas            |
| TypeScript           | ~5.9.2   | Tipado estático                     |
| sql.js               | 1.14.1   | SQLite en WebAssembly (web)         |
| expo-sqlite          | ~16.0.10 | SQLite nativo (iOS/Android)         |
| react-navigation     | ^7.x     | Navegación (drawer + tabs)          |
| react-native-svg     | 15.12.1  | Gráficas vectoriales                |
| i18next              | ^26.2.0  | Internacionalización                |
| expo-document-picker | ~14.0.8  | Selección de archivo `.db` en móvil |

---

## 10. Cómo Ejecutar la App

### Requisitos

- Node.js ≥ 18
- Bun o npm
- Expo CLI (`npm install -g expo-cli`)
- Un archivo `social_network.db` procesado por el ETL

### Instalación

```bash
cd fb-studio-mobile
bun install   # o: npm install
```

### Ejecución

```bash
# Web (recomendado para subir el .db desde el navegador)
bun run web   # o: expo start --web

# Android
bun run android

# iOS
bun run ios
```

### Uso

1. Al abrir la versión **web**, aparece la pantalla de carga `DbUploader`.
2. Selecciona el archivo `social_network.db` (resultado del ETL).
3. La app carga la BD en memoria con `sql.js`.
4. Navega por las pantallas para explorar KPIs, gráficas y análisis.

> **Nota:** El archivo `.db` nunca se modifica. La app solo ejecuta queries `SELECT` de lectura.
