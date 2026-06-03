import { useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../theme/tokens'
import { GlassCard } from '../components/GlassCard'
import { KpiTile } from '../components/KpiTile'
import { SectionHeader } from '../components/SectionHeader'
import { ChartContainer } from '../components/ChartContainer'
import { LineChart, PieChart, BarChart } from '../components/charts'
import { DateRangeFilter, type DateRange } from '../components/DateRangeFilter'
import { useDbQuery } from '../hooks/useDbQuery'

function inferGranularity(label: string): 'day' | 'week' | 'month' {
  if (label === 'Last 7 days' || label === 'Last 30 days') return 'day'
  if (label === '6 months') return 'week'
  return 'month'
}

function fmtDate(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtDay(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return raw.slice(5)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DashboardOverview() {
  const { t } = useTranslation()
  const [dateRange, setDateRange] = useState<DateRange>({ label: 'All time', whereClause: '' })
  const granularity = inferGranularity(dateRange.label)

  const { data: kpis } = useDbQuery('kpis', async (db) => {
    const users = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM users')
    const posts = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM posts')
    const interactions = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM interactions')
    const er = await db.queryOne<{ avg_er: number }>(
      `SELECT ROUND(AVG(er), 2) AS avg_er FROM (
        SELECT p.post_id, COUNT(i.interaction_id) * 100.0 / p.reach_count AS er
        FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id
        WHERE p.reach_count > 0 GROUP BY p.post_id
      )`)
    return [
      { label: t('overview.users'), value: users?.c ?? 0 },
      { label: t('overview.posts'), value: posts?.c ?? 0 },
      { label: t('overview.interactions'), value: interactions?.c ?? 0 },
      { label: t('overview.engagementRate'), value: `${er?.avg_er ?? 0}%`, trend: { value: 2.1, positive: true } },
    ]
  })

  const queryKey = `postsTimeline-${dateRange.label}-${dateRange.whereClause.length}`
  const { data: postsTimeline } = useDbQuery(queryKey, async (db) => {
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

  const { data: mediaDist } = useDbQuery('mediaDist', async (db) => {
    const rows = await db.queryAll<{ media_type: string; count: number }>(
      `SELECT media_type, COUNT(*) AS count FROM posts
       WHERE media_type IS NOT NULL GROUP BY media_type ORDER BY count DESC`
    )
    return (rows ?? []).map(r => ({ type: r.media_type ?? 'unknown', count: r.count ?? 0 }))
  })

  const { data: topCountries } = useDbQuery('topCountries', async (db) => {
    const rows = await db.queryAll<{ country: string; count: number }>(
      `SELECT country, COUNT(*) AS count FROM users
       GROUP BY country ORDER BY count DESC LIMIT 5`
    )
    return (rows ?? []).map(r => ({ country: r.country ?? 'unknown', users: r.count ?? 0 }))
  })

  const { data: privacyStats } = useDbQuery('privacyStats', async (db) => {
    const rows = await db.queryAll<{ privacy: string; count: number }>(
      `SELECT privacy, COUNT(*) AS count FROM posts
       WHERE privacy IS NOT NULL GROUP BY privacy ORDER BY count DESC`
    )
    return (rows ?? []).map(r => ({ privacy: r.privacy ?? 'unknown', count: r.count ?? 0 }))
  })

  const dateRangeDisplay = useMemo(() => {
    if (!postsTimeline || !postsTimeline.range.start) return dateRange.label
    const start = fmtDate(postsTimeline.range.start)
    const end = fmtDate(postsTimeline.range.end)
    return `${start} → ${end}`
  }, [postsTimeline])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('overview.title')}</Text>
      <Text style={styles.subtitle}>{t('overview.subtitle')}</Text>

      <DateRangeFilter onChange={setDateRange} />

      <View style={styles.kpiRow}>
        {kpis?.slice(0, 2).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} trend={(k as any).trend} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(2, 4).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} trend={(k as any).trend} />)}
      </View>

      <ChartContainer title={`${t('overview.postsOverTime')} · ${dateRangeDisplay}`} height={200}>
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

      <ChartContainer title={t('overview.mediaDistribution')} height={200}>
        <PieChart
          data={mediaDist?.map(d => ({ label: d.type, value: d.count })) ?? []}
          height={200}
        />
      </ChartContainer>

      <View style={styles.twoCol}>
        <ChartContainer title={t('overview.privacyBreakdown')} height={180}>
          <BarChart
            data={privacyStats?.map(d => ({ label: d.privacy, value: d.count })) ?? []}
            height={180}
          />
        </ChartContainer>
        <ChartContainer title={t('overview.topCountries')} height={180}>
          <BarChart
            data={topCountries?.map(d => ({ label: d.country, value: d.users })) ?? []}
            height={180}
          />
        </ChartContainer>
      </View>

      <SectionHeader title={t('overview.weaknessPreview')} action={t('common.seeAll')} />
      <GlassCard glow="amber" style={styles.weaknessPreview}>
        <Text style={typography.body}>3 weaknesses detected — tap to view</Text>
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
  twoCol: { gap: spacing.md },
  weaknessPreview: { marginBottom: spacing.lg },
})
