import { useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { colors, spacing, typography, radius } from '../theme/tokens'
import { GlassCard } from '../components/GlassCard'
import { KpiTile } from '../components/KpiTile'
import { SectionHeader } from '../components/SectionHeader'
import { ChartContainer } from '../components/ChartContainer'
import { LineChart, BarChart } from '../components/charts'
import { DateRangeFilter, type DateRange } from '../components/DateRangeFilter'
import { useDbQuery } from '../hooks/useDbQuery'

function inferGranularity(label: string): 'day' | 'week' | 'month' {
  if (label === 'Últimos 7 días' || label === 'Últimos 30 días') return 'day'
  if (label === '6 meses') return 'week'
  return 'month'
}

function fmtDate(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtDay(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return raw.slice(5)
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function DashboardOverview() {
  const [dateRange, setDateRange] = useState<DateRange>({ label: 'Todo el tiempo', whereClause: '' })
  const granularity = inferGranularity(dateRange.label)

  const kpiKey = `kpis-${dateRange.label}`
  const { data: kpis } = useDbQuery(kpiKey, async (db) => {
    const w = dateRange.whereClause                          // "WHERE timestamp >= ..."
    const and = w ? w.replace('WHERE ', 'AND ') : ''        // "AND timestamp >= ..."

    const users = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM users')
    const posts = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM posts ${w}`
    )
    const interactions = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM interactions i
       JOIN posts p ON i.post_id = p.post_id ${w}`
    )
    const avgReach = await db.queryOne<{ avg: number }>(
      `SELECT ROUND(AVG(reach_count), 0) AS avg FROM posts WHERE reach_count > 0 ${and}`
    )
    const er = await db.queryOne<{ avg_er: number }>(
      `SELECT ROUND(AVG(er), 2) AS avg_er FROM (
        SELECT p.post_id, COUNT(i.interaction_id) * 100.0 / p.reach_count AS er
        FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id
        WHERE p.reach_count > 0 ${and} GROUP BY p.post_id
      )`
    )
    return {
      users: users?.c ?? 0,
      posts: posts?.c ?? 0,
      interactions: interactions?.c ?? 0,
      avgReach: avgReach?.avg ?? 0,
      er: er?.avg_er ?? 0,
    }
  })

  const timelineKey = `postsTimeline-${dateRange.label}-${dateRange.whereClause.length}`
  const { data: postsTimeline } = useDbQuery(timelineKey, async (db) => {
    const where = dateRange.whereClause
      ? `WHERE timestamp IS NOT NULL AND ${dateRange.whereClause.replace('WHERE ', '')}`
      : 'WHERE timestamp IS NOT NULL'

    let groupExpr: string
    let orderExpr: string
    if (granularity === 'day') {
      groupExpr = `strftime('%Y-%m-%d', timestamp)`
      orderExpr = groupExpr
    } else if (granularity === 'week') {
      groupExpr = `strftime('%Y-%W', timestamp)`
      orderExpr = `strftime('%Y-%m-%d', timestamp)`
    } else {
      groupExpr = `strftime('%Y-%m', timestamp)`
      orderExpr = groupExpr
    }

    const rows = await db.queryAll<{ period: string; count: number }>(
      `SELECT ${groupExpr} AS period, COUNT(*) AS count
       FROM posts ${where} GROUP BY ${groupExpr} ORDER BY ${orderExpr}`
    )
    const boundaries = await db.queryOne<{ first: string; last: string }>(
      `SELECT MIN(timestamp) AS first, MAX(timestamp) AS last FROM posts ${where}`
    )
    return {
      points: (rows ?? []).map(r => ({ period: r.period ?? '', posts: r.count ?? 0 })),
      range: { start: boundaries?.first ?? '', end: boundaries?.last ?? '' },
      total: (rows ?? []).reduce((s: number, r) => s + (r.count ?? 0), 0),
    }
  })

  const postsLabels = useMemo(() => {
    if (!postsTimeline) return []
    if (granularity === 'day') return postsTimeline.points.map(p => fmtDay(p.period))
    if (granularity === 'week') return postsTimeline.points.map((p, i) => i % 2 === 0 ? fmtDay(p.period) : '')
    return postsTimeline.points.map(p => {
      const parts = p.period.split('-')
      return parts.length >= 2 ? `${parts[0].slice(2)}-${parts[1]}` : p.period
    })
  }, [postsTimeline, granularity])

  const dateRangeDisplay = useMemo(() => {
    if (!postsTimeline?.range.start) return dateRange.label
    return `${fmtDate(postsTimeline.range.start)} → ${fmtDate(postsTimeline.range.end)}`
  }, [postsTimeline, dateRange.label])

  const { data: interactionTypes } = useDbQuery('interactionTypes', async (db) => {
    const rows = await db.queryAll<{ type: string; count: number }>(
      `SELECT type, COUNT(*) AS count FROM interactions GROUP BY type ORDER BY count DESC`
    )
    return (rows ?? []).map(r => ({ label: r.type ?? 'otro', value: r.count ?? 0 }))
  })

  const { data: mediaPerf } = useDbQuery('mediaPerf', async (db) => {
    const rows = await db.queryAll<{ media_type: string; avg_reach: number }>(
      `SELECT media_type, ROUND(AVG(reach_count), 0) AS avg_reach
       FROM posts WHERE reach_count > 0 AND media_type IS NOT NULL
       GROUP BY media_type ORDER BY avg_reach DESC`
    )
    return (rows ?? []).map(r => ({ label: r.media_type ?? 'otro', value: r.avg_reach ?? 0 }))
  })

  const { data: topPosts } = useDbQuery('topPosts', async (db) => {
    const rows = await db.queryAll<{ content: string; reach_count: number; media_type: string }>(
      `SELECT content, reach_count, media_type
       FROM posts WHERE reach_count > 0 ORDER BY reach_count DESC LIMIT 5`
    )
    return rows ?? []
  })

  const { data: topCountries } = useDbQuery('topCountries', async (db) => {
    const rows = await db.queryAll<{ country: string; count: number }>(
      `SELECT country, COUNT(*) AS count FROM users
       GROUP BY country ORDER BY count DESC LIMIT 5`
    )
    return (rows ?? []).map(r => ({ label: r.country ?? 'Desconocido', value: r.count ?? 0 }))
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Panel Principal</Text>
      <Text style={styles.subtitle}>Métricas clave de la red social</Text>

      <DateRangeFilter onChange={setDateRange} />

      <View style={styles.kpiRow}>
        <KpiTile label="Usuarios" value={fmtNum(kpis?.users ?? 0)} />
        <KpiTile label="Publicaciones" value={fmtNum(kpis?.posts ?? 0)} />
      </View>
      <View style={styles.kpiRow}>
        <KpiTile label="Interacciones" value={fmtNum(kpis?.interactions ?? 0)} />
        <KpiTile label="Tasa de Engagement" value={`${kpis?.er ?? 0}%`} trend={{ value: 2.1, positive: true }} />
      </View>

      <GlassCard glow="amber" style={styles.featuredCard}>
        <Text style={styles.featuredLabel}>ALCANCE PROMEDIO POR POST</Text>
        <Text style={styles.featuredValue}>{fmtNum(kpis?.avgReach ?? 0)}</Text>
        <Text style={styles.featuredSub}>personas alcanzan cada publicación en promedio</Text>
      </GlassCard>

      <SectionHeader title="Actividad de Publicaciones" />
      <ChartContainer title={`Publicaciones en el Tiempo · ${dateRangeDisplay}`} height={200}>
        <LineChart
          labels={postsLabels}
          series={[{ label: 'Posts', values: postsTimeline?.points.map(p => p.posts) ?? [] }]}
          dateRange={
            postsTimeline?.range.start
              ? { start: fmtDate(postsTimeline.range.start), end: fmtDate(postsTimeline.range.end) }
              : undefined
          }
          total={postsTimeline?.total}
          height={200}
        />
      </ChartContainer>

      <SectionHeader title="Tipos de Interacción" />
      <ChartContainer title="¿Cómo reacciona la audiencia?" height={220}>
        <BarChart data={interactionTypes ?? []} height={220} />
      </ChartContainer>

      <SectionHeader title="Rendimiento por Formato" />
      <ChartContainer title="Alcance promedio por tipo de contenido" height={200}>
        <BarChart data={mediaPerf ?? []} height={200} />
      </ChartContainer>

      <SectionHeader title="Posts con Mayor Alcance" />
      <GlassCard style={styles.tableCard}>
        {(topPosts ?? []).map((row, i) => (
          <View
            key={i}
            style={[styles.tableRow, i === (topPosts?.length ?? 0) - 1 && styles.tableRowLast]}
          >
            <View style={[styles.rankBadge, i === 0 && styles.rankBadgeTop]}>
              <Text style={[styles.rank, i === 0 && styles.rankTop]}>#{i + 1}</Text>
            </View>
            <View style={styles.postInfo}>
              <Text style={styles.postContent} numberOfLines={2}>
                {row.content || '(sin texto)'}
              </Text>
              <Text style={styles.postMeta}>{row.media_type}</Text>
            </View>
            <Text style={styles.reachValue}>{fmtNum(row.reach_count)}</Text>
          </View>
        ))}
      </GlassCard>

      <SectionHeader title="Países Principales" />
      <GlassCard style={styles.tableCard}>
        {(topCountries ?? []).map((row, i) => (
          <View
            key={i}
            style={[styles.tableRow, i === (topCountries?.length ?? 0) - 1 && styles.tableRowLast]}
          >
            <Text style={styles.rank}>#{i + 1}</Text>
            <Text style={[styles.postContent, { flex: 1 }]}>{row.label}</Text>
            <Text style={styles.reachValue}>{row.value.toLocaleString()}</Text>
          </View>
        ))}
      </GlassCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, marginBottom: spacing.sm },
  kpiRow: { flexDirection: 'row', gap: '3%', marginBottom: spacing.sm },

  featuredCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  featuredLabel: {
    ...typography.label,
    color: colors.text.tertiary,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  featuredValue: {
    fontSize: 52,
    fontWeight: '800' as const,
    color: colors.accent.amber,
    lineHeight: 60,
  },
  featuredSub: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  tableCard: { marginBottom: spacing.lg, padding: 0, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glass.cardBorder,
    gap: spacing.sm,
  },
  tableRowLast: { borderBottomWidth: 0 },

  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.space.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: { backgroundColor: colors.accent.amberGlow },
  rank: { ...typography.small, color: colors.text.tertiary, fontWeight: '700' as const },
  rankTop: { color: colors.accent.amber },

  postInfo: { flex: 1 },
  postContent: { ...typography.body, color: colors.text.primary },
  postMeta: { ...typography.small, color: colors.text.tertiary, marginTop: 2 },
  reachValue: {
    ...typography.body,
    color: colors.accent.amber,
    fontWeight: '700' as const,
    minWidth: 48,
    textAlign: 'right',
  },
})
