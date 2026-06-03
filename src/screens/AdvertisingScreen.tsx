import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../theme/tokens'
import { KpiTile } from '../components/KpiTile'
import { ChartContainer } from '../components/ChartContainer'
import { SectionHeader } from '../components/SectionHeader'
import { WeaknessBadge } from '../components/WeaknessBadge'
import { GlassCard } from '../components/GlassCard'
import { ScatterChart, BarChart, LineChart } from '../components/charts'
import { useDbQuery } from '../hooks/useDbQuery'

export default function AdvertisingScreen() {
  const { t } = useTranslation()

  const { data: kpis } = useDbQuery('adKpis', async (db) => {
    const campaigns = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM ad_campaigns')
    const spend = await db.queryOne<{ total: number }>('SELECT ROUND(SUM(spend), 0) AS total FROM ad_metrics')
    const cpm = await db.queryOne<{ avg: number }>(
      'SELECT ROUND(AVG(spend * 1000.0 / impressions), 2) AS avg FROM ad_metrics WHERE impressions > 0'
    )
    const ctr = await db.queryOne<{ avg: number }>(
      'SELECT ROUND(AVG(clicks * 100.0 / impressions), 2) AS avg FROM ad_metrics WHERE impressions > 0'
    )
    const cpc = await db.queryOne<{ avg: number }>(
      'SELECT ROUND(SUM(spend) / NULLIF(SUM(clicks), 0), 2) AS avg FROM ad_metrics'
    )
    const freq = await db.queryOne<{ freq: number }>(
      `SELECT ROUND(AVG(m.impressions / NULLIF(p.avg_reach, 0)), 2) AS freq
       FROM ad_metrics m CROSS JOIN (SELECT AVG(reach_count) AS avg_reach FROM posts WHERE reach_count > 0) p`
    )
    const revenue = await db.queryOne<{ rev: number }>(
      `SELECT ROUND(SUM(
        CASE c.objective
          WHEN 'conversions' THEN m.clicks * 5.0
          WHEN 'brand_awareness' THEN m.impressions * 0.01
          ELSE m.clicks * 2.0
        END
      ), 0) AS rev FROM ad_metrics m JOIN ad_campaigns c ON m.campaign_id = c.campaign_id`
    )
    const totalSpend = spend?.total ?? 1
    const roas = ((revenue?.rev ?? 0) / totalSpend).toFixed(2)
    return [
      { label: t('advertising.campaigns'), value: campaigns?.c ?? 0 },
      { label: t('advertising.totalSpend'), value: `$${(spend?.total ?? 0).toLocaleString()}` },
      { label: 'Avg CPM', value: `$${cpm?.avg ?? 0}` },
      { label: 'Avg CTR', value: `${ctr?.avg ?? 0}%` },
      { label: 'Cost per Click', value: `$${cpc?.avg ?? 0}` },
      { label: 'Frequency', value: `${freq?.freq ?? '—'}x` },
    ]
  })

  const { data: objectiveSummary } = useDbQuery('objectiveSummary', async (db) => {
    const rows = await db.queryAll<{
      objective: string; campaign_count: number; avg_spend: number;
      avg_impressions: number; avg_clicks: number; avg_cpm: number; avg_ctr: number
    }>(
      `SELECT c.objective,
              COUNT(*) AS campaign_count,
              ROUND(AVG(m.spend), 0) AS avg_spend,
              ROUND(AVG(m.impressions), 0) AS avg_impressions,
              ROUND(AVG(m.clicks), 0) AS avg_clicks,
              ROUND(AVG(m.spend * 1000.0 / NULLIF(m.impressions, 0)), 2) AS avg_cpm,
              ROUND(AVG(m.clicks * 100.0 / NULLIF(m.impressions, 0)), 2) AS avg_ctr
       FROM ad_campaigns c JOIN ad_metrics m ON c.campaign_id = m.campaign_id
       GROUP BY c.objective`
    )
    return (rows ?? []).map(r => ({
      objective: r.objective ?? 'unknown',
      count: r.campaign_count ?? 0,
      avgSpend: r.avg_spend ?? 0,
      avgImpressions: r.avg_impressions ?? 0,
      avgClicks: r.avg_clicks ?? 0,
      avgCpm: r.avg_cpm ?? 0,
      avgCtr: r.avg_ctr ?? 0,
    }))
  })

  const { data: computedKpis } = useDbQuery('computedKpis', async (db) => {
    const rows = await db.queryAll<{
      objective: string; total_impressions: number; total_clicks: number;
      total_spend: number; estimated_ad_recall: number; conversions_count: number
    }>(
      `SELECT c.objective,
              SUM(m.impressions) AS total_impressions,
              SUM(m.clicks) AS total_clicks,
              SUM(m.spend) AS total_spend,
              ROUND(SUM(
                CASE c.objective
                  WHEN 'brand_awareness' THEN m.impressions * 0.35
                  ELSE 0
                END
              ), 0) AS estimated_ad_recall,
              ROUND(SUM(
                CASE c.objective
                  WHEN 'conversions' THEN m.clicks * 0.12
                  ELSE 0
                END
              ), 0) AS conversions_count
       FROM ad_campaigns c JOIN ad_metrics m ON c.campaign_id = m.campaign_id
       GROUP BY c.objective`
    )
    return (rows ?? []).reduce((acc: Record<string, any>, r) => {
      acc[r.objective ?? 'unknown'] = r
      return acc
    }, {} as Record<string, any>)
  })

  const { data: spendVsImp } = useDbQuery('spendVsImp', async (db) => {
    const rows = await db.queryAll<{ spend: number; impressions: number }>(
      `SELECT m.spend, m.impressions FROM ad_metrics m WHERE m.impressions > 0 LIMIT 100`
    )
    return (rows ?? []).map(r => ({ spend: r.spend ?? 0, impressions: r.impressions ?? 0 }))
  })

  const { data: budgetData } = useDbQuery('budgetData', async (db) => {
    const rows = await db.queryAll<{ name: string; budget: number; actual: number }>(
      `SELECT c.name, c.budget, COALESCE(ROUND(SUM(m.spend), 0), 0) AS actual
       FROM ad_campaigns c LEFT JOIN ad_metrics m ON c.campaign_id = m.campaign_id
       GROUP BY c.campaign_id ORDER BY actual DESC`
    )
    return (rows ?? []).map(r => ({ name: r.name ?? '', budget: r.budget ?? 0, actual: r.actual ?? 0 }))
  })

  const { data: cpmTrend } = useDbQuery('cpmTrend', async (db) => {
    const rows = await db.queryAll<{ name: string; cpm: number }>(
      `SELECT c.name, ROUND(AVG(m.spend * 1000.0 / NULLIF(m.impressions, 0)), 2) AS cpm
       FROM ad_campaigns c JOIN ad_metrics m ON c.campaign_id = m.campaign_id
       WHERE m.impressions > 0 GROUP BY c.campaign_id`
    )
    return (rows ?? []).map(r => ({ name: r.name ?? '', cpm: r.cpm ?? 0 }))
  })

  const { data: highCpm } = useDbQuery('highCpm', async (db) => {
    const cpm = await db.queryOne<{ avg: number }>(
      'SELECT ROUND(AVG(spend * 1000.0 / impressions), 2) AS avg FROM ad_metrics WHERE impressions > 0'
    )
    const threshold = cpm?.avg ?? 10
    const r = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM ad_metrics WHERE impressions > 0
       AND (spend * 1000.0 / impressions) > ${threshold}`
    )
    return r?.c ?? 0
  })

  const brandAwareness = computedKpis?.brand_awareness
  const conversionsKpi = computedKpis?.conversions
  const conversionRate = brandAwareness && brandAwareness.total_impressions > 0
    ? ((conversionsKpi?.total_clicks ?? 0) / brandAwareness.total_impressions * 100).toFixed(2)
    : '0.00'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('advertising.title')}</Text>

      <Text style={styles.sectionLabel}>Campaign Overview</Text>
      <View style={styles.kpiRow}>
        {kpis?.slice(0, 2).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(2, 4).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(4, 6).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>

      <Text style={styles.sectionLabel}>Objective-Based Metrics</Text>
      <GlassCard style={{ marginBottom: spacing.md, padding: spacing.md }}>
        {brandAwareness ? (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Brand Awareness</Text>
            <Text style={styles.metricValue}>
              Est. Ad Recall: {(brandAwareness.estimated_ad_recall ?? 0).toLocaleString()} people
            </Text>
            <Text style={styles.metricSub}>
              CPM: ${brandAwareness.total_spend > 0 ? ((brandAwareness.total_spend * 1000) / brandAwareness.total_impressions).toFixed(2) : '0.00'}
              · Reach frequency: —
            </Text>
          </View>
        ) : null}
        {conversionsKpi ? (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Conversions</Text>
            <Text style={styles.metricValue}>
              Conversions: {(conversionsKpi.conversions_count ?? 0).toLocaleString()}
            </Text>
            <Text style={styles.metricSub}>
              Conv. rate: {conversionRate}% · Est. ROAS: {kpis?.[5]?.value ?? '—'}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <ChartContainer title="Performance by Objective" height={200}>
        <BarChart
          data={objectiveSummary?.map(d => ({
            label: d.objective.replace(/_/g, '\n'),
            value: d.avgCpm,
          })) ?? []}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('advertising.spendVsImpressions')} height={200}>
        <ScatterChart
          data={spendVsImp?.map(d => ({ x: d.impressions, y: d.spend })) ?? []}
          height={200}
          xLabel="Impressions"
          yLabel="Spend ($)"
        />
      </ChartContainer>

      <ChartContainer title={t('advertising.budgetVsSpend')} height={200}>
        <BarChart
          data={budgetData?.map(d => ({ label: d.name, value: d.actual })) ?? []}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('advertising.cpmTrend')} height={200}>
        <LineChart
          labels={cpmTrend?.map(c => c.name.length > 6 ? c.name.slice(0, 6) + '…' : c.name) ?? []}
          series={[{ label: 'CPM ($)', values: cpmTrend?.map(c => c.cpm) ?? [] }]}
          height={200}
        />
      </ChartContainer>

      <SectionHeader title={t('weaknesses.title')} />
      <WeaknessBadge severity="critical" label={`${highCpm} ${t('advertising.highCpm')}`} />
      <WeaknessBadge severity="warning" label={t('advertising.overspend')} />
      <WeaknessBadge severity="monitor" label={t('advertising.noClicks')} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.sm },
  sectionLabel: { ...typography.h3, marginBottom: spacing.sm, marginTop: spacing.md, color: colors.accent.amber },
  kpiRow: { flexDirection: 'row', gap: '3%', marginBottom: spacing.sm },
  metricRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  metricLabel: { ...typography.h3, color: colors.accent.cyan, marginBottom: spacing.xs },
  metricValue: { ...typography.body, fontWeight: '600', marginBottom: 2 },
  metricSub: { ...typography.small, color: colors.text.tertiary },
})
