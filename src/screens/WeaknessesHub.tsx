import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, radius, typography } from '../theme/tokens'
import { GlassCard } from '../components/GlassCard'
import { WeaknessBadge } from '../components/WeaknessBadge'
import { SectionHeader } from '../components/SectionHeader'
import { BarChart, LineChart } from '../components/charts'
import { useDbQuery } from '../hooks/useDbQuery'

interface WeaknessItem {
  id: string
  labelKey: string
  severity: 'critical' | 'warning' | 'monitor'
  count: number
  icon: string
  description: string
  impact: string
  recommendation: string
}

export default function WeaknessesHub() {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: lowReach } = useDbQuery('wLowReach', async (db) => {
    const avg = await db.queryOne<{ avg: number }>('SELECT AVG(reach_count) AS avg FROM posts WHERE reach_count IS NOT NULL')
    const threshold = (avg?.avg ?? 1000) * 0.3
    const r = await db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM posts WHERE reach_count < ${threshold} AND reach_count > 0`)
    return r?.c ?? 0
  })

  const { data: lowReachDetail } = useDbQuery('wLowReachDetail', async (db) => {
    const avg = await db.queryOne<{ avg: number }>('SELECT AVG(reach_count) AS avg FROM posts WHERE reach_count IS NOT NULL')
    const threshold = (avg?.avg ?? 1000) * 0.3
    const rows = await db.queryAll<{ media_type: string; count: number }>(
      `SELECT media_type, COUNT(*) AS count FROM posts WHERE reach_count < ${threshold} AND reach_count > 0 GROUP BY media_type ORDER BY count DESC`
    )
    return (rows ?? []).map(r => ({ label: r.media_type ?? 'unknown', value: r.count ?? 0 }))
  })

  const { data: dormantPages } = useDbQuery('wDormant', async (db) => {
    const r = await db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM pages WHERE page_id NOT IN (SELECT DISTINCT page_id FROM posts WHERE page_id IS NOT NULL)`)
    return r?.c ?? 0
  })

  const { data: churnRisk } = useDbQuery('wChurn', async (db) => {
    const r = await db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM users WHERE user_id NOT IN (SELECT DISTINCT user_id FROM activity_log WHERE timestamp >= date('now', '-6 months', '+6 years'))`)
    return r?.c ?? 0
  })

  const { data: highCpm } = useDbQuery('wCpm', async (db) => {
    const r = await db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM ad_metrics WHERE impressions > 0 AND (spend * 1000.0 / impressions) > 8`)
    return r?.c ?? 0
  })

  const { data: highCpmDetail } = useDbQuery('wCpmDetail', async (db) => {
    const rows = await db.queryAll<{ objective: string; avg_cpm: number }>(
      `SELECT c.objective, ROUND(AVG(m.spend * 1000.0 / NULLIF(m.impressions, 0)), 2) AS avg_cpm
       FROM ad_metrics m JOIN ad_campaigns c ON m.campaign_id = c.campaign_id
       WHERE m.impressions > 0 AND (m.spend * 1000.0 / m.impressions) > 8
       GROUP BY c.objective ORDER BY avg_cpm DESC`
    )
    return (rows ?? []).map(r => ({ label: r.objective ?? 'unknown', value: r.avg_cpm ?? 0 }))
  })

  const { data: zeroInt } = useDbQuery('wZeroInt', async (db) => {
    const r = await db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id WHERE i.interaction_id IS NULL`)
    return r?.c ?? 0
  })

  const { data: adFatigue } = useDbQuery('wAdFatigue', async (db) => {
    const avgReach = await db.queryOne<{ avg: number }>('SELECT AVG(reach_count) AS avg FROM posts WHERE reach_count > 0')
    const r = await db.queryOne<{ c: number }>(`SELECT COUNT(*) AS c FROM ad_metrics m CROSS JOIN (SELECT ${avgReach?.avg ?? 5000} AS r) WHERE m.impressions > 0 AND (m.impressions / NULLIF(r, 0)) > 4`)
    return r?.c ?? 0
  })

  const { data: noMediaType } = useDbQuery('noMediaType', async (db) => {
    const r = await db.queryOne<{ c: number }>(
      "SELECT COUNT(*) AS c FROM posts WHERE media_type = 'none' OR media_type IS NULL"
    )
    return r?.c ?? 0
  })

  const { data: highMod } = useDbQuery('highMod', async (db) => {
    const r = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM moderation_reports')
    return r?.c ?? 0
  })

  const items: WeaknessItem[] = [
    {
      id: 'lowReach', labelKey: 'lowReach', severity: 'critical', count: lowReach ?? 0,
      icon: '📉',
      description: t('weaknesses.items.lowReach.description'),
      impact: t('weaknesses.items.lowReach.impact'),
      recommendation: t('weaknesses.items.lowReach.recommendation'),
    },
    {
      id: 'zeroInt', labelKey: 'engagementDrop', severity: 'critical', count: zeroInt ?? 0,
      icon: '🤖',
      description: t('weaknesses.items.zeroInt.description'),
      impact: t('weaknesses.items.zeroInt.impact'),
      recommendation: t('weaknesses.items.zeroInt.recommendation'),
    },
    {
      id: 'adWaste', labelKey: 'adWaste', severity: 'warning', count: highCpm ?? 0,
      icon: '💰',
      description: t('weaknesses.items.adWaste.description'),
      impact: t('weaknesses.items.adWaste.impact'),
      recommendation: t('weaknesses.items.adWaste.recommendation'),
    },
    {
      id: 'dormant', labelKey: 'dormantPages', severity: 'warning', count: dormantPages ?? 0,
      icon: '💤',
      description: t('weaknesses.items.dormant.description'),
      impact: t('weaknesses.items.dormant.impact'),
      recommendation: t('weaknesses.items.dormant.recommendation'),
    },
    {
      id: 'churn', labelKey: 'churnRisk', severity: 'warning', count: churnRisk ?? 0,
      icon: '🚪',
      description: t('weaknesses.items.churn.description'),
      impact: t('weaknesses.items.churn.impact'),
      recommendation: t('weaknesses.items.churn.recommendation'),
    },
    {
      id: 'adFatigue', labelKey: 'adFatigue', severity: 'monitor', count: adFatigue ?? 0,
      icon: '🔄',
      description: t('weaknesses.items.adFatigue.description'),
      impact: t('weaknesses.items.adFatigue.impact'),
      recommendation: t('weaknesses.items.adFatigue.recommendation'),
    },
    {
      id: 'noMediaType', labelKey: 'noMediaType', severity: 'critical', count: noMediaType ?? 0,
      icon: '📭',
      description: t('weaknesses.items.noMediaType.description'),
      impact: t('weaknesses.items.noMediaType.impact'),
      recommendation: t('weaknesses.items.noMediaType.recommendation'),
    },
    {
      id: 'highModeration', labelKey: 'highModeration', severity: 'warning', count: highMod ?? 0,
      icon: '🚨',
      description: t('weaknesses.items.highModeration.description'),
      impact: t('weaknesses.items.highModeration.impact'),
      recommendation: t('weaknesses.items.highModeration.recommendation'),
    },
  ]

  const severityOrder = { critical: 0, warning: 1, monitor: 2 }
  const sorted = [...items].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('weaknesses.title')}</Text>
      <Text style={styles.subtitle}>{t('weaknesses.subtitle')}</Text>

      <View style={styles.summaryRow}>
        <GlassCard style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{items.filter(i => i.severity === 'critical').length}</Text>
          <Text style={styles.summaryLabel}>{t('weaknesses.severity.critical')}</Text>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <Text style={[styles.summaryNum, { color: colors.status.warning }]}>{items.filter(i => i.severity === 'warning').length}</Text>
          <Text style={styles.summaryLabel}>{t('weaknesses.severity.warning')}</Text>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <Text style={[styles.summaryNum, { color: colors.status.monitor }]}>{items.filter(i => i.severity === 'monitor').length}</Text>
          <Text style={styles.summaryLabel}>{t('weaknesses.severity.monitor')}</Text>
        </GlassCard>
      </View>

      <SectionHeader title={t('weaknesses.categories')} />

      {sorted.map((item) => {
        const isExpanded = expanded === item.id
        return (
          <TouchableOpacity key={item.id} activeOpacity={0.7}
            onPress={() => setExpanded(isExpanded ? null : item.id)}>
            <GlassCard
              glow={isExpanded ? (item.severity === 'critical' ? 'magenta' : item.severity === 'warning' ? 'amber' : 'cyan') : undefined}
              style={[styles.weaknessCard, isExpanded && styles.weaknessCardExpanded]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{t(`weaknesses.${item.labelKey as any}`)}</Text>
                    <Text style={styles.cardSubtitle}>{t(`weaknesses.severity.${item.severity}` as any).toUpperCase()}</Text>
                  </View>
                </View>
                {item.count > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: item.severity === 'critical' ? colors.status.critical + '30' : item.severity === 'warning' ? colors.status.warning + '30' : colors.status.monitor + '30' }]}>
                    <Text style={styles.countText}>{item.count}</Text>
                  </View>
                )}
              </View>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.divider} />

                  <Text style={styles.sectionLabel}>{t('weaknesses.sectionWhatsHappening')}</Text>
                  <Text style={styles.description}>{item.description}</Text>

                  <Text style={styles.sectionLabel}>{t('weaknesses.sectionBusinessImpact')}</Text>
                  <Text style={styles.impact}>{item.impact}</Text>

                  {item.id === 'lowReach' && lowReachDetail && lowReachDetail.length > 0 && (
                    <View style={styles.chartWrapper}>
                      <Text style={styles.sectionLabel}>{t('weaknesses.sectionBreakdownMedia')}</Text>
                      <BarChart data={lowReachDetail} height={150} />
                    </View>
                  )}

                  {item.id === 'adWaste' && highCpmDetail && highCpmDetail.length > 0 && (
                    <View style={styles.chartWrapper}>
                      <Text style={styles.sectionLabel}>{t('weaknesses.sectionAvgCpmObjective')}</Text>
                      <BarChart data={highCpmDetail} height={150} />
                    </View>
                  )}

                  <Text style={styles.sectionLabel}>{t('weaknesses.sectionRecommendedAction')}</Text>
                  <View style={styles.recommendBox}>
                    <Text style={styles.recommendation}>{item.recommendation}</Text>
                  </View>
                </View>
              )}

              <Text style={[styles.cardAction, isExpanded && { marginTop: spacing.sm }]}>
                {isExpanded ? t('weaknesses.showLess') : t('weaknesses.tapForDetails')}
              </Text>
            </GlassCard>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', gap: '3%', marginBottom: spacing.lg },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  summaryNum: { ...typography.kpi, color: colors.status.critical, fontSize: 28 },
  summaryLabel: { ...typography.small, marginTop: spacing.xs },
  weaknessCard: { marginBottom: spacing.sm },
  weaknessCardExpanded: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  cardIcon: { fontSize: 28 },
  cardTitle: { ...typography.h3 },
  cardSubtitle: { ...typography.small, color: colors.text.tertiary, fontSize: 10, marginTop: 1 },
  countBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, marginLeft: spacing.sm },
  countText: { ...typography.small, fontWeight: '700', color: colors.text.primary },
  cardAction: { ...typography.body, color: colors.accent.cyan, fontSize: 13, marginTop: spacing.xs },
  expandedContent: { marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginBottom: spacing.sm },
  sectionLabel: { ...typography.small, color: colors.accent.amber, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 },
  description: { ...typography.body, lineHeight: 20 },
  impact: { ...typography.body, color: colors.text.secondary, fontStyle: 'italic', lineHeight: 20 },
  chartWrapper: { marginVertical: spacing.sm },
  recommendBox: {
    backgroundColor: 'rgba(8,145,178,0.08)',
    borderRadius: radius.sm,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.cyan,
  },
  recommendation: { ...typography.body, lineHeight: 20 },
})
