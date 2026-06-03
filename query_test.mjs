import initSqlJs from './node_modules/sql.js/dist/sql-wasm.js'
import { readFileSync } from 'fs'

const DB_PATH = './assets/social_network.db'

const SQL = await initSqlJs()
const fileBuffer = readFileSync(DB_PATH)
const db = new SQL.Database(fileBuffer)

function query(sql, label) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📊 ${label}`)
  console.log('─'.repeat(60))
  try {
    const results = db.exec(sql)
    if (!results.length) { console.log('(sin resultados)'); return }
    const { columns, values } = results[0]
    console.log(columns.join(' | '))
    console.log('·'.repeat(60))
    values.slice(0, 20).forEach(row => console.log(row.join(' | ')))
    if (values.length > 20) console.log(`... y ${values.length - 20} filas más`)
  } catch (e) {
    console.log(`❌ Error: ${e.message}`)
  }
}

// 1. Resumen general de tablas
query(`
  SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
`, 'Tablas en la BD')

// 2. Conteo por tabla
const tables = db.exec(`SELECT name FROM sqlite_master WHERE type='table'`)[0]?.values ?? []
console.log(`\n${'─'.repeat(60)}\n📋 Conteo de registros por tabla\n${'─'.repeat(60)}`)
for (const [t] of tables) {
  try {
    const r = db.exec(`SELECT COUNT(*) FROM "${t}"`)[0]?.values[0][0]
    console.log(`  ${t.padEnd(30)} ${String(r).padStart(10)} filas`)
  } catch (_) {}
}

// 3. Top 10 posts por alcance
query(`
  SELECT post_id, author_id, media_type, privacy, reach_count, timestamp
  FROM posts
  ORDER BY reach_count DESC
  LIMIT 10
`, 'Top 10 posts por reach_count')

// 4. Distribución por media_type
query(`
  SELECT media_type,
         COUNT(*) AS total,
         ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts), 2) AS pct
  FROM posts
  WHERE media_type IS NOT NULL
  GROUP BY media_type
  ORDER BY total DESC
`, 'Distribución por media_type')

// 5. Distribución por privacy
query(`
  SELECT privacy,
         COUNT(*) AS total,
         ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts), 2) AS pct
  FROM posts
  WHERE privacy IS NOT NULL
  GROUP BY privacy
  ORDER BY total DESC
`, 'Distribución por privacy')

// 6. Alcance: promedio, máximo, mínimo
query(`
  SELECT
    ROUND(AVG(reach_count), 0) AS avg_reach,
    MAX(reach_count)           AS max_reach,
    MIN(reach_count)           AS min_reach,
    COUNT(*)                   AS posts_con_reach
  FROM posts
  WHERE reach_count IS NOT NULL
`, 'Estadísticas de reach_count')

// 7. Posts por año
query(`
  SELECT
    strftime('%Y', timestamp) AS anio,
    COUNT(*) AS total_posts,
    ROUND(AVG(reach_count), 0) AS avg_reach
  FROM posts
  WHERE timestamp IS NOT NULL
  GROUP BY anio
  ORDER BY anio
`, 'Posts por año')

// 8. Top 10 usuarios más activos
query(`
  SELECT u.user_id,
         u.first_name || ' ' || u.last_name AS nombre,
         COUNT(a.log_id) AS eventos
  FROM users u
  JOIN activity_log a ON u.user_id = a.user_id
  GROUP BY u.user_id
  ORDER BY eventos DESC
  LIMIT 10
`, 'Top 10 usuarios más activos')

// 9. Interacciones por tipo
query(`
  SELECT type, COUNT(*) AS total
  FROM interactions
  GROUP BY type
  ORDER BY total DESC
`, 'Interacciones por tipo')

// 10. Campañas publicitarias - KPIs
query(`
  SELECT
    c.objective,
    COUNT(c.campaign_id) AS campañas,
    ROUND(AVG(m.spend), 2) AS avg_spend,
    ROUND(AVG(m.clicks * 100.0 / NULLIF(m.impressions, 0)), 2) AS avg_ctr,
    ROUND(AVG(m.spend * 1000.0 / NULLIF(m.impressions, 0)), 2) AS avg_cpm
  FROM ad_campaigns c
  JOIN ad_metrics m ON c.campaign_id = m.campaign_id
  GROUP BY c.objective
  ORDER BY avg_spend DESC
`, 'KPIs publicitarios por objetivo')

// 11. Posts sin interacciones (posibles bots o contenido ignorado)
query(`
  SELECT COUNT(*) AS posts_sin_interaccion
  FROM posts p
  LEFT JOIN interactions i ON p.post_id = i.post_id
  WHERE i.interaction_id IS NULL
`, 'Posts sin ninguna interacción')

// 12. Muestra de la estructura de users
query(`
  SELECT * FROM users LIMIT 5
`, 'Muestra de tabla users (5 filas)')

db.close()
console.log(`\n✅ Consultas completadas.\n`)
