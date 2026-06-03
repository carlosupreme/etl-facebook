import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../theme/tokens'
import { KpiTile } from '../components/KpiTile'
import { ChartContainer } from '../components/ChartContainer'
import { SectionHeader } from '../components/SectionHeader'
import { WeaknessBadge } from '../components/WeaknessBadge'
import { BarChart, ScatterChart } from '../components/charts'
import { useDbQuery } from '../hooks/useDbQuery'

export default function ContentScreen() {
  const { t } = useTranslation()

  const { data: kpis } = useDbQuery('contKpis', async (db) => {
    const avgReach = await db.queryOne<{ avg: number }>('SELECT ROUND(AVG(reach_count), 0) AS avg FROM posts WHERE reach_count IS NOT NULL')
    const bestMedia = await db.queryOne<{ media_type: string }>(
      `SELECT media_type FROM posts WHERE media_type IS NOT NULL
       GROUP BY media_type ORDER BY AVG(reach_count) DESC LIMIT 1`
    )
    const total = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM posts')
    const noneCount = await db.queryOne<{ c: number }>(
      "SELECT COUNT(*) AS c FROM posts WHERE media_type = 'none' OR media_type IS NULL"
    )
    return [
      { label: t('content.avgReach'), value: avgReach?.avg ?? 0 },
      { label: t('content.bestMedia'), value: bestMedia?.media_type ?? '—' },
      { label: t('overview.posts'), value: total?.c ?? 0 },
      { label: t('content.noneTypeAlert'), value: noneCount?.c ?? 0 },
    ]
  })

  const { data: reachByType } = useDbQuery('reachByType', async (db) => {
    const rows = await db.queryAll<{ media_type: string; avg_reach: number }>(
      `SELECT p.media_type, ROUND(AVG(p.reach_count), 0) AS avg_reach
       FROM posts p WHERE p.media_type IS NOT NULL AND p.reach_count IS NOT NULL
       GROUP BY p.media_type ORDER BY avg_reach DESC`
    )
    return (rows ?? []).map(r => ({ type: r.media_type ?? 'unknown', avg: r.avg_reach ?? 0 }))
  })

  const { data: mediaTypeCount } = useDbQuery('mediaTypeCount', async (db) => {
    const rows = await db.queryAll<{ media_type: string; total: number; pct: number }>(
      `SELECT media_type, COUNT(*) AS total,
              ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posts), 1) AS pct
       FROM posts
       WHERE media_type IS NOT NULL
       GROUP BY media_type ORDER BY total DESC`
    )
    return (rows ?? []).map(r => ({ label: r.media_type ?? 'unknown', value: r.total ?? 0 }))
  })

  const { data: reachDist } = useDbQuery('reachDist', async (db) => {
    const rows = await db.queryAll<{ bucket: number; count: number }>(
      `SELECT CAST(p.reach_count / 500 AS INTEGER) * 500 AS bucket, COUNT(*) AS count
       FROM posts p WHERE p.reach_count IS NOT NULL AND p.reach_count > 0
       GROUP BY bucket ORDER BY bucket LIMIT 20`
    )
    return (rows ?? []).map(r => ({ bucket: r.bucket ?? 0, count: r.count ?? 0 }))
  })

  const { data: contentScatter } = useDbQuery('contentScatter', async (db) => {
    const rows = await db.queryAll<{ content_len: number; engagements: number }>(
      `SELECT LENGTH(COALESCE(p.content, '')) AS content_len,
              COUNT(i.interaction_id) AS engagements
       FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id
       GROUP BY p.post_id ORDER BY content_len LIMIT 100`
    )
    return (rows ?? []).map(r => ({ len: r.content_len ?? 0, eng: r.engagements ?? 0 }))
  })

  const { data: dormant } = useDbQuery('dormantPages', async (db) => {
    const r = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM pages WHERE page_id NOT IN (
        SELECT DISTINCT page_id FROM posts WHERE page_id IS NOT NULL
      )`
    )
    return r?.c ?? 0
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('content.title')}</Text>
      <View style={styles.kpiRow}>
        {kpis?.slice(0, 2).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(2, 4).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>

      <ChartContainer title={t('content.mediaTypeCount')} height={200}>
        <BarChart
          data={mediaTypeCount ?? []}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('content.reachByType')} height={200}>
        <BarChart
          data={reachByType?.map(d => ({ label: d.type, value: d.avg })) ?? []}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('content.reachDistribution')} height={200}>
        <BarChart
          data={reachDist?.map(d => ({ label: `${d.bucket / 1000}k`, value: d.count })) ?? []}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('content.contentVsEngagement')} height={200}>
        <ScatterChart
          data={contentScatter?.map(d => ({ x: d.len, y: d.eng })) ?? []}
          height={200}
          xLabel="Content length"
          yLabel="Engagements"
        />
      </ChartContainer>

      <SectionHeader title={t('content.topPages')} />
      <View style={{ marginBottom: spacing.md }}>
        <Text style={typography.body}>Top pages by reach table</Text>
      </View>

      <SectionHeader title={t('weaknesses.title')} />
      <WeaknessBadge severity="warning" label={`${dormant} ${t('content.dormantPages')}`} />
      <WeaknessBadge severity="monitor" label={t('content.weakMedia')} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.lg },
  kpiRow: { flexDirection: 'row', gap: '3%', marginBottom: spacing.sm },
})
