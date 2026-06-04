import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, Share, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, typography } from '../theme/tokens'
import { GlassCard } from '../components/GlassCard'
import { BarChart, PieChart } from '../components/charts'
import { useDbQuery, refreshAllQueries, getActiveQueries } from '../hooks/useDbQuery'
import KpiBuilderScreen from './KpiBuilderScreen'
import { kpiStore, type KpiDefinition, type KpiCategory } from '../services/KpiStore'
import { evalTargetExpression } from '../services/evalExpression'
import { exportKpiPdf, type KpiExportItem } from '../services/pdfExport'

let reloadKey = 0

type ViewMode = 'catalog' | 'builder'

export default function KpiCatalogScreen() {
  const { t, i18n } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [kpiDefs, setKpiDefs] = useState<KpiDefinition[]>([])
  const [categories, setCategories] = useState<KpiCategory[]>([])
  const [filterCat, setFilterCat] = useState<string>('all')
  const [isReloading, setIsReloading] = useState(false)
  const [reloadPct, setReloadPct] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const progressAnim = useRef(new Animated.Value(0)).current
  const reloadOpacity = useRef(new Animated.Value(0)).current
  const [curReloadKey, setCurReloadKey] = useState(0)

  useEffect(() => {
    const unsub = kpiStore.onChange(() => {
      setKpiDefs(kpiStore.getAllKpis())
      setCategories(kpiStore.getCategories())
      setInitialized(kpiStore.isInitialized)
    })
    if (!kpiStore.isInitialized) void kpiStore.init()
    if (kpiStore.isInitialized) {
      setKpiDefs(kpiStore.getAllKpis())
      setCategories(kpiStore.getCategories())
      setInitialized(true)
    }
    return () => { void unsub() }
  }, [])

  const dbQuery = useDbQuery(`kpiCatalogAll_${curReloadKey}`, async (db) => {
    const totalPosts = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM posts')
    const totalUsers = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM users')
    const yearRange = await db.queryOne<{ min: number; max: number }>(
      `SELECT CAST(strftime('%Y', MIN(timestamp)) AS INTEGER) AS min, CAST(strftime('%Y', MAX(timestamp)) AS INTEGER) AS max FROM posts WHERE timestamp IS NOT NULL`
    )
    const years = Math.max(1, (yearRange?.max ?? 2024) - (yearRange?.min ?? 2021) + 1)
    const postsPerYear = Math.round((totalPosts?.c ?? 0) / years)
    const avgReach = await db.queryOne<{ avg: number }>('SELECT ROUND(AVG(reach_count), 0) AS avg FROM posts WHERE reach_count IS NOT NULL')
    const topMedia = await db.queryOne<{ media_type: string; c: number }>('SELECT media_type, COUNT(*) AS c FROM posts WHERE media_type IS NOT NULL GROUP BY media_type ORDER BY c DESC LIMIT 1')
    const topPrivacy = await db.queryOne<{ privacy: string; c: number }>('SELECT privacy, COUNT(*) AS c FROM posts WHERE privacy IS NOT NULL GROUP BY privacy ORDER BY c DESC LIMIT 1')
    const er = await db.queryOne<{ avg: number }>('SELECT ROUND(AVG(er), 2) AS avg FROM (SELECT COUNT(i.interaction_id) * 100.0 / p.reach_count AS er FROM posts p LEFT JOIN interactions i ON p.post_id = i.post_id WHERE p.reach_count > 0 GROUP BY p.post_id)')
    const cpm = await db.queryOne<{ avg: number }>('SELECT ROUND(AVG(spend * 1000.0 / NULLIF(impressions, 0)), 2) AS avg FROM ad_metrics WHERE impressions > 0')
    const ctr = await db.queryOne<{ avg: number }>('SELECT ROUND(AVG(clicks * 100.0 / NULLIF(impressions, 0)), 2) AS avg FROM ad_metrics WHERE impressions > 0')
    const cpc = await db.queryOne<{ avg: number }>('SELECT ROUND(SUM(spend) / NULLIF(SUM(clicks), 0), 2) AS avg FROM ad_metrics')
    const freq = await db.queryOne<{ freq: number }>('SELECT ROUND(AVG(m.impressions / NULLIF(p.avg_reach, 0)), 2) AS freq FROM ad_metrics m CROSS JOIN (SELECT AVG(reach_count) AS avg_reach FROM posts WHERE reach_count > 0) p')
    const revenue = await db.queryOne<{ rev: number }>("SELECT ROUND(SUM(CASE c.objective WHEN 'conversions' THEN m.clicks * 5.0 WHEN 'brand_awareness' THEN m.impressions * 0.01 ELSE m.clicks * 2.0 END), 0) AS rev FROM ad_metrics m JOIN ad_campaigns c ON m.campaign_id = c.campaign_id")
    const totalSpend = await db.queryOne<{ s: number }>('SELECT ROUND(SUM(spend), 0) AS s FROM ad_metrics')
    const spendVal = (totalSpend?.s ?? 1)
    const roas = ((revenue?.rev ?? 0) / spendVal).toFixed(2)
    const churn = await db.queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE user_id NOT IN (SELECT DISTINCT user_id FROM activity_log WHERE timestamp >= date('now', '-6 months', '+6 years'))")
    const dormant = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM pages WHERE page_id NOT IN (SELECT DISTINCT page_id FROM posts WHERE page_id IS NOT NULL)')
    const fatigue = await db.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM ad_metrics m CROSS JOIN (SELECT AVG(reach_count) AS r FROM posts WHERE reach_count > 0) p WHERE m.impressions > 0 AND (m.impressions / NULLIF(p.r, 0)) > 4')

    return {
      totalPosts: totalPosts?.c ?? 0, postsPerYear, avgReach: avgReach?.avg ?? 0,
      topMedia: topMedia?.media_type ?? '—', topMediaPct: topMedia ? Math.round((topMedia.c / (totalPosts?.c ?? 1)) * 100) : 0,
      topPrivacy: topPrivacy?.privacy ?? '—', topPrivacyPct: topPrivacy ? Math.round((topPrivacy.c / (totalPosts?.c ?? 1)) * 100) : 0,
      engagementRate: er?.avg ?? 0, cpm: cpm?.avg ?? 0, ctr: ctr?.avg ?? 0, cpc: cpc?.avg ?? 0,
      frequency: freq?.freq ?? 0, roas,
      churnPct: totalUsers?.c ? Math.round(((churn?.c ?? 0) / (totalUsers?.c ?? 1)) * 100) : 0,
      dormant: dormant?.c ?? 0, fatigue: fatigue?.c ?? 0,
    }
  })

  const kv = dbQuery.data

  const getKpiValue = (id: string): { value: string; status: 'good' | 'ok' | 'bad'; numericValue: number } | null => {
    if (!kv) return null
    const kpi = kpiDefs.find(k => k.id === id)
    const rawValues: Record<string, { num: number; formatted: string }> = {
      totalPosts: { num: kv.totalPosts ?? 0, formatted: (kv.totalPosts ?? 0).toLocaleString() },
      postsPerYear: { num: kv.postsPerYear ?? 0, formatted: `${kv.postsPerYear ?? 0}/yr` },
      avgReach: { num: kv.avgReach ?? 0, formatted: (kv.avgReach ?? 0).toLocaleString() },
      topMedia: { num: kv.topMediaPct ?? 0, formatted: `${kv.topMedia ?? '—'} (${kv.topMediaPct ?? 0}%)` },
      privacyLeader: { num: kv.topPrivacyPct ?? 0, formatted: `${kv.topPrivacy ?? '—'} (${kv.topPrivacyPct ?? 0}%)` },
      engagementRate: { num: kv.engagementRate ?? 0, formatted: `${kv.engagementRate ?? 0}%` },
      cpm: { num: kv.cpm ?? 0, formatted: `$${(kv.cpm ?? 0).toFixed(2)}` },
      ctr: { num: kv.ctr ?? 0, formatted: `${(kv.ctr ?? 0).toFixed(2)}%` },
      cpc: { num: kv.cpc ?? 0, formatted: `$${(kv.cpc ?? 0).toFixed(2)}` },
      frequency: { num: kv.frequency ?? 0, formatted: `${kv.frequency ?? 0}x` },
      roas: { num: parseFloat(kv.roas ?? '0'), formatted: `${kv.roas ?? '0.00'}x` },
      churnRisk: { num: kv.churnPct ?? 0, formatted: `${kv.churnPct ?? 0}%` },
      dormantPages: { num: kv.dormant ?? 0, formatted: `${kv.dormant ?? 0}` },
      adFatigue: { num: kv.fatigue ?? 0, formatted: `${kv.fatigue ?? 0}` },
    }

    const raw = rawValues[id]
    if (!raw) return { value: '—', status: 'ok', numericValue: 0 }

    if (kpi?.targetExpr) {
      try {
        const pass = evalTargetExpression(kpi.targetExpr, { value: raw.num, pct: kv.churnPct ?? 0, trend: 0 })
        return { value: raw.formatted, status: pass ? 'good' : 'bad', numericValue: raw.num }
      } catch {}
    }

    const fallbacks: Record<string, 'good' | 'ok' | 'bad'> = {
      totalPosts: raw.num > 50000 ? 'good' : 'ok',
      postsPerYear: raw.num >= 12 ? 'good' : 'ok',
      avgReach: raw.num >= 4000 ? 'good' : raw.num >= 2000 ? 'ok' : 'bad',
      engagementRate: raw.num >= 2 ? 'good' : raw.num >= 1 ? 'ok' : 'bad',
      cpm: raw.num < 8 ? 'good' : raw.num < 12 ? 'ok' : 'bad',
      ctr: raw.num >= 1.5 ? 'good' : raw.num >= 0.5 ? 'ok' : 'bad',
      cpc: raw.num < 0.5 ? 'good' : raw.num < 1 ? 'ok' : 'bad',
      frequency: raw.num < 4 ? 'good' : 'bad',
      roas: raw.num >= 2 ? 'good' : raw.num >= 1 ? 'ok' : 'bad',
      churnRisk: raw.num < 10 ? 'good' : raw.num < 25 ? 'ok' : 'bad',
      dormantPages: raw.num === 0 ? 'good' : raw.num < 5 ? 'ok' : 'bad',
      adFatigue: raw.num === 0 ? 'good' : raw.num < 3 ? 'ok' : 'bad',
      topMedia: 'good',
      privacyLeader: 'good',
    }
    return { value: raw.formatted, status: fallbacks[id] ?? 'ok', numericValue: raw.num }
  }

  const handleReload = () => {
    if (isReloading) return
    setIsReloading(true)
    setReloadPct(0)
    progressAnim.setValue(0)
    reloadOpacity.setValue(0)

    Animated.parallel([
      Animated.timing(reloadOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(progressAnim, { toValue: 0.15, duration: 400, useNativeDriver: false }),
    ]).start()

    void kpiStore.reloadFromDb()
    reloadKey++
    setCurReloadKey(reloadKey)
    refreshAllQueries()

    const totalQ = 5
    let doneQ = 0
    const tick = () => {
      const active = getActiveQueries()
      doneQ = Math.max(doneQ, totalQ - active)
      const pct = Math.min(0.9, (doneQ / totalQ) + 0.1)
      setReloadPct(Math.round(pct * 100))
      Animated.timing(progressAnim, { toValue: pct, duration: 300, useNativeDriver: false }).start()

      if (active === 0 && doneQ >= totalQ) {
        clearInterval(interval)
        setKpiDefs(kpiStore.getAllKpis())
        setCategories(kpiStore.getCategories())
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(progressAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
            Animated.timing(reloadOpacity, { toValue: 0, duration: 300, useNativeDriver: false }),
          ]).start(() => {
            setIsReloading(false)
            setReloadPct(0)
            progressAnim.setValue(0)
          })
        }, 400)
      }
    }
    const interval = setInterval(tick, 100)
  }

  const { data: mediaDist, loading: mediaLoading } = useDbQuery(`kpiMediaDist_${curReloadKey}`, async (db) => {
    const rows = await db.queryAll<{ media_type: string; count: number }>('SELECT media_type, COUNT(*) AS count FROM posts WHERE media_type IS NOT NULL GROUP BY media_type ORDER BY count DESC')
    return (rows ?? []).map(r => ({ label: r.media_type ?? 'unknown', value: r.count ?? 0 }))
  })

  const { data: privacyDist, loading: privacyLoading } = useDbQuery(`kpiPrivacyDist_${curReloadKey}`, async (db) => {
    const rows = await db.queryAll<{ privacy: string; count: number }>('SELECT privacy, COUNT(*) AS count FROM posts WHERE privacy IS NOT NULL GROUP BY privacy ORDER BY count DESC')
    return (rows ?? []).map(r => ({ label: r.privacy ?? 'unknown', value: r.count ?? 0 }))
  })

  const { data: postsTrend, loading: trendLoading } = useDbQuery(`kpiPostsTrend_${curReloadKey}`, async (db) => {
    const rows = await db.queryAll<{ year: string; count: number }>("SELECT strftime('%Y', timestamp) AS year, COUNT(*) AS count FROM posts WHERE timestamp IS NOT NULL GROUP BY year ORDER BY year")
    const safe = rows ?? []
    return { labels: safe.map(r => r.year ?? ''), values: safe.map(r => r.count ?? 0) }
  })

  const { data: cpmByObjective, loading: cpmLoading } = useDbQuery(`kpiCpm_${curReloadKey}`, async (db) => {
    const rows = await db.queryAll<{ objective: string; cpm: number }>('SELECT c.objective, ROUND(AVG(m.spend * 1000.0 / NULLIF(m.impressions, 0)), 2) AS cpm FROM ad_campaigns c JOIN ad_metrics m ON c.campaign_id = m.campaign_id WHERE m.impressions > 0 GROUP BY c.objective')
    return (rows ?? []).map(r => ({ label: r.objective ?? 'unknown', value: r.cpm ?? 0 }))
  })

  const buildExportJson = () => ({
    exportedAt: new Date().toISOString(), language: i18n.language as 'en' | 'es',
    kpis: kpiDefs.map(kpi => {
      const vr = getKpiValue(kpi.id)
      return {
        id: kpi.id, icon: kpi.icon, name: kpi.name, description: kpi.description,
        formula: kpi.formula, target: kpi.goodValue, query: kpi.query,
        targetExpression: kpi.targetExpr, categoryId: kpi.categoryId,
        currentValue: vr?.value ?? null, status: vr?.status ?? null,
      }
    }),
  })

  const handleExportPdf = async () => {
    const items: KpiExportItem[] = kpiDefs.map(kpi => {
      const vr = getKpiValue(kpi.id)
      return {
        id: kpi.id, icon: kpi.icon, name: kpi.name,
        description: kpi.description, formula: kpi.formula,
        target: kpi.goodValue, categoryId: kpi.categoryId,
        currentValue: vr?.value ?? null, status: vr?.status ?? null,
      }
    })
    await exportKpiPdf(items)
  }

  const handleDownloadJson = async () => {
    const json = JSON.stringify(buildExportJson(), null, 2)
    const filename = `fb-studio-kpi-catalog-${i18n.language}.json`
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      await Share.share({ message: json, title: filename })
    }
  }

  if (!initialized || kpiDefs.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.space.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="hourglass-outline" size={48} color={colors.text.tertiary} />
        <Text style={[styles.title, { marginTop: spacing.md, color: colors.text.secondary }]}>{t('kpi_catalog.loading')}</Text>
      </View>
    )
  }

  if (viewMode === 'builder') {
    return (
      <View style={{ flex: 1 }}>
        <KpiBuilderScreen onReloadQueries={handleReload} />
        <View style={styles.backBar}>
          <TouchableOpacity onPress={() => setViewMode('catalog')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.accent.amber} />
            <Text style={styles.backBtnText}>{t('kpi_builder.backToCatalog')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const catMap = new Map(categories.map(c => [c.id, c]))
  const filtered = filterCat === 'all' ? kpiDefs : kpiDefs.filter(k => k.categoryId === filterCat)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('kpi_catalog.title')}</Text>
          <Text style={styles.subtitle}>{t('kpi_catalog.subtitle')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity onPress={handleReload} style={[styles.reloadBtn, isReloading && { opacity: 0.5 }]}>
            <Ionicons name={isReloading ? 'refresh-circle' : 'refresh-outline'} size={18} color={isReloading ? colors.accent.cyan : colors.accent.amber} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setViewMode('builder')} style={styles.builderBtn}>
            <Ionicons name="build-outline" size={18} color={colors.accent.cyan} />
            <Text style={styles.builderBtnText}>{t('kpi_builder.toggleBuilder')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportPdf} style={styles.exportBtn}>
            <Ionicons name="document-text-outline" size={18} color={colors.accent.magenta} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDownloadJson} style={styles.exportBtn}>
            <Ionicons name="download-outline" size={18} color={colors.accent.amber} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => setFilterCat('all')} style={[styles.filterBtn, filterCat === 'all' && styles.filterBtnActive]}>
            <Text style={[styles.filterText, filterCat === 'all' && styles.filterTextActive]}>{t('kpi_builder.allCategories')}</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity key={cat.id} onPress={() => setFilterCat(cat.id)} style={[styles.filterBtn, filterCat === cat.id && styles.filterBtnActive]}>
              <Ionicons name={cat.icon as any} size={14} color={filterCat === cat.id ? colors.accent.amber : colors.text.secondary} />
              <Text style={[styles.filterText, filterCat === cat.id && styles.filterTextActive]}>{t(cat.nameKey)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filtered.map((kpi) => {
        const isExpanded = expanded === kpi.id
        const vr = getKpiValue(kpi.id)
        const statusColor = vr?.status === 'good' ? colors.status.success : vr?.status === 'ok' ? colors.status.warning : colors.status.critical
        const statusLabel = vr?.status === 'good' ? t('kpi_catalog.statusHealthy') : vr?.status === 'ok' ? t('kpi_catalog.statusNeedsAttention') : t('kpi_catalog.statusRequiresAction')
        const cat = catMap.get(kpi.categoryId)

        return (
          <TouchableOpacity key={kpi.id} activeOpacity={0.85} onPress={() => setExpanded(isExpanded ? null : kpi.id)}>
            <GlassCard
              glow={isExpanded ? 'amber' : undefined}
              style={[styles.kpiCard, isExpanded && styles.kpiCardExpanded, { padding: 0, overflow: 'hidden' }]}
            >
              <View style={styles.cardInner}>
                {/* Status accent bar */}
                <View style={[styles.accentBar, { backgroundColor: statusColor }]} />

                <View style={styles.cardBody}>
                  {/* Meta row: category + status chip */}
                  <View style={styles.cardMeta}>
                    {cat && (
                      <View style={styles.categoryTag}>
                        <Ionicons name={cat.icon as any} size={10} color={colors.text.tertiary} />
                        <Text style={styles.categoryTagText}>{t(cat.nameKey)}</Text>
                      </View>
                    )}
                    <View style={[styles.statusChip, { backgroundColor: statusColor + '22' }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  {/* Main row: icon + name/desc + value */}
                  <View style={styles.kpiHeader}>
                    <Text style={styles.kpiIcon}>{kpi.icon}</Text>
                    <View style={styles.kpiInfo}>
                      <Text style={styles.kpiName}>{kpi.name}</Text>
                      {!!kpi.description && (
                        <Text style={styles.kpiDesc} numberOfLines={isExpanded ? undefined : 2}>{kpi.description}</Text>
                      )}
                    </View>
                    <View style={styles.kpiValueCol}>
                      <Text style={[styles.kpiValue, { color: statusColor }]}>{vr?.value ?? '—'}</Text>
                      <Text style={styles.kpiTargetHint} numberOfLines={1}>{kpi.goodValue}</Text>
                    </View>
                  </View>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      <View style={styles.divider} />

                      <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionBusinessGoal')}</Text>
                      <Text style={styles.bodyText}>{t(kpi.goalKey)}</Text>

                      <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionTarget')}</Text>
                      <View style={styles.targetRow}>
                        <Ionicons name="checkmark-circle-outline" size={14} color={colors.status.success} />
                        <Text style={[styles.bodyText, { color: colors.status.success }]}>{kpi.goodValue}</Text>
                      </View>

                      <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionCurrentStatus')}</Text>
                      {dbQuery.loading ? (
                        <View style={styles.loadingRow}>
                          <Ionicons name="hourglass-outline" size={16} color={colors.accent.amber} />
                          <Text style={[styles.bodyText, { color: colors.accent.amber }]}>{t('kpi_catalog.refreshing')}</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
                          <View style={[styles.statusDotLg, { backgroundColor: statusColor }]} />
                          <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                      )}

                      <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionFormula')}</Text>
                      <View style={styles.formulaBox}>
                        <Text style={styles.formulaText}>{kpi.formula}</Text>
                      </View>

                      {kpi.id === 'totalPosts' && postsTrend && postsTrend.labels.length > 0 && (
                        <View style={styles.chartWrapper}>
                          <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionYearOverYear')}</Text>
                          {trendLoading ? (
                            <View style={styles.chartPlaceholder}><Ionicons name="hourglass-outline" size={24} color={colors.text.tertiary} /></View>
                          ) : (
                            <BarChart data={postsTrend.values.map((v: number, i: number) => ({ label: postsTrend.labels[i], value: v }))} height={140} />
                          )}
                        </View>
                      )}
                      {kpi.id === 'topMedia' && mediaDist && mediaDist.length > 0 && (
                        <View style={styles.chartWrapper}>
                          <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionDistribution')}</Text>
                          {mediaLoading ? (
                            <View style={styles.chartPlaceholder}><Ionicons name="hourglass-outline" size={24} color={colors.text.tertiary} /></View>
                          ) : (
                            <PieChart data={mediaDist} height={140} innerRadius={20} />
                          )}
                        </View>
                      )}
                      {kpi.id === 'privacyLeader' && privacyDist && privacyDist.length > 0 && (
                        <View style={styles.chartWrapper}>
                          <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionBreakdown')}</Text>
                          {privacyLoading ? (
                            <View style={styles.chartPlaceholder}><Ionicons name="hourglass-outline" size={24} color={colors.text.tertiary} /></View>
                          ) : (
                            <PieChart data={privacyDist} height={140} innerRadius={20} />
                          )}
                        </View>
                      )}
                      {kpi.id === 'cpm' && cpmByObjective && cpmByObjective.length > 0 && (
                        <View style={styles.chartWrapper}>
                          <Text style={styles.sectionLabel}>{t('kpi_catalog.sectionCpmByObjective')}</Text>
                          {cpmLoading ? (
                            <View style={styles.chartPlaceholder}><Ionicons name="hourglass-outline" size={24} color={colors.text.tertiary} /></View>
                          ) : (
                            <BarChart data={cpmByObjective} height={140} />
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.expandHintRow}>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.text.tertiary}
                    />
                  </View>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )
      })}

      {isReloading && (
        <Animated.View style={[styles.reloadOverlay, { opacity: reloadOpacity }]}>
          <GlassCard glow="amber" style={styles.reloadCard}>
            <View style={styles.reloadHeader}>
              <Ionicons name="refresh-circle" size={20} color={colors.accent.amber} />
              <Text style={styles.reloadMessage}>{t('kpi_catalog.reloading')}</Text>
              <Text style={styles.reloadPct}>{reloadPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as any }]} />
            </View>
          </GlassCard>
        </Animated.View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, marginBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  reloadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(196,122,30,0.08)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: 'rgba(196,122,30,0.2)', marginTop: 2 },
  builderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(8,145,178,0.08)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: 'rgba(8,145,178,0.2)', marginTop: 2 },
  builderBtnText: { ...typography.small, color: colors.accent.cyan, fontWeight: '600' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(196,122,30,0.08)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: 'rgba(196,122,30,0.2)', marginTop: 2 },
  toolbar: { flexDirection: 'row', marginBottom: spacing.md },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, marginRight: spacing.xs, backgroundColor: 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  filterBtnActive: { borderColor: colors.accent.amber, backgroundColor: colors.accent.amber + '18' },
  filterText: { ...typography.small, color: colors.text.secondary },
  filterTextActive: { color: colors.accent.amber, fontWeight: '600' },

  // Card structure
  kpiCard: { marginBottom: spacing.sm },
  kpiCardExpanded: { borderColor: colors.glass.cardBorderActive },
  cardInner: { flexDirection: 'row' },
  accentBar: { width: 3 },
  cardBody: { flex: 1, padding: spacing.md },

  // Meta row
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  categoryTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryTagText: { fontSize: 10, fontWeight: '600', color: colors.text.tertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  statusChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },

  // Main header row
  kpiHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  kpiIcon: { fontSize: 22, marginTop: 1 },
  kpiInfo: { flex: 1 },
  kpiName: { fontSize: 15, fontWeight: '700', color: colors.text.primary, lineHeight: 20 },
  kpiDesc: { fontSize: 12, color: colors.text.secondary, marginTop: 4, lineHeight: 18 },
  kpiValueCol: { alignItems: 'flex-end', minWidth: 72 },
  kpiValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiTargetHint: { fontSize: 10, color: colors.text.tertiary, marginTop: 3, textAlign: 'right', maxWidth: 80 },

  // Chevron hint
  expandHintRow: { alignItems: 'center', marginTop: spacing.sm },

  // Expanded content
  expandedContent: { marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginBottom: spacing.sm },
  sectionLabel: { fontSize: 10, color: colors.accent.amber, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1.2 },
  bodyText: { fontSize: 13, color: colors.text.secondary, lineHeight: 20 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, alignSelf: 'flex-start' },
  statusDotLg: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontSize: 13, fontWeight: '600' },
  formulaBox: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: radius.sm, padding: spacing.sm, borderLeftWidth: 2, borderLeftColor: 'rgba(0,0,0,0.12)' },
  formulaText: { fontFamily: 'monospace', fontSize: 12, color: colors.text.tertiary, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chartWrapper: { marginVertical: spacing.sm },
  chartPlaceholder: { height: 140, alignItems: 'center', justifyContent: 'center' },

  // Nav / overlay
  backBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.space.bg, borderTopWidth: 1, borderTopColor: colors.glass.cardBorder, padding: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  backBtnText: { ...typography.body, color: colors.accent.amber, fontWeight: '600' },
  reloadOverlay: { position: 'absolute', bottom: spacing.xl, left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  reloadCard: { width: '100%', maxWidth: 400, padding: spacing.md },
  reloadHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  reloadMessage: { ...typography.small, color: colors.text.primary, flex: 1 },
  reloadPct: { ...typography.small, color: colors.accent.amber, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: radius.full, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.accent.amber },
})
