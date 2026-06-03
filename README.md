# FB Studio Mobile — Documentación en Español

> **Aplicación de visualización analítica** para la red social facebook.
> La app **no realiza extracción, transformación ni carga de datos** (ETL). Solo consulta y presenta los resultados de una base de datos ya procesada.

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Relación con el Proceso ETL](#2-relación-con-el-proceso-etl)
3. [Arquitectura de la Aplicación](#3-arquitectura-de-la-aplicación)
4. [Módulos y Pantallas](#4-módulos-y-pantallas)
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

- `posts` — 70 000 registros tras la carga ETL (50 000 originales + 20 000 del CSV)
- `users` — 15 500 usuarios
- `interactions` — 50 000 interacciones (likes, comentarios, shares)
- `ad_campaigns` / `ad_metrics` — 50 campañas y sus métricas
- `activity_log` — 20 000 registros de actividad
- `moderation_reports` — 500 reportes de moderación
- `pages` — 100 páginas públicas

Todos los campos normalizados por el ETL (`timestamp` en ISO 8601, `media_type` y `privacy` estandarizados, `reach_count` sin negativos) son consumidos directamente por las queries SQL de la app.

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
| `getTableInfo()`   | Cuenta registros en las 8 tablas principales                      |
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

- Distribución de publicaciones por `media_type` (image, video, reel, text)
- Distribución por `privacy` (public, friends, private)
- Alcance promedio por tipo de medio
- Posts con bajo alcance

**Visualizaciones:** Gráfica de barras (`BarChart`), gráfica de torta (`PieChart`).

**Relación con ETL:** Consume directamente los campos `media_type` y `privacy` normalizados por el ETL (T9 y T10 del script Python).

---

### 4.3 Engagement Screen (`EngagementScreen.tsx`)

**Propósito:** Análisis de interacciones y participación de la audiencia.

**Métricas:**

- Conteo de likes, comentarios y shares
- Tasa de engagement por post (`interactions / reach_count × 100`)
- Posts con cero interacciones (posibles bots o contenido ignorado)
- Evolución temporal del engagement

**Queries principales:**

```sql
SELECT COUNT(*) AS c FROM interactions WHERE type = 'like';
SELECT COUNT(*) AS c FROM interactions WHERE type = 'comment';
SELECT COUNT(*) AS c FROM interactions WHERE type = 'share';
```

**Visualizaciones:** `PieChart` para distribución de tipos, `LineChart` para evolución temporal.

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

Detecta 6 tipos de problemas con severidad clasificada:

| ID          | Problema                                 | Severidad      | Fuente SQL                    |
| ----------- | ---------------------------------------- | -------------- | ----------------------------- |
| `lowReach`  | Posts con alcance < 30% del promedio     | 🔴 Crítico     | tabla `posts`                 |
| `zeroInt`   | Posts sin ninguna interacción            | 🔴 Crítico     | JOIN `posts` + `interactions` |
| `adWaste`   | Campañas con CPM sobre el promedio       | 🟡 Advertencia | tabla `ad_metrics`            |
| `dormant`   | Páginas sin publicaciones recientes      | 🟡 Advertencia | tabla `pages`                 |
| `churn`     | Usuarios inactivos (riesgo de abandono)  | 🟡 Advertencia | `activity_log`                |
| `adFatigue` | Alta frecuencia de exposición al anuncio | 🔵 Monitorear  | `ad_metrics`                  |

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

| Clave              | Descripción                              | Tablas involucradas          |
| ------------------ | ---------------------------------------- | ---------------------------- |
| `topEngaging`      | Top 10 posts por interacciones + tasa ER | `posts`, `interactions`      |
| `mostActive`       | Top 10 usuarios más activos              | `users`, `activity_log`      |
| `privacyBreakdown` | Distribución por privacidad              | `posts`                      |
| `adRoi`            | ROI de campañas (CPM, CTR)               | `ad_campaigns`, `ad_metrics` |
| `recentPosts`      | Últimos 20 posts publicados              | `posts`                      |
| `lowReach`         | Posts con alcance < 30% del promedio     | `posts`                      |
| `highCpm`          | Campañas con mayor CPM                   | `ad_campaigns`, `ad_metrics` |
| `zeroInteractions` | Posts sin interacciones                  | `posts`, `interactions`      |

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
