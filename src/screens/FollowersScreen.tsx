import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../theme/tokens'
import { KpiTile } from '../components/KpiTile'
import { ChartContainer } from '../components/ChartContainer'
import { SectionHeader } from '../components/SectionHeader'
import { GlassCard } from '../components/GlassCard'
import { BarChart } from '../components/charts'
import { useDbQuery } from '../hooks/useDbQuery'

export default function FollowersScreen() {
  const { t } = useTranslation()

  const { data: kpis } = useDbQuery('follKpis', async (db) => {
    const total = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM followers')
    const mutual = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM followers f1
       JOIN followers f2 ON f1.follower_id = f2.followed_id AND f1.followed_id = f2.follower_id
       WHERE f1.follower_id < f1.followed_id`
    )
    const noFollowers = await db.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM users u
       WHERE u.user_id NOT IN (SELECT DISTINCT followed_id FROM followers)`
    )
    const avg = await db.queryOne<{ avg: number }>(
      `SELECT ROUND(COUNT(*) * 1.0 / (SELECT COUNT(*) FROM users), 1) AS avg FROM followers`
    )
    return [
      { label: t('followers.totalFollowers'), value: (total?.c ?? 0).toLocaleString() },
      { label: t('followers.mutualFollows'), value: (mutual?.c ?? 0).toLocaleString() },
      { label: t('followers.usersNoFollowers'), value: (noFollowers?.c ?? 0).toLocaleString() },
      { label: t('followers.avgFollowersPerUser'), value: avg?.avg ?? 0 },
    ]
  })

  const { data: topFollowed } = useDbQuery('topFollowed', async (db) => {
    const rows = await db.queryAll<{ followed_id: number; nombre: string; seguidores: number }>(
      `SELECT f.followed_id,
              u.first_name || ' ' || u.last_name AS nombre,
              COUNT(*) AS seguidores
       FROM followers f
       JOIN users u ON f.followed_id = u.user_id
       GROUP BY f.followed_id
       ORDER BY seguidores DESC
       LIMIT 15`
    )
    return (rows ?? []).map(r => ({ label: r.nombre ?? `User ${r.followed_id}`, value: r.seguidores ?? 0 }))
  })

  const { data: followerDist } = useDbQuery('follDist', async (db) => {
    const rows = await db.queryAll<{ bucket: string; users: number }>(
      `SELECT
         CASE
           WHEN seg_count = 0 THEN '0'
           WHEN seg_count BETWEEN 1 AND 5 THEN '1-5'
           WHEN seg_count BETWEEN 6 AND 20 THEN '6-20'
           WHEN seg_count BETWEEN 21 AND 50 THEN '21-50'
           WHEN seg_count BETWEEN 51 AND 100 THEN '51-100'
           ELSE '100+'
         END AS bucket,
         COUNT(*) AS users
       FROM (
         SELECT u.user_id, COUNT(f.follower_id) AS seg_count
         FROM users u
         LEFT JOIN followers f ON u.user_id = f.followed_id
         GROUP BY u.user_id
       )
       GROUP BY bucket
       ORDER BY MIN(seg_count)`
    )
    return (rows ?? []).map(r => ({ label: r.bucket ?? '0', value: r.users ?? 0 }))
  })

  const { data: topFollowing } = useDbQuery('topFollowing', async (db) => {
    const rows = await db.queryAll<{ follower_id: number; nombre: string; seguidos: number }>(
      `SELECT f.follower_id,
              u.first_name || ' ' || u.last_name AS nombre,
              COUNT(*) AS seguidos
       FROM followers f
       JOIN users u ON f.follower_id = u.user_id
       GROUP BY f.follower_id
       ORDER BY seguidos DESC
       LIMIT 10`
    )
    return (rows ?? []).map(r => ({ label: r.nombre ?? `User ${r.follower_id}`, value: r.seguidos ?? 0 }))
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('followers.title')}</Text>
      <Text style={styles.subtitle}>{t('followers.subtitle')}</Text>

      <View style={styles.kpiRow}>
        {kpis?.slice(0, 2).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>
      <View style={styles.kpiRow}>
        {kpis?.slice(2, 4).map((k, i) => <KpiTile key={i} label={k.label} value={k.value} />)}
      </View>

      <ChartContainer title={t('followers.topFollowedTitle')} height={220}>
        <BarChart
          data={topFollowed ?? []}
          height={220}
        />
      </ChartContainer>

      <ChartContainer title={t('followers.followerDistribution')} height={200}>
        <BarChart
          data={followerDist ?? []}
          height={200}
        />
      </ChartContainer>

      <SectionHeader title={t('followers.topFollowed') + ' (siguiendo más)'} />
      <GlassCard style={styles.tableCard}>
        {(topFollowing ?? []).map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.rank}>#{i + 1}</Text>
            <Text style={styles.userName} numberOfLines={1}>{row.label}</Text>
            <Text style={styles.count}>{row.value.toLocaleString()}</Text>
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
