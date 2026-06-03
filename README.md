# Documentación

> **Aplicación de visualización analítica** para la red social facebook.
> La app **no realiza extracción, transformación ni carga de datos** (ETL). Solo consulta y presenta los resultados de una base de datos ya procesada.

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Relación con el Proceso ETL](#2-relación-con-el-proceso-etl)
3. [Arquitectura de la Aplicación](#3-arquitectura-de-la-aplicación)
4. [Módulos y Pantallas](#4-módulos-y-pantallas)
   - 4.1 Dashboard Overview · 4.2 Content · 4.3 Engagement · 4.4 Advertising · 4.5 Activity
   - 4.6 Weaknesses Hub · 4.7 KPI Catalog · 4.8 KPI Builder · 4.9 Queries · 4.10 Settings
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
| `posts`             | ~570 000     | Incluye 39.6% con `media_type='none'` sin normalizar              |
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
- `media_type` real incluye: `none` (39.6%), `image` (29.4%), `video` (13.6%), `link` (7%), `story` (4.4%), `reel` (2.9%), `text` (2.9%). El valor `'none'` no fue depurado por el ETL.
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

### 4.2 Content Screen (`ContentScreen.tsx`)

**Propósito:** Análisis del contenido publicado en la red social.

**Métricas:**

- Conteo de posts con `media_type='none'` o nulo (KPI 4 — alerta de contenido sin tipo)
- Distribución de publicaciones por `media_type` — todos los 7 tipos reales: `none`, `image`, `video`, `link`, `story`, `reel`, `text`
- Alcance promedio por tipo de medio
- Distribución de alcance (histograma)
- Dispersión contenido vs engagement

**Visualizaciones:** `BarChart` para distribución de tipos y alcance, `ScatterChart` para contenido vs engagement.

**Relación con ETL:** Expone el campo `media_type` tal como quedó del ETL, incluyendo el valor `'none'` no depurado.

---

### 4.3 Engagement Screen (`EngagementScreen.tsx`)

**Propósito:** Análisis de interacciones y participación de la audiencia.

**Métricas:**

- Conteo individual de las **8 reacciones**: like (96 872), love (40 237), comment (36 374), share (26 600), haha (20 032), wow (13 962), sad (9 988), angry (5 935)
- Promedio de interacciones por post
- Posts con cero interacciones (posibles bots o contenido ignorado)
- Evolución temporal del engagement

**Queries principales:**

```sql
SELECT COUNT(*) AS c FROM interactions WHERE type = 'like';
SELECT COUNT(*) AS c FROM interactions WHERE type = 'love';
SELECT COUNT(*) AS c FROM interactions WHERE type = 'haha';
-- ... (8 queries en total, una por tipo)
```

**Visualizaciones:** `PieChart` con las 8 reacciones (distribución de tipos + breakdown detallado), `LineChart` para evolución temporal.

---

### 4.4 Advertising Screen (`AdvertisingScreen.tsx`)

**Propósito:** Análisis del rendimiento de campañas publicitarias.

**KPIs calculados con SQL en tiempo real:**

| KPI        | Fórmula SQL                       | Umbral  |
| ---------- | --------------------------------- | ------- |
| CPM        | `AVG(spend × 1000 / impressions)` | < $8.00 |
| CTR        | `AVG(clicks × 100 / impressions)` | ≥ 1.5%  |
| CPC        | `SUM(spend) / SUM(clicks)`        | < $0.50 |
| ROAS       | Revenue estimado / gasto total    | > 2.0×  |
| Frecuencia | `AVG(impressions / avg_reach)`    | —       |

**Visualizaciones:** `ScatterChart` (spend vs impresiones), `BarChart` (presupuesto vs gasto real), `LineChart` (CPM por campaña).

---

### 4.5 Activity Screen (`ActivityScreen.tsx`)

**Propósito:** Monitoreo de la actividad de usuarios en la plataforma.

**Métricas:**

- Top usuarios más activos (por eventos en `activity_log`)
- Distribución de tipos de eventos
- Usuarios con riesgo de churn (inactividad prolongada)

**Query representativa:**

```sql
SELECT u.user_id, u.first_name || ' ' || u.last_name AS name,
       COUNT(a.log_id) AS events
FROM users u JOIN activity_log a ON u.user_id = a.user_id
GROUP BY u.user_id ORDER BY events DESC LIMIT 10;
```

---

### 4.6 Weaknesses Hub (`WeaknessesHub.tsx`)

**Propósito:** Panel de alertas y puntos débiles detectados automáticamente.

Detecta 8 tipos de problemas con severidad clasificada:

| ID               | Problema                                   | Severidad      | Fuente SQL                    |
| ---------------- | ------------------------------------------ | -------------- | ----------------------------- |
| `lowReach`       | Posts con alcance < 30% del promedio       | 🔴 Crítico     | tabla `posts`                 |
| `zeroInt`        | Posts sin ninguna interacción              | 🔴 Crítico     | JOIN `posts` + `interactions` |
| `noMediaType`    | Posts con `media_type='none'` o nulo       | 🔴 Crítico     | tabla `posts`                 |
| `adWaste`        | Campañas con CPM sobre el promedio         | 🟡 Advertencia | tabla `ad_metrics`            |
| `dormant`        | Páginas sin publicaciones recientes        | 🟡 Advertencia | tabla `pages`                 |
| `churn`          | Usuarios inactivos (riesgo de abandono)    | 🟡 Advertencia | `activity_log`                |
| `highModeration` | Alto volumen de reportes de moderación     | 🟡 Advertencia | `moderation_reports`          |
| `adFatigue`      | Alta frecuencia de exposición al anuncio   | 🔵 Monitorear  | `ad_metrics`                  |

Cada tarjeta es expandible y muestra descripción, impacto de negocio y recomendación accionable.

---

### 4.7 KPI Catalog (`KpiCatalogScreen.tsx`)

**Propósito:** Catálogo de KPIs predefinidos organizados por categoría.

**Categorías disponibles:**

- `paid_media` — KPIs de publicidad (ROAS, CTR, CPC, CPM)
- `content_community` — KPIs de contenido y comunidad
- `health_retention` — KPIs de salud y retención de usuarios

Cada KPI muestra: nombre, descripción en español, fórmula, valor objetivo y el resultado calculado en tiempo real desde la BD.

**KPIs predefinidos destacados:**

- Retorno Publicitario (ROAS)
- Efectividad del Anuncio (CTR)
- Costo por Visita (CPC)
- Costo de Visibilidad (CPM)
- Usuarios que se van (Churn Risk)
- Red de Seguidores (`totalFollowers`) — COUNT de tabla `followers`
- Contenido Sin Tipo (`orphanPosts`) — posts con `media_type='none'` o nulo

---

### 4.8 KPI Builder (`KpiBuilderScreen.tsx`)

**Propósito:** Editor visual para crear KPIs personalizados.

El usuario puede:

1. Definir un nombre, ícono y categoría
2. Escribir una query SQL personalizada contra la BD cargada
3. Definir una expresión de meta (ej. `value >= 2`)
4. Guardar el KPI en el catálogo

Esto permite al analista construir indicadores a medida sin modificar el código fuente.

---

### 4.9 Queries Screen (`QueriesScreen.tsx`)

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

### 4.10 Settings Screen (`SettingsScreen.tsx`)

**Propósito:** Configuración general de la aplicación.

Permite cambiar el idioma (español / inglés) y ver información de la base de datos cargada (nombre de tablas y conteo de registros).

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
