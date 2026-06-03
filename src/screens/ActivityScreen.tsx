import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../theme/tokens'
import { KpiTile } from '../components/KpiTile'
import { ChartContainer } from '../components/ChartContainer'
import { SectionHeader } from '../components/SectionHeader'
import { WeaknessBadge } from '../components/WeaknessBadge'
import { BarChart, LineChart } from '../components/charts'
import { useDbQuery } from '../hooks/useDbQuery'

export default function ActivityScreen() {
  const { t } = useTranslation()

  const { data: kpis } = useDbQuery('actKpis', async (db) => {
    const events = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM activity_log')
    const logins = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM activity_log WHERE action='login'")
    const clicks = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM activity_log WHERE action='external_click'")
    const peak = await db.queryOne<{ hour: string; c: number }>(
      `SELECT strftime('%H', timestamp) AS hour, COUNT(*) AS c
       FROM activity_log GROUP BY hour ORDER BY c DESC LIMIT 1`
    )
    return [
      { label: t('activity.totalEvents'), value: events?.c ?? 0 },
      { label: t('activity.logins'), value: logins?.c ?? 0 },
      { label: t('activity.externalClicks'), value: clicks?.c ?? 0 },
      { label: t('activity.peakHours'), value: `${peak?.hour ?? '—'}:00` },
    ]
  })

  const { data: hourly } = useDbQuery('hourly', async (db) => {
    const rows = await db.queryAll<{ hour: number; count: number }>(
      `SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour, COUNT(*) AS count
       FROM activity_log GROUP BY hour ORDER BY hour`
    )
    return (rows ?? []).map(r => ({ hour: r.hour ?? 0, count: r.count ?? 0 }))
  })

  const { data: loginClicks } = useDbQuery('loginClicks', async (db) => {
    const rows = await db.queryAll<{ date: string; logins: number; clicks: number }>(
      `SELECT strftime('%Y-%m-%d', timestamp) AS date,
              SUM(CASE WHEN action = 'login' THEN 1 ELSE 0 END) AS logins,
              SUM(CASE WHEN action = 'external_click' THEN 1 ELSE 0 END) AS clicks
       FROM activity_log WHERE action IN ('login', 'external_click')
       GROUP BY date ORDER BY date LIMIT 30`
    )
    return (rows ?? []).map(r => ({ date: r.date ?? '', logins: r.logins ?? 0, clicks: r.clicks ?? 0 }))
  })

  const { data: registrations } = useDbQuery('registrations', async (db) => {
    const rows = await db.queryAll<{ date: string; count: number }>(
      `SELECT strftime('%Y-%m-%d', timestamp) AS date, COUNT(*) AS count
       FROM activity_log WHERE action = 'register'
       GROUP BY date ORDER BY date LIMIT 30`
    )
    return (rows ?? []).map(r => ({ date: r.date ?? '', count: r.count ?? 0 }))
  })

  const { data: churn } = useDbQuery('churnRisk', async (db) => {
    const r = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM users u WHERE u.user_id NOT IN (
        SELECT DISTINCT user_id FROM activity_log
        WHERE timestamp >= date('now', '-6 months', '+6 years')
      )`
    )
    return r?.c ?? 0
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('activity.title')}</Text>
      <View style={styles.kpiRow}>
        {kpis?.slice(0, 2).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(2, 4).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>

      <ChartContainer title={t('activity.activityByHour')} height={200}>
        <BarChart
          data={hourly?.map(d => ({ label: `${d.hour}h`, value: d.count })) ?? []}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('activity.loginVsClicks')} height={200}>
        <LineChart
          labels={loginClicks?.map(d => d.date.slice(5)) ?? []}
          series={[
            { label: 'Logins', values: loginClicks?.map(d => d.logins) ?? [] },
            { label: 'Clicks', values: loginClicks?.map(d => d.clicks) ?? [] },
          ]}
          height={200}
        />
      </ChartContainer>

      <ChartContainer title={t('activity.registrations')} height={200}>
        <BarChart
          data={registrations?.map(d => ({ label: d.date.slice(5), value: d.count })) ?? []}
          height={200}
        />
      </ChartContainer>

      <SectionHeader title={t('weaknesses.title')} />
      <WeaknessBadge severity="warning" label={`${churn} ${t('activity.churnRisk')}`} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.lg },
  kpiRow: { flexDirection: 'row', gap: '3%', marginBottom: spacing.sm },
})
