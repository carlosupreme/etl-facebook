# Documentación

> **Aplicación de visualización analítica** para la red social facebook.
> La app **no realiza extracción, transformación ni carga de datos** (ETL). Solo consulta y presenta los resultados de una base de datos ya procesada.

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Relación con el Proceso ETL](#2-relación-con-el-proceso-etl)
3. [Arquitectura de la Aplicación](#3-arquitectura-de-la-aplicación)
4. [Módulos y Pantallas](#4-módulos-y-pantallas)
   - 4.1 Dashboard Overview · 4.2 Weaknesses Hub · 4.3 KPI Catalog · 4.4 Consultas
5. [Componentes Reutilizables](#5-componentes-reutilizables)
6. [Servicios y Lógica de Negocio](#6-servicios-y-lógica-de-negocio)
7. [Navegación](#7-navegación)
8. [Stack Tecnológico](#8-stack-tecnológico)
9. [Cómo Ejecutar la App](#9-cómo-ejecutar-la-app)
10. [Capturas de Pantalla](#10-capturas-de-pantalla)

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
| `interactions`      | ~250 000     | 8 tipos: like, love, comment, share, haha, wow, sad, angry        |
| `followers`         | ~200 000     | Relaciones seguidor→seguido; columnas `follower_id`, `followed_id`|
| `app_permissions`   | ~200 499     | Columnas `permission_id`, `user_id`, `app_id`, `permission_type`  |
| `third_party_apps`  | 20           | Columnas `app_id`, `name`                                         |
| `ad_campaigns`      | 50           |                                                                   |
| `ad_metrics`        | 50           |                                                                   |
| `activity_log`      | ~220 000     |                                                                   |
| `moderation_reports`| ~200 500     |                                                                   |
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
│   │   └── TabNavigator  (barra inferior)
│   │       ├── DashboardOverview
│   │       ├── WeaknessesHub
│   │       ├── KpiCatalogScreen
│   │       ├── KpiBuilderScreen
│   │       ├── QueriesScreen
│   │       └── SettingsScreen
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

### 4.4 Consultas (`QueriesScreen.tsx`)

**Propósito:** Interfaz de chat para explorar la base de datos en lenguaje natural. El usuario escribe una pregunta en español, un modelo de lenguaje genera el SQL correspondiente, la app lo ejecuta sobre la BD local y muestra los resultados en pantalla. Todo el procesamiento SQL ocurre localmente — el único dato que sale al exterior es el texto de la pregunta.

#### Flujo de una consulta

```
Usuario escribe pregunta en español
  → Se envía a OpenAI Responses API con el esquema completo de la BD como contexto
  → El modelo devuelve JSON: {"sql": "SELECT ..."} o {"message": "texto"}
  → Si es SQL: se ejecuta con db.queryAll() sobre la BD local
  → Los resultados se muestran en la burbuja de respuesta como tabla scrollable
  → Si hay error de SQL: se muestra el mensaje de error en la burbuja
```

#### Interfaz de chat

| Elemento          | Descripción                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| Burbuja usuario   | Alineada a la derecha, fondo ámbar                                          |
| Burbuja respuesta | Alineada a la izquierda, tarjeta blanca con el SQL generado + tabla de datos|
| Bloque SQL        | Muestra la query generada en monospace con borde cian, para transparencia   |
| Tabla de datos    | Scrollable horizontalmente, primeros 20 resultados                          |
| Sugerencias       | 10 chips predefinidos visibles en el estado vacío, desaparecen al chatear   |

#### Sugerencias predefinidas

Las sugerencias son preguntas en lenguaje natural que cubren los casos de uso más comunes:

- ¿Cuáles son los posts con más interacciones?
- ¿Quiénes son los usuarios más activos?
- Distribución por tipo de media
- ¿Cómo se desempeñan las campañas publicitarias?
- Posts más recientes
- Tendencia de posts por año
- ¿Quiénes tienen más seguidores?
- Posts sin ninguna interacción
- Distribución de privacidad de posts
- Top apps con más permisos concedidos

#### Prompt del sistema

El modelo recibe el esquema completo de las 11 tablas con sus columnas, tipos y valores posibles, más el volumen aproximado de filas por tabla. Se le instruye a responder **siempre** en JSON (`{"sql":...}` o `{"message":...}`), usar `LIMIT 100` máximo y sintaxis SQLite estricta.

#### BYOK — Bring Your Own Key

La app **no almacena ni transmite la API key** a ningún servidor propio. El usuario la ingresa en la pantalla de Ajustes y se guarda únicamente en memoria durante la sesión (`openaiKeyStore`). Al cerrar la app, la key se pierde.

> El modelo utilizado es `gpt-4o-mini` vía la [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses).

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

### `src/services/openaiKeyStore.ts`

Almacén en memoria para la API key de OpenAI:

- `get()` — devuelve la key actual
- `set(key)` — actualiza la key y notifica a los suscriptores
- `subscribe(cb)` — permite que componentes reaccionen al cambio de key sin Context

La key **nunca se persiste** en disco ni AsyncStorage. Existe solo mientras la app está abierta.

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
TabNavigator (barra inferior)
├── 🏠 Dashboard       → DashboardOverview
├── ⚠️  Debilidades    → WeaknessesHub
├── 📋 Catálogo KPI    → KpiCatalogScreen
├── 🔍 Consultas SQL   → QueriesScreen
└── ⚙️  Configuración  → SettingsScreen
```

---

## 8. Stack Tecnológico

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
| OpenAI Responses API | —        | Generación de SQL desde lenguaje natural (BYOK) |

---

## 9. Cómo Ejecutar la App

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
5. Para usar **Consultas**: ve a ⚙️ Ajustes, ingresa tu API key de OpenAI (`sk-...`) y guárdala. Luego abre la pestaña Consultas y escribe en lenguaje natural.

> **Nota:** El archivo `.db` nunca se modifica. La app solo ejecuta queries `SELECT` de lectura. La API key de OpenAI se guarda solo en memoria y se pierde al cerrar la app.

---

## 10. Capturas de Pantalla

### Dashboard Overview

| | | |
|:---:|:---:|:---:|
| ![Dashboard 1](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/dash.png) | ![Dashboard 2](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/dash2.png) | ![Dashboard 3](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/dash3.png) |

### Weaknesses Hub — Debilidades detectadas

| | |
|:---:|:---:|
| ![Debilidades 1](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/deb.png) | ![Debilidades 2](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/deb2.png) |

### KPI Catalog

| | | |
|:---:|:---:|:---:|
| ![KPI 1](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/kpi.png) | ![KPI 2](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/kpi2.png) | ![KPI 3](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/kpi3.png) |

### Consultas en lenguaje natural (IA)

| | | |
|:---:|:---:|:---:|
| ![IA 1](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/ia.png) | ![IA 2](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/ia2.png) | ![IA 3](https://raw.githubusercontent.com/carlosupreme/etl-facebook/refs/heads/main/assets/images/ia3.png) |
