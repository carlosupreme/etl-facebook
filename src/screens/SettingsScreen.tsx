import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { colors, spacing, radius, typography } from '../theme/tokens'
import { GlassCard } from '../components/GlassCard'
import { useDbQuery } from '../hooks/useDbQuery'
import { useDb } from '../db/DbContext'
import { useState, useRef } from 'react'

export default function SettingsScreen() {
  const { t } = useTranslation()
  const { uploadDb, pickNativeDb, reset } = useDb()
  const currentLang = i18n.language
  const [uploading, setUploading] = useState(false)
  const [dbLoading, setDbLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isWeb = Platform.OS === 'web'

  const handlePickDb = async () => {
    setDbStatus(null)
    setDbLoading(true)
    try {
      await pickNativeDb()
      setDbStatus('ok')
    } catch {
      setDbStatus('error')
    }
    setDbLoading(false)
  }

  const { data: dbInfo } = useDbQuery('dbInfo', async (db) => {
    const tables = ['users', 'posts', 'interactions', 'pages',
      'ad_campaigns', 'ad_metrics', 'moderation_reports', 'activity_log']
    const info = []
    for (const table of tables) {
      const r: any = await db.queryOne(`SELECT COUNT(*) AS count FROM ${table}`)
      info.push({ table, rows: r?.count ?? 0 })
    }
    return info
  })

  const handleDbUpload = async (file: File | null | undefined) => {
    if (!file) return
    setUploading(true)
    await uploadDb(file)
    setUploading(false)
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langBtn, currentLang === 'es' && styles.langBtnActive]}
          onPress={() => i18n.changeLanguage('es')}
        >
          <Text style={[styles.langText, currentLang === 'es' && styles.langTextActive]}>
            {t('settings.spanish')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, currentLang === 'en' && styles.langBtnActive]}
          onPress={() => i18n.changeLanguage('en')}
        >
          <Text style={[styles.langText, currentLang === 'en' && styles.langTextActive]}>
            {t('settings.english')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t('settings.dbInfo')}</Text>
      <GlassCard style={{ marginBottom: spacing.md }}>
        {dbInfo?.map((item) => (
          <View key={item.table} style={styles.dbRow}>
            <Text style={styles.dbName}>{item.table}</Text>
            <Text style={styles.dbCount}>{item.rows.toLocaleString()}</Text>
          </View>
        ))}
      </GlassCard>

      {isWeb && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
          <GlassCard>
            <Text style={{ ...typography.body, marginBottom: spacing.sm }}>
              {uploading ? 'Cargando...' : '📂 ' + t('settings.dbInfo')}
            </Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => inputRef.current?.click()}
              activeOpacity={0.7}
            >
              <Text style={styles.uploadBtnText}>Subir nuevo .db</Text>
            </TouchableOpacity>
            <input
              ref={inputRef}
              type="file"
              accept=".db,.sqlite,.sqlite3"
              style={{ display: 'none' }}
              onChange={(e) => handleDbUpload(e.target.files?.[0])}
            />
          </GlassCard>
        </View>
      )}

      {!isWeb && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>{t('settings.loadDb')}</Text>
          <GlassCard>
            <Text style={{ ...typography.body, marginBottom: spacing.sm }}>
              {t('settings.loadDbHint')}
            </Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={handlePickDb}
              activeOpacity={0.7}
              disabled={dbLoading}
            >
              <Text style={styles.uploadBtnText}>
                {dbLoading ? t('settings.loadingDb') : t('settings.loadDb')}
              </Text>
            </TouchableOpacity>
            {dbStatus === 'ok' && (
              <Text style={[styles.statusText, { color: colors.status.success }]}>
                ✓ {t('settings.dbLoaded')}
              </Text>
            )}
            {dbStatus === 'error' && (
              <Text style={[styles.statusText, { color: colors.status.critical }]}>
                ✗ {t('settings.dbLoadError')}
              </Text>
            )}
          </GlassCard>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
      <GlassCard style={{ marginBottom: spacing.lg }}>
        <View style={styles.dbRow}>
          <Text style={styles.dbName}>{t('settings.version')}</Text>
          <Text style={styles.dbCount}>1.0.0</Text>
        </View>
        <View style={styles.dbRow}>
          <Text style={styles.dbName}>{t('settings.contact')}</Text>
          <Text style={styles.dbCount}>@fb-studio</Text>
        </View>
      </GlassCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.space.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm, marginTop: spacing.md },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  langBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
    alignItems: 'center',
    backgroundColor: colors.glass.card,
  },
  langBtnActive: {
    borderColor: colors.accent.amber,
    backgroundColor: colors.accent.amberGlow,
  },
  langText: { ...typography.body, color: colors.text.secondary },
  langTextActive: { color: colors.accent.amber, fontWeight: '600' },
  dbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  dbName: { ...typography.body, textTransform: 'capitalize' },
  dbCount: { ...typography.body, fontWeight: '600' },
  uploadBtn: {
    backgroundColor: colors.accent.amber,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  uploadBtnText: { ...typography.h3, color: colors.space.bg },
  statusText: { ...typography.body, marginTop: spacing.sm, fontWeight: '500' },
})
