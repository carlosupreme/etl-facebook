import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { colors, spacing, radius, typography } from '../theme/tokens'
import { GlassCard } from '../components/GlassCard'
import { DataTable } from '../components/DataTable'
import { useDb } from '../db/DbContext'

interface PresetQuery {
  key: string
  icon: string
  sql: string
}

const PRESETS: PresetQuery[] = [
  {
    key: 'topEngaging',
    icon: '🔥',
    sql: `SELECT p.post_id, p.content, p.reach_count, COUNT(i.interaction_id) AS interactions, ROUND(COUNT(i.interaction_id) * 100.0 / p.reach_count, 2) AS er FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id WHERE p.reach_count > 0 GROUP BY p.post_id ORDER BY interactions DESC LIMIT 10`,
  },
  {
    key: 'mostActive',
    icon: '👤',
    sql: `SELECT u.user_id, u.first_name || ' ' || u.last_name AS name, COUNT(a.log_id) AS events FROM users u JOIN activity_log a ON u.user_id = a.user_id GROUP BY u.user_id ORDER BY events DESC LIMIT 10`,
  },
  {
    key: 'privacyBreakdown',
    icon: '🔒',
    sql: `SELECT privacy, COUNT(*) AS count FROM posts WHERE privacy IS NOT NULL GROUP BY privacy ORDER BY count DESC`,
  },
  {
    key: 'adRoi',
    icon: '📊',
    sql: `SELECT c.campaign_id, c.objective, c.budget, m.impressions, m.clicks, m.spend, ROUND(m.spend * 1000.0 / m.impressions, 2) AS cpm, ROUND(m.clicks * 100.0 / m.impressions, 2) AS ctr FROM ad_campaigns c JOIN ad_metrics m ON c.campaign_id = m.campaign_id ORDER BY cpm DESC`,
  },
  {
    key: 'recentPosts',
    icon: '📝',
    sql: `SELECT post_id, author_id, media_type, privacy, reach_count, timestamp FROM posts ORDER BY timestamp DESC LIMIT 20`,
  },
  {
    key: 'lowReach',
    icon: '📉',
    sql: `SELECT post_id, media_type, reach_count, timestamp FROM posts WHERE reach_count < (SELECT AVG(reach_count) * 0.3 FROM posts) ORDER BY reach_count ASC LIMIT 10`,
  },
  {
    key: 'highCpm',
    icon: '💰',
    sql: `SELECT c.campaign_id, c.objective, ROUND(m.spend * 1000.0 / m.impressions, 2) AS cpm, m.spend, m.impressions FROM ad_campaigns c JOIN ad_metrics m ON c.campaign_id = m.campaign_id WHERE m.impressions > 0 ORDER BY cpm DESC LIMIT 10`,
  },
  {
    key: 'zeroInteractions',
    icon: '🤖',
    sql: `SELECT p.post_id, p.content, p.reach_count, p.media_type FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id WHERE i.interaction_id IS NULL ORDER BY p.reach_count DESC`,
  },
]

export default function QueriesScreen() {
  const { t } = useTranslation()
  const { db: dbCtx } = useDb()
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<any[] | null>(null)
  const [columns, setColumns] = useState<{ key: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedSql, setExpandedSql] = useState<string | null>(null)
  const [showSqlEditor, setShowSqlEditor] = useState(false)
  const [currentQuery, setCurrentQuery] = useState<string | null>(null)
  const [rowsPerPage] = useState(20)
  const [page, setPage] = useState(0)

  const getLabel = (key: string) =>
    t(`queries.labels.${key}`, key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))

  const getPresetName = (key: string) => t(`queries.presets.${key}.name`, key)

  const runQuery = useCallback(async (query: string, presetKey?: string) => {
    if (!dbCtx) return
    setLoading(true)
    setError('')
    setPage(0)
    try {
      const rows: any[] = await dbCtx.queryAll(query)
      if (rows.length > 0) {
        const keys = Object.keys(rows[0])
        setColumns(keys.map(k => ({ key: k, label: getLabel(k) })))
      } else {
        setColumns([])
      }
      setResult(rows)
      setCurrentQuery(presetKey ?? null)
    } catch (e: any) {
      setError(e.message ?? 'Query error')
      setResult(null)
    }
    setLoading(false)
  }, [dbCtx])

  const paginatedData = result?.slice(page * rowsPerPage, (page + 1) * rowsPerPage) ?? []
  const totalPages = result ? Math.ceil(result.length / rowsPerPage) : 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('queries.title')}</Text>
      <Text style={styles.subtitle}>{t('queries.subtitle')}</Text>

      <View style={styles.presetGrid}>
        {PRESETS.map((p) => {
          const isRunning = loading && currentQuery === p.key
          const isExpanded = expandedSql === p.key
          return (
            <GlassCard key={p.key} glow={isRunning ? 'amber' : undefined}
              style={[styles.presetCard, isRunning && styles.presetCardActive]}>
              <TouchableOpacity onPress={() => runQuery(p.sql, p.key)} disabled={loading} activeOpacity={0.7}>
                <View style={styles.presetHeader}>
                  <Text style={styles.presetIcon}>{p.icon}</Text>
                  <View style={styles.presetInfo}>
                    <Text style={styles.presetQuestion}>{getPresetName(p.key)}</Text>
                    <Text style={styles.presetDesc}>{t(`queries.presets.${p.key}.description`)}</Text>
                  </View>
                  {isRunning ? (
                    <ActivityIndicator color={colors.accent.amber} size="small" />
                  ) : (
                    <Text style={styles.runArrow}>▶</Text>
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.presetMeta}>
                <Text style={styles.presetGoal}>{t(`queries.presets.${p.key}.goal`)}</Text>
                <TouchableOpacity onPress={() => setExpandedSql(isExpanded ? null : p.key)}>
                  <Text style={styles.showSqlBtn}>{isExpanded ? t('queries.hideSql') : t('queries.showSql')}</Text>
                </TouchableOpacity>
              </View>
              {isExpanded && (
                <View style={styles.sqlBlock}>
                  <Text style={styles.sqlText}>{p.sql}</Text>
                </View>
              )}
            </GlassCard>
          )
        })}
      </View>

      <TouchableOpacity style={styles.advancedToggle}
        onPress={() => setShowSqlEditor(!showSqlEditor)}>
        <Text style={styles.advancedToggleText}>
          {showSqlEditor ? t('queries.hideEditor') : t('queries.advancedLabel')}
        </Text>
      </TouchableOpacity>

      {showSqlEditor && (
        <View>
          <TextInput
            style={styles.input}
            multiline
            placeholder={t('queries.sqlPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            value={sql}
            onChangeText={setSql}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.runBtn} onPress={() => sql && runQuery(sql)} disabled={loading}>
              <Text style={styles.runBtnText}>{t('queries.run')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn}
              onPress={() => { setSql(''); setResult(null); setError(''); setCurrentQuery(null) }}>
              <Text style={styles.clearBtnText}>{t('queries.clear')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error ? (
        <GlassCard glow="magenta" style={{ marginBottom: spacing.md, padding: spacing.md }}>
          <Text style={[typography.body, { color: colors.status.critical }]}>{error}</Text>
        </GlassCard>
      ) : null}

      {loading && !currentQuery && (
        <View style={{ alignItems: 'center', marginVertical: spacing.lg }}>
          <ActivityIndicator color={colors.accent.amber} size="large" />
          <Text style={{ ...typography.body, marginTop: spacing.sm, color: colors.accent.amber }}>
            {t('queries.running')}
          </Text>
        </View>
      )}

      {result !== null && !loading && (
        <View>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>
              {currentQuery ? getPresetName(currentQuery) : t('queries.results')}
            </Text>
            <Text style={styles.resultMeta}>
              {result.length} {t('queries.rows')}
              {totalPages > 1 && ` · ${t('queries.page', { current: page + 1, total: totalPages })}`}
            </Text>
          </View>
          <DataTable columns={columns} data={paginatedData} />
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                onPress={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                <Text style={styles.pageBtnText}>{t('queries.prev')}</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>{page + 1} / {totalPages}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
                onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
              >
                <Text style={styles.pageBtnText}>{t('queries.next')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, marginBottom: spacing.lg },
  presetGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  presetCard: {
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  presetCardActive: {
    borderLeftColor: colors.accent.amber,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  presetIcon: { fontSize: 24, marginTop: 2 },
  presetInfo: { flex: 1 },
  presetQuestion: { ...typography.h3, marginBottom: 2 },
  presetDesc: { ...typography.small, color: colors.text.secondary, lineHeight: 16 },
  runArrow: { fontSize: 16, color: colors.accent.amber, marginTop: 4 },
  presetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  presetGoal: { ...typography.small, color: colors.accent.cyan, flex: 1 },
  showSqlBtn: { ...typography.small, color: colors.text.tertiary, marginLeft: spacing.sm },
  sqlBlock: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  sqlText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
  advancedToggle: {
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  advancedToggleText: { ...typography.body, color: colors.accent.amber },
  input: {
    backgroundColor: colors.glass.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
    color: colors.text.primary,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  runBtn: {
    backgroundColor: colors.accent.amber,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  runBtnText: { ...typography.h3, color: colors.space.bg },
  clearBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  clearBtnText: { ...typography.body, color: colors.text.secondary },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  resultTitle: { ...typography.h2 },
  resultMeta: { ...typography.small, color: colors.text.tertiary },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pageBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.glass.card,
  },
  pageBtnDisabled: { opacity: 0.3 },
  pageBtnText: { ...typography.body, fontSize: 13, color: colors.text.secondary },
  pageInfo: { ...typography.body, color: colors.text.tertiary },
})
