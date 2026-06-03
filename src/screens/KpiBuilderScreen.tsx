import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, Share, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, typography } from '../theme/tokens'
import { GlassCard } from '../components/GlassCard'
import { kpiStore, DEFAULT_CATEGORIES, type KpiDefinition, type KpiCategory } from '../services/KpiStore'
import { evalTargetExpression, validateExpression, getExpressionHint } from '../services/evalExpression'
import { useTranslation } from 'react-i18next'

type ViewMode = 'list' | 'create' | 'edit' | 'detail' | 'categories' | 'createCategory'

interface KpiBuilderScreenProps {
  onReloadQueries?: () => void
}

export default function KpiBuilderScreen({ onReloadQueries }: KpiBuilderScreenProps) {
  const { t } = useTranslation()
  const [kpis, setKpis] = useState<KpiDefinition[]>(kpiStore.getAllKpis())
  const [categories, setCategories] = useState<KpiCategory[]>(kpiStore.getCategories())
  const [mode, setMode] = useState<ViewMode>('list')
  const [selectedKpi, setSelectedKpi] = useState<KpiDefinition | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')

  // Form state
  const [formName, setFormName] = useState('')
  const [formIcon, setFormIcon] = useState('📊')
  const [formDescription, setFormDescription] = useState('')
  const [formFormula, setFormFormula] = useState('')
  const [formQuery, setFormQuery] = useState('')
  const [formTarget, setFormTarget] = useState('')
  const [formGoodValue, setFormGoodValue] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Per-field validation errors
  const [nameError, setNameError] = useState<string | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [targetError, setTargetError] = useState<string | null>(null)

  // Validation feedback
  const [queryValidated, setQueryValidated] = useState(false)
  const [targetValidated, setTargetValidated] = useState(false)

  // Category form
  const [catFormName, setCatFormName] = useState('')
  const [catFormIcon, setCatFormIcon] = useState('list-outline')

  // Reload state
  const [isReloading, setIsReloading] = useState(false)
  const [reloadProgress, setReloadProgress] = useState({ current: 0, total: 1, message: '' })
  const progressAnim = useRef(new Animated.Value(0)).current
  const reloadOpacity = useRef(new Animated.Value(0)).current

  const refresh = useCallback(() => {
    setKpis(kpiStore.getAllKpis())
    setCategories(kpiStore.getCategories())
  }, [])

  useEffect(() => {
    if (!kpiStore.isInitialized) void kpiStore.init()
    refresh()
    const unsub = kpiStore.onChange(refresh)
    const unsubProgress = kpiStore.onProgress((p) => {
      setReloadProgress(p)
      const pct = p.total > 0 ? p.current / p.total : 0
      Animated.timing(progressAnim, { toValue: pct, duration: 300, useNativeDriver: false }).start()
      if (p.current === 1) {
        Animated.timing(reloadOpacity, { toValue: 1, duration: 200, useNativeDriver: false }).start()
        setIsReloading(true)
      }
      if (p.current >= p.total) {
        setTimeout(() => {
          Animated.timing(reloadOpacity, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
            setIsReloading(false)
            progressAnim.setValue(0)
          })
        }, 400)
      }
    })
    return () => { void unsub(); void unsubProgress() }
  }, [refresh, progressAnim, reloadOpacity])

  const openCreate = () => {
    setFormName(''); setFormIcon('📊'); setFormDescription(''); setFormFormula('')
    setFormQuery(''); setFormTarget(''); setFormGoodValue('')
    setFormCategory(categories[0]?.id ?? ''); setFormError(null)
    setNameError(null); setQueryError(null); setTargetError(null)
    setQueryValidated(false); setTargetValidated(false)
    setMode('create')
  }

  const openEdit = (kpi: KpiDefinition) => {
    setSelectedKpi(kpi)
    setFormName(kpi.name); setFormIcon(kpi.icon); setFormDescription(kpi.description)
    setFormFormula(kpi.formula); setFormQuery(kpi.query); setFormTarget(kpi.targetExpr)
    setFormGoodValue(kpi.goodValue); setFormCategory(kpi.categoryId); setFormError(null)
    setNameError(null); setQueryError(null); setTargetError(null)
    setQueryValidated(false); setTargetValidated(false)
    setMode('edit')
  }

  const openDetail = (kpi: KpiDefinition) => {
    setSelectedKpi(kpi)
    setMode('detail')
  }

  const handleValidateQuery = () => {
    setQueryValidated(true)
    const query = formQuery.trim()
    if (!query) {
      setQueryError(t('kpi_builder.sqlRequired'))
      return
    }
    const upper = query.toUpperCase()

    const sqlKeywords = new Set([
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
      'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
      'AS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
      'UNION', 'ALL', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
      'ROUND', 'CAST', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'COALESCE', 'NULLIF', 'DATE', 'STRFTIME',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
      'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX',
      'WITH', 'RECURSIVE',
      'TRUE', 'FALSE',
    ])

    const validStart = ['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER']
    if (!validStart.some(kw => upper.startsWith(kw))) {
      setQueryError(t('kpi_builder.sqlInvalidStart'))
      return
    }

    const sqlTokenRegex = /([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+\.?[0-9]*|'[']*'|"[^"]*"|[\(\)\.,\+\-\*\/<>=!&|;%])/g
    const tokens = query.match(sqlTokenRegex) || []
    const invalidTokens = tokens.filter(t => {
      if (/^[0-9]+\.?[0-9]*$/.test(t)) return false
      if (/^'[']*'$/.test(t) || /^"[^"]*"$/.test(t)) return false
      if (/^[\(\)\.,\+\-\*\/<>=!&|;%]$/.test(t)) return false
      if (sqlKeywords.has(t.toUpperCase())) return false
      return false
    })

    if (invalidTokens.length > 0) {
      setQueryError(`${t('kpi_builder.sqlInvalidTokens')}: ${invalidTokens.slice(0, 3).join(', ')}`)
      return
    }

    let parenCount = 0
    for (const ch of query) {
      if (ch === '(') parenCount++
      if (ch === ')') parenCount--
      if (parenCount < 0) {
        setQueryError(t('kpi_builder.sqlUnbalancedParens'))
        return
      }
    }
    if (parenCount !== 0) {
      setQueryError(t('kpi_builder.sqlUnbalancedParens'))
      return
    }

    const needsFrom = !upper.startsWith('WITH') && !upper.startsWith('INSERT') && !upper.startsWith('UPDATE') && !upper.startsWith('DELETE') && !upper.startsWith('CREATE') && !upper.startsWith('DROP') && !upper.startsWith('ALTER')
    if (needsFrom && !upper.includes('FROM')) {
      setQueryError(t('kpi_builder.sqlMissingFrom'))
      return
    }

    setQueryError(null)
  }

  const handleValidateTarget = () => {
    setTargetValidated(true)
    if (!formTarget.trim()) {
      setTargetError(null)
      return
    }
    const err = validateExpression(formTarget)
    if (err) {
      setTargetError(err)
    } else {
      setTargetError(null)
    }
  }

  const handleSave = async () => {
    let hasError = false

    // Validate name
    if (!formName.trim()) {
      setNameError(t('kpi_builder.nameRequired'))
      hasError = true
    } else {
      setNameError(null)
    }

    // Validate query
    if (!formQuery.trim()) {
      setQueryError(t('kpi_builder.sqlRequired'))
      hasError = true
    } else {
      setQueryError(null)
      setQueryValidated(true)
    }

    // Validate target if provided
    if (formTarget.trim()) {
      const err = validateExpression(formTarget)
      if (err) {
        setTargetError(err)
        hasError = true
      } else {
        setTargetError(null)
      }
      setTargetValidated(true)
    } else {
      setTargetError(null)
      setTargetValidated(false)
    }

    if (hasError) {
      setFormError(t('kpi_builder.fixErrorsBeforeSave'))
      return
    }
    setFormError(null)

    if (mode === 'create') {
      await kpiStore.addKpi({
        name: formName.trim(), nameKey: '',
        icon: formIcon, description: formDescription.trim(), descKey: '',
        goalKey: '', formula: formFormula.trim(), query: formQuery.trim(),
        targetExpr: formTarget.trim(), goodValue: formGoodValue.trim(),
        categoryId: formCategory,
      })
    } else if (mode === 'edit' && selectedKpi) {
      await kpiStore.updateKpi(selectedKpi.id, {
        name: formName.trim(), icon: formIcon, description: formDescription.trim(),
        formula: formFormula.trim(), query: formQuery.trim(),
        targetExpr: formTarget.trim(), goodValue: formGoodValue.trim(),
        categoryId: formCategory,
      })
    }
    refresh()
    setMode('list')
  }

  const handleReload = () => {
    if (onReloadQueries) {
      onReloadQueries()
    } else {
      void kpiStore.reloadFromDb()
      refresh()
    }
  }

  const confirmDelete = async (title: string, message: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return window.confirm(`${title}\n\n${message}`)
    }
    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: t('common.close'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('kpi_builder.delete'), style: 'destructive', onPress: () => resolve(true) },
      ])
    })
  }

  const handleDelete = async () => {
    if (!selectedKpi) return
    if (!selectedKpi.isCustom) {
      if (Platform.OS === 'web') window.alert(`${t('kpi_builder.cannotDeleteDefault')}: ${t('kpi_builder.cannotDeleteDefaultDesc')}`)
      else Alert.alert(t('kpi_builder.cannotDeleteDefault'), t('kpi_builder.cannotDeleteDefaultDesc'), [{ text: t('common.close') }])
      return
    }
    const confirmed = await confirmDelete(
      t('kpi_builder.confirmDelete'),
      `${t('kpi_builder.confirmDeleteDesc')} "${selectedKpi.name}"?`
    )
    if (confirmed) {
      const ok = await kpiStore.deleteKpi(selectedKpi.id)
      if (ok) {
        setSelectedKpi(null)
        setMode('list')
        refresh()
      }
    }
  }

  const handleExport = async () => {
    const json = kpiStore.exportJson()
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kpi-config-${Date.now()}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      await Share.share({ message: json, title: 'KPI Config' })
    }
  }

  const handleImport = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const text = await file.text()
        try {
          const data = JSON.parse(text)
          if (data.kpis) {
            for (const kpi of data.kpis) {
              const exists = kpiStore.getKpiById(kpi.id)
              if (!exists || kpi.isCustom) {
                if (exists) await kpiStore.updateKpi(kpi.id, kpi)
                else await kpiStore.addKpi(kpi)
              }
            }
          }
          if (data.categories) {
            for (const cat of data.categories) {
              const exists = categories.find(c => c.id === cat.id)
              if (!exists) await kpiStore.addCategory(cat)
            }
          }
          refresh()
          if (Platform.OS === 'web') window.alert(`${t('kpi_builder.importSuccess')}: ${t('kpi_builder.importSuccessDesc')}`)
          else Alert.alert(t('kpi_builder.importSuccess'), t('kpi_builder.importSuccessDesc'))
        } catch {
          if (Platform.OS === 'web') window.alert(`${t('kpi_builder.importError')}: ${t('kpi_builder.importErrorDesc')}`)
          else Alert.alert(t('kpi_builder.importError'), t('kpi_builder.importErrorDesc'))
        }
      }
      input.click()
    }
  }

  const filteredKpis = filterCat === 'all' ? kpis : kpis.filter(k => k.categoryId === filterCat)

  const catMap = new Map(categories.map(c => [c.id, c]))

  const ICON_PICKER = ['📊', '📈', '📉', '💰', '💲', '🎯', '⚡', '🔄', '📅', '👁️', '🎥', '🔒', '🚪', '💤', '😫', '👥', '📱', '🔔', '⭐', '🏆', '📝', '📦', '🔧', '📡']

  const COMMON_ICONS = ['list-outline', 'analytics-outline', 'stats-chart-outline', 'cash-outline', 'heart-outline', 'document-text-outline', 'people-outline', 'warning-outline', 'star-outline', 'flag-outline', 'color-palette-outline', 'code-slash-outline']

  if (mode === 'create' || mode === 'edit') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setMode(selectedKpi ? 'detail' : 'list')}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === 'create' ? t('kpi_builder.newKpi') : t('kpi_builder.editKpi')}
          </Text>
        </View>

        {formError && (
          <GlassCard glow="magenta" style={styles.errorCard}>
            <Text style={styles.errorText}>{formError}</Text>
          </GlassCard>
        )}

        <Text style={styles.label}>{t('kpi_builder.kpiName')} *</Text>
        <TextInput style={[styles.input, nameError && styles.inputError, !nameError && formName && styles.inputSuccess]} value={formName} onChangeText={(v) => { setFormName(v); if (nameError) setNameError(null) }} placeholder="e.g. Monthly Active Users" placeholderTextColor={colors.text.tertiary} />
        {nameError && <Text style={styles.fieldError}>{nameError}</Text>}

        <Text style={styles.label}>{t('kpi_builder.icon')}</Text>
        <View style={styles.iconPicker}>
          {ICON_PICKER.map(ic => (
            <TouchableOpacity key={ic} onPress={() => setFormIcon(ic)}
              style={[styles.iconPickBtn, formIcon === ic && styles.iconPickBtnActive]}>
              <Text style={{ fontSize: 20 }}>{ic}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('kpi_builder.description')}</Text>
        <TextInput style={[styles.input, styles.textArea]} value={formDescription} onChangeText={setFormDescription} placeholderTextColor={colors.text.tertiary} multiline placeholder={t('kpi_builder.descriptionPlaceholder')} />

        <Text style={styles.label}>{t('kpi_builder.formula')}</Text>
        <TextInput style={[styles.input, styles.textArea]} value={formFormula} onChangeText={setFormFormula} placeholderTextColor={colors.text.tertiary} multiline placeholder="e.g. COUNT(DISTINCT user_id) WHERE active = true" />

        <Text style={styles.label}>{t('kpi_builder.sqlQuery')} *</Text>
        <View style={styles.inputWithBtn}>
          <TextInput style={[styles.flexInput, queryError && styles.inputError, queryValidated && !queryError && styles.inputSuccess]} value={formQuery} onChangeText={(v) => { setFormQuery(v); if (queryError) setQueryError(null); setQueryValidated(false) }} placeholderTextColor={colors.text.tertiary} multiline placeholder="SELECT COUNT(*) AS c FROM users WHERE active = 1" />
          <TouchableOpacity style={styles.validateBtn} onPress={handleValidateQuery}>
            <Ionicons name="play-circle-outline" size={22} color={queryError ? colors.status.critical : queryValidated ? colors.status.success : colors.accent.amber} />
          </TouchableOpacity>
        </View>
        {queryValidated && !queryError && formQuery && (
          <View style={styles.validationFeedback}>
            <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
            <Text style={styles.validationSuccess}>{t('kpi_builder.sqlValid')}</Text>
          </View>
        )}
        {queryError && <Text style={styles.fieldError}>{queryError}</Text>}

        <Text style={styles.label}>{t('kpi_builder.targetExpression')}</Text>
        <View style={styles.inputWithBtn}>
          <TextInput style={[styles.flexInput, targetError && styles.inputError, targetValidated && !targetError && formTarget && styles.inputSuccess]} value={formTarget} onChangeText={(v) => { setFormTarget(v); if (targetError) setTargetError(null); setTargetValidated(false) }} placeholderTextColor={colors.text.tertiary} placeholder="e.g. value >= 100" />
          <TouchableOpacity style={styles.validateBtn} onPress={handleValidateTarget}>
            <Ionicons name="play-circle-outline" size={22} color={targetError ? colors.status.critical : targetValidated ? colors.status.success : colors.accent.amber} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>{getExpressionHint()}</Text>
        {targetValidated && !targetError && formTarget && (
          <View style={styles.validationFeedback}>
            <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
            <Text style={styles.validationSuccess}>{t('kpi_builder.targetValid')}</Text>
          </View>
        )}
        {targetError && <Text style={styles.fieldError}>{targetError}</Text>}

        <Text style={styles.label}>{t('kpi_builder.goodValue')}</Text>
        <TextInput style={styles.input} value={formGoodValue} onChangeText={setFormGoodValue} placeholderTextColor={colors.text.tertiary} placeholder="e.g. > $1,000 per month" />

        <Text style={styles.label}>{t('kpi_builder.category')} *</Text>
        <View style={styles.catPicker}>
          {categories.map(cat => (
            <TouchableOpacity key={cat.id} onPress={() => setFormCategory(cat.id)}
              style={[styles.catPickBtn, formCategory === cat.id && styles.catPickBtnActive]}>
              <Ionicons name={cat.icon as any} size={16} color={formCategory === cat.id ? colors.accent.amber : colors.text.secondary} />
              <Text style={[styles.catPickLabel, formCategory === cat.id && styles.catPickLabelActive]}>{t(cat.nameKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>
            {mode === 'create' ? t('kpi_builder.createKpi') : t('kpi_builder.saveChanges')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  if (mode === 'detail' && selectedKpi) {
    const cat = catMap.get(selectedKpi.categoryId)
    let targetResult: string | null = null
    if (selectedKpi.targetExpr) {
      try {
        targetResult = evalTargetExpression(selectedKpi.targetExpr, { value: 0, pct: 0, trend: 0 })
          ? t('kpi_builder.targetPass') : t('kpi_builder.targetFail')
      } catch (e: any) {
        targetResult = `Error: ${e.message}`
      }
    }

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setMode('list')}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedKpi.name}</Text>
        </View>

        <GlassCard style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailIcon}>{selectedKpi.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{selectedKpi.name}</Text>
              <Text style={styles.detailId}>{selectedKpi.id}</Text>
            </View>
            {selectedKpi.isCustom ? (
              <View style={[styles.badge, { backgroundColor: colors.accent.cyan + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.accent.cyan }]}>{t('kpi_builder.custom')}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: colors.text.tertiary + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.text.tertiary }]}>{t('kpi_builder.default')}</Text>
              </View>
            )}
          </View>
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('kpi_builder.category')}</Text>
          <Text style={styles.infoValue}>{cat ? t(cat.nameKey) : selectedKpi.categoryId}</Text>
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('kpi_builder.description')}</Text>
          <Text style={styles.infoValue}>{selectedKpi.description || t(selectedKpi.descKey)}</Text>
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('kpi_builder.formula')}</Text>
          <Text style={styles.infoValueMono}>{selectedKpi.formula}</Text>
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('kpi_builder.sqlQuery')}</Text>
          <Text style={styles.infoValueMono}>{selectedKpi.query}</Text>
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('kpi_builder.targetExpression')}</Text>
          {selectedKpi.targetExpr ? (
            <>
              <Text style={styles.infoValueMono}>{selectedKpi.targetExpr}</Text>
              <Text style={styles.hint}>{t('kpi_builder.testVariables')}: value, pct, trend, total, count</Text>
            </>
          ) : (
            <Text style={styles.infoValue}>{t('kpi_builder.noTargetSet')}</Text>
          )}
        </GlassCard>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t('kpi_builder.goodValue')}</Text>
          <Text style={styles.infoValue}>{selectedKpi.goodValue}</Text>
        </GlassCard>

        <View style={styles.detailActions}>
          <TouchableOpacity style={styles.detailBtn} onPress={() => openEdit(selectedKpi)}>
            <Ionicons name="create-outline" size={20} color={colors.accent.amber} />
            <Text style={[styles.detailBtnText, { color: colors.accent.amber }]}>{t('kpi_builder.edit')}</Text>
          </TouchableOpacity>
          {selectedKpi.isCustom && (
            <TouchableOpacity style={[styles.detailBtn, { marginLeft: spacing.sm }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.status.critical} />
              <Text style={[styles.detailBtnText, { color: colors.status.critical }]}>{t('kpi_builder.delete')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    )
  }

  if (mode === 'categories') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setMode('list')}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('kpi_builder.manageCategories')}</Text>
        </View>

        {categories.map(cat => {
          const count = kpis.filter(k => k.categoryId === cat.id).length
          return (
            <GlassCard key={cat.id} style={styles.catCard}>
              <View style={styles.catCardRow}>
                <Ionicons name={cat.icon as any} size={24} color={colors.accent.amber} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.catCardName}>{t(cat.nameKey)}</Text>
                  <Text style={styles.catCardCount}>{count} {count === 1 ? 'KPI' : 'KPIs'}</Text>
                </View>
                {cat.id.startsWith('cat_') && (
                  <TouchableOpacity onPress={async () => {
                    const confirmed = await confirmDelete(t('kpi_builder.confirmDeleteCat'), t('kpi_builder.confirmDeleteCatDesc'))
                    if (confirmed) {
                      await kpiStore.deleteCategory(cat.id)
                      refresh()
                    }
                  }}>
                    <Ionicons name="trash-outline" size={20} color={colors.status.critical} />
                  </TouchableOpacity>
                )}
              </View>
            </GlassCard>
          )
        })}

        <GlassCard style={styles.addCatCard}>
          <TouchableOpacity onPress={() => { setCatFormName(''); setCatFormIcon('list-outline'); setMode('createCategory') }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="add-circle-outline" size={24} color={colors.accent.amber} />
              <Text style={styles.addCatText}>{t('kpi_builder.addCategory')}</Text>
            </View>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    )
  }

  if (mode === 'createCategory') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setMode('categories')}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('kpi_builder.newCategory')}</Text>
        </View>

        <Text style={styles.label}>{t('kpi_builder.categoryName')}</Text>
        <TextInput style={styles.input} value={catFormName} onChangeText={setCatFormName} placeholder="e.g. Marketing" placeholderTextColor={colors.text.tertiary} />

        <Text style={styles.label}>{t('kpi_builder.categoryIcon')}</Text>
        <View style={styles.iconPicker}>
          {COMMON_ICONS.map(ic => (
            <TouchableOpacity key={ic} onPress={() => setCatFormIcon(ic)}
              style={[styles.iconPickBtn, catFormIcon === ic && styles.iconPickBtnActive]}>
              <Ionicons name={ic as any} size={20} color={catFormIcon === ic ? colors.accent.amber : colors.text.secondary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn}
          onPress={async () => {
            if (!catFormName.trim()) return
            await kpiStore.addCategory({ nameKey: `kpi_builder.cat_${catFormName.trim().toLowerCase()}`, icon: catFormIcon })
            setMode('categories')
          }}>
          <Text style={styles.saveBtnText}>{t('kpi_builder.createCategory')}</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('kpi_builder.title')}</Text>
            <Text style={styles.subtitle}>{t('kpi_builder.subtitle')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <TouchableOpacity onPress={handleReload} style={[styles.actionBtn, isReloading && { opacity: 0.5 }]}>
              <Ionicons name={isReloading ? 'refresh-circle' : 'refresh-outline'} size={18} color={isReloading ? colors.accent.cyan : colors.accent.amber} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleImport} style={styles.actionBtn}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.accent.amber} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExport} style={styles.actionBtn}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.accent.amber} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => setFilterCat('all')}
              style={[styles.filterBtn, filterCat === 'all' && styles.filterBtnActive]}>
              <Text style={[styles.filterText, filterCat === 'all' && styles.filterTextActive]}>
                {t('kpi_builder.allCategories')}
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity key={cat.id} onPress={() => setFilterCat(cat.id)}
                style={[styles.filterBtn, filterCat === cat.id && styles.filterBtnActive]}>
                <Ionicons name={cat.icon as any} size={14} color={filterCat === cat.id ? colors.accent.amber : colors.text.secondary} />
                <Text style={[styles.filterText, filterCat === cat.id && styles.filterTextActive]}>
                  {t(cat.nameKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.catManageBtn} onPress={() => setMode('categories')}>
          <Ionicons name="settings-outline" size={18} color={colors.accent.cyan} />
          <Text style={styles.catManageText}>{t('kpi_builder.manageCategories')}</Text>
        </TouchableOpacity>

        {filteredKpis.length === 0 && (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="folder-open-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>{t('kpi_builder.noKpis')}</Text>
            <Text style={styles.emptyHint}>{t('kpi_builder.noKpisHint')}</Text>
          </GlassCard>
        )}

        {filteredKpis.map(kpi => {
          const cat = catMap.get(kpi.categoryId)
          return (
            <GlassCard key={kpi.id} style={styles.kpiCard}>
              <TouchableOpacity style={styles.kpiCardRow} onPress={() => openDetail(kpi)}>
                <Text style={styles.kpiIcon}>{kpi.icon}</Text>
                <View style={styles.kpiInfo}>
                  <Text style={styles.kpiName}>{kpi.name}</Text>
                  <View style={styles.kpiMeta}>
                    {cat && (
                      <Text style={styles.kpiCategory}>
                        <Ionicons name={cat.icon as any} size={10} color={colors.text.tertiary} /> {t(cat.nameKey)}
                      </Text>
                    )}
                    {kpi.targetExpr && (
                      <Text style={styles.kpiTarget}>
                        {kpi.targetExpr}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              <View style={styles.kpiActions}>
                <TouchableOpacity onPress={() => openEdit(kpi)} style={styles.kpiActionBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.accent.amber} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openDetail(kpi)} style={styles.kpiActionBtn}>
                  <Ionicons name="eye-outline" size={18} color={colors.accent.cyan} />
                </TouchableOpacity>
                {kpi.isCustom && (
                  <TouchableOpacity onPress={async () => {
                    const confirmed = await confirmDelete(t('kpi_builder.confirmDelete'), `${t('kpi_builder.confirmDeleteDesc')} "${kpi.name}"?`)
                    if (confirmed) {
                      await kpiStore.deleteKpi(kpi.id)
                      refresh()
                    }
                  }} style={styles.kpiActionBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.status.critical} />
                  </TouchableOpacity>
                )}
              </View>
            </GlassCard>
          )
        })}

        <TouchableOpacity style={styles.addKpiBtn} onPress={openCreate}>
          <Ionicons name="add-circle" size={24} color={colors.space.bg} />
          <Text style={styles.addKpiText}>{t('kpi_builder.newKpi')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {isReloading && (
        <Animated.View style={[styles.reloadOverlay, { opacity: reloadOpacity }]}>
          <GlassCard glow="amber" style={styles.reloadCard}>
            <View style={styles.reloadHeader}>
              <Ionicons name="refresh-circle" size={20} color={colors.accent.amber} />
              <Text style={styles.reloadMessage}>{reloadProgress.message}</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as any }]} />
            </View>
            <Text style={styles.progressLabel}>{reloadProgress.current} / {reloadProgress.total}</Text>
          </GlassCard>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, marginBottom: spacing.sm, color: colors.text.secondary },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headerTitle: { ...typography.h2, flex: 1 },
  actionBtn: {
    padding: spacing.sm, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,183,77,0.1)', borderWidth: 1, borderColor: 'rgba(255,183,77,0.25)',
  },
  toolbar: { flexDirection: 'row', marginBottom: spacing.sm },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.sm, marginRight: spacing.xs,
    backgroundColor: colors.glass.card, borderWidth: 1, borderColor: colors.glass.cardBorder,
  },
  filterBtnActive: { borderColor: colors.accent.amber, backgroundColor: colors.accent.amber + '15' },
  filterText: { ...typography.small, color: colors.text.secondary },
  filterTextActive: { color: colors.accent.amber, fontWeight: '600' },
  catManageBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  catManageText: { ...typography.small, color: colors.accent.cyan },
  kpiCard: { marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  kpiCardRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kpiIcon: { fontSize: 28 },
  kpiInfo: { flex: 1 },
  kpiName: { ...typography.h3 },
  kpiMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  kpiCategory: { ...typography.small, color: colors.text.tertiary },
  kpiTarget: { ...typography.small, color: colors.accent.cyan, fontFamily: 'monospace', fontSize: 10 },
  kpiActions: { flexDirection: 'row', gap: spacing.xs },
  kpiActionBtn: { padding: spacing.xs },
  addKpiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.accent.amber, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md,
  },
  addKpiText: { ...typography.h3, color: colors.space.bg },
  label: { ...typography.small, color: colors.accent.amber, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: colors.glass.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.glass.cardBorder, color: colors.text.primary, padding: spacing.md,
    fontSize: 14, marginBottom: spacing.sm,
  },
  inputError: { borderColor: colors.status.critical + '80', backgroundColor: colors.status.critical + '08' },
  inputSuccess: { borderColor: colors.status.success + '80', backgroundColor: colors.status.success + '08' },
  inputWithBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  flexInput: {
    flex: 1, backgroundColor: colors.glass.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.glass.cardBorder, color: colors.text.primary, padding: spacing.md,
    fontSize: 14, minHeight: 44,
  },
  validateBtn: { marginLeft: spacing.xs, padding: spacing.xs },
  fieldError: { ...typography.small, color: colors.status.critical, marginTop: -spacing.xs, marginBottom: spacing.sm },
  validationFeedback: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.xs, marginBottom: spacing.sm },
  validationSuccess: { ...typography.small, color: colors.status.success },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  hint: { ...typography.small, color: colors.text.tertiary, marginBottom: spacing.sm, lineHeight: 16 },
  iconPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  iconPickBtn: {
    padding: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.glass.cardBorder, backgroundColor: colors.glass.card,
  },
  iconPickBtnActive: { borderColor: colors.accent.amber, backgroundColor: colors.accent.amber + '15' },
  catPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  catPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.glass.cardBorder, backgroundColor: colors.glass.card,
  },
  catPickBtnActive: { borderColor: colors.accent.amber, backgroundColor: colors.accent.amber + '15' },
  catPickLabel: { ...typography.small, color: colors.text.secondary },
  catPickLabelActive: { color: colors.accent.amber, fontWeight: '600' },
  saveBtn: {
    backgroundColor: colors.accent.amber, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.lg,
  },
  saveBtnText: { ...typography.h3, color: colors.space.bg },
  errorCard: { marginBottom: spacing.sm, padding: spacing.md },
  errorText: { ...typography.body, color: colors.status.critical },
  detailCard: { marginBottom: spacing.md },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailIcon: { fontSize: 36 },
  detailName: { ...typography.h2 },
  detailId: { ...typography.small, color: colors.text.tertiary, fontFamily: 'monospace' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  badgeText: { ...typography.small, fontWeight: '600' },
  infoCard: { marginBottom: spacing.sm, padding: spacing.md },
  infoLabel: { ...typography.small, color: colors.accent.amber, fontWeight: '600', marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { ...typography.body, lineHeight: 20 },
  infoValueMono: { ...typography.body, fontFamily: 'monospace', fontSize: 12, color: colors.accent.cyan, lineHeight: 18 },
  detailActions: { flexDirection: 'row', marginTop: spacing.md },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.glass.cardBorder },
  detailBtnText: { ...typography.body, fontWeight: '600' },
  catCard: { marginBottom: spacing.sm, padding: spacing.md },
  catCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catCardName: { ...typography.h3 },
  catCardCount: { ...typography.small, color: colors.text.tertiary },
  addCatCard: { padding: spacing.md },
  addCatText: { ...typography.body, color: colors.accent.amber },
  emptyCard: { alignItems: 'center', padding: spacing.xl, marginBottom: spacing.md },
  emptyText: { ...typography.h3, color: colors.text.secondary, marginTop: spacing.sm },
  emptyHint: { ...typography.small, color: colors.text.tertiary, marginTop: spacing.xs },
  reloadOverlay: { position: 'absolute', bottom: spacing.lg, left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  reloadCard: { width: '100%', maxWidth: 400, padding: spacing.md },
  reloadHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  reloadMessage: { ...typography.small, color: colors.text.primary, flex: 1 },
  progressTrack: { height: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: spacing.xs },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.accent.amber },
  progressLabel: { ...typography.small, color: colors.text.tertiary, textAlign: 'right' },
})
