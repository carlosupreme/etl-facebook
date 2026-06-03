import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../theme/tokens'
import { KpiTile } from '../components/KpiTile'
import { ChartContainer } from '../components/ChartContainer'
import { SectionHeader } from '../components/SectionHeader'
import { GlassCard } from '../components/GlassCard'
import { WeaknessBadge } from '../components/WeaknessBadge'
import { PieChart, LineChart } from '../components/charts'
import { useDbQuery } from '../hooks/useDbQuery'

export default function EngagementScreen() {
  const { t } = useTranslation()

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
      { label: t('engagement.likes'),      value: likes?.c    ?? 0 },
      { label: t('engagement.love'),       value: love?.c     ?? 0 },
      { label: t('engagement.comments'),   value: comments?.c ?? 0 },
      { label: t('engagement.shares'),     value: shares?.c   ?? 0 },
      { label: t('engagement.haha'),       value: haha?.c     ?? 0 },
      { label: t('engagement.wow'),        value: wow?.c      ?? 0 },
      { label: t('engagement.sad'),        value: sad?.c      ?? 0 },
      { label: t('engagement.angry'),      value: angry?.c    ?? 0 },
      { label: t('engagement.avgPerPost'), value: avg?.avg    ?? 0 },
    ]
  })

  const { data: allReactions } = useDbQuery('allReactions', async (db) => {
    const types = ['like', 'love', 'comment', 'share', 'haha', 'wow', 'sad', 'angry']
    const results = await Promise.all(
      types.map(type => db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM interactions WHERE type='${type}'`))
    )
    const labels = [
      t('engagement.likes'), t('engagement.love'), t('engagement.comments'), t('engagement.shares'),
      t('engagement.haha'), t('engagement.wow'), t('engagement.sad'), t('engagement.angry'),
    ]
    return types.map((_, i) => ({ label: labels[i], value: results[i]?.c ?? 0 }))
  })

  const { data: engTrend } = useDbQuery('engTrend', async (db) => {
    const rows = await db.queryAll<{ month: string; count: number }>(
      `SELECT strftime('%Y-%m', timestamp) AS month, COUNT(*) AS count
       FROM interactions GROUP BY month ORDER BY month LIMIT 24`
    )
    return (rows ?? []).map(r => ({ month: r.month ?? '', count: r.count ?? 0 }))
  })

  const { data: zeroInt } = useDbQuery('zeroInt', async (db) => {
    const r = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id
       WHERE i.interaction_id IS NULL`
    )
    return r?.c ?? 0
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('engagement.title')}</Text>

      <View style={styles.kpiRow}>
        {kpis?.slice(0, 2).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(2, 4).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>

      <ChartContainer title={t('engagement.typeBreakdown')} height={200}>
        <PieChart
          data={[
            { label: t('engagement.likes'),    value: kpis?.[0]?.value as number ?? 0 },
            { label: t('engagement.love'),     value: kpis?.[1]?.value as number ?? 0 },
            { label: t('engagement.comments'), value: kpis?.[2]?.value as number ?? 0 },
            { label: t('engagement.shares'),   value: kpis?.[3]?.value as number ?? 0 },
            { label: t('engagement.haha'),     value: kpis?.[4]?.value as number ?? 0 },
            { label: t('engagement.wow'),      value: kpis?.[5]?.value as number ?? 0 },
            { label: t('engagement.sad'),      value: kpis?.[6]?.value as number ?? 0 },
            { label: t('engagement.angry'),    value: kpis?.[7]?.value as number ?? 0 },
          ]}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('engagement.reactionsBreakdown')} height={200}>
        <PieChart data={allReactions ?? []} height={200} />
      </ChartContainer>

      <ChartContainer title={t('engagement.trend')} height={200}>
        <LineChart
          labels={engTrend?.map(e => e.month.slice(5)) ?? []}
          series={[{ label: 'Interactions', values: engTrend?.map(e => e.count) ?? [] }]}
          height={200}
        />
      </ChartContainer>

      <SectionHeader title={t('engagement.topPosts')} />
      <GlassCard style={{ marginBottom: spacing.md }}>
        <Text style={typography.body}>Top 10 posts list</Text>
      </GlassCard>

      <SectionHeader title={t('weaknesses.title')} />
      <WeaknessBadge severity="monitor" label={`${zeroInt} ${t('engagement.zeroInteractions')}`} />
      <WeaknessBadge severity="warning" label={t('engagement.suspiciousPosts')} />
      <WeaknessBadge severity="critical" label={t('engagement.declining')} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.lg },
  kpiRow: { flexDirection: 'row', gap: '3%', marginBottom: spacing.sm },
})
