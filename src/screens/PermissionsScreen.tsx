import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../theme/tokens'
import { KpiTile } from '../components/KpiTile'
import { ChartContainer } from '../components/ChartContainer'
import { SectionHeader } from '../components/SectionHeader'
import { GlassCard } from '../components/GlassCard'
import { BarChart, PieChart } from '../components/charts'
import { useDbQuery } from '../hooks/useDbQuery'

export default function PermissionsScreen() {
  const { t } = useTranslation()

  const { data: kpis } = useDbQuery('permKpis', async (db) => {
    const total = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM app_permissions')
    const apps = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM third_party_apps')
    const usersWithApps = await db.queryOne<{ c: number }>('SELECT COUNT(DISTINCT user_id) AS c FROM app_permissions')
    const avg = await db.queryOne<{ avg: number }>(
      'SELECT ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT user_id), 1) AS avg FROM app_permissions'
    )
    return [
      { label: t('permissions.totalPermissions'), value: (total?.c ?? 0).toLocaleString() },
      { label: t('permissions.appsConnected'), value: (apps?.c ?? 0).toLocaleString() },
      { label: t('permissions.usersWithApps'), value: (usersWithApps?.c ?? 0).toLocaleString() },
      { label: t('permissions.avgPerUser'), value: avg?.avg ?? 0 },
    ]
  })

  const { data: topApps } = useDbQuery('permTopApps', async (db) => {
    const rows = await db.queryAll<{ app_name: string; total_permisos: number }>(
      `SELECT ta.name AS app_name, COUNT(ap.permission_id) AS total_permisos
       FROM third_party_apps ta
       JOIN app_permissions ap ON ta.app_id = ap.app_id
       GROUP BY ta.app_id ORDER BY total_permisos DESC LIMIT 10`
    )
    return (rows ?? []).map(r => ({ label: r.app_name ?? 'Unknown', value: r.total_permisos ?? 0 }))
  })

  const { data: permTypes } = useDbQuery('permTypes', async (db) => {
    const rows = await db.queryAll<{ permission_type: string; count: number }>(
      `SELECT permission_type, COUNT(*) AS count
       FROM app_permissions
       GROUP BY permission_type ORDER BY count DESC`
    )
    return (rows ?? []).map(r => ({ label: r.permission_type ?? 'unknown', value: r.count ?? 0 }))
  })

  const { data: topUsers } = useDbQuery('permTopUsers', async (db) => {
    const rows = await db.queryAll<{ nombre: string; apps: number }>(
      `SELECT u.first_name || ' ' || u.last_name AS nombre,
              COUNT(DISTINCT ap.app_id) AS apps
       FROM app_permissions ap JOIN users u ON ap.user_id = u.user_id
       GROUP BY ap.user_id ORDER BY apps DESC LIMIT 10`
    )
    return (rows ?? []).map(r => ({ label: r.nombre ?? 'Unknown', value: r.apps ?? 0 }))
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('permissions.title')}</Text>
      <Text style={styles.subtitle}>{t('permissions.subtitle')}</Text>

      <View style={styles.kpiRow}>
        {kpis?.slice(0, 2).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(2, 4).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>

      <ChartContainer title={t('permissions.topAppsTitle')} height={220}>
        <BarChart data={topApps ?? []} height={220} />
      </ChartContainer>

      <ChartContainer title={t('permissions.permissionTypes')} height={200}>
        <PieChart data={permTypes ?? []} height={200} />
      </ChartContainer>

      <SectionHeader title={t('permissions.highRiskUsers')} />
      <GlassCard style={styles.tableCard}>
        {(topUsers ?? []).map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.rank}>#{i + 1}</Text>
            <Text style={styles.userName} numberOfLines={1}>{row.label}</Text>
            <Text style={styles.count}>{row.value}</Text>
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
  subtitle: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tableCard: { marginBottom: spacing.md },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.glass.cardBorder,
  },
  rank: { ...typography.small, color: colors.text.tertiary, width: 28 },
  userName: { ...typography.body, flex: 1 },
  count: { ...typography.body, color: colors.accent.amber, fontWeight: '700' },
})
