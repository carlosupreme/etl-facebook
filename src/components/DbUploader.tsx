import { useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import { colors, spacing, radius, typography } from '../theme/tokens'
import { GlassCard } from './GlassCard'
import { useDb } from '../db/DbContext'

export function DbUploader() {
  const { uploadDb, error, ready } = useDb()
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (Platform.OS !== 'web') return null
  if (ready) return null

  const handleFile = async (file: File | null | undefined) => {
    if (!file || !file.name.endsWith('.db')) return
    setFileName(file.name)
    setLoading(true)
    await uploadDb(file)
    setLoading(false)
  }

  const pickFile = () => inputRef.current?.click()

  return (
    <View style={styles.overlay}>
      <View style={styles.center}>
        <GlassCard glow="cyan" style={styles.card}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.title}>FB Studio Manager</Text>
          <Text style={styles.sub}>Sube tu base de datos SQLite para analizar</Text>
          <Text style={styles.subEn}>Upload your SQLite database to analyze</Text>

          <TouchableOpacity style={styles.btn} onPress={pickFile} activeOpacity={0.7}>
            <Text style={styles.btnText}>📁 Elegir archivo .db</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>solo archivos .db / .sqlite / .sqlite3</Text>

          {fileName ? (
            <Text style={styles.fileName}>✓ {fileName}</Text>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {loading && <Text style={styles.loading}>Cargando base de datos...</Text>}
          {error && <Text style={styles.error}>❌ {error}</Text>}
        </GlassCard>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.space.bg,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  } as any,
  center: {
    width: '90%',
    maxWidth: 500,
  },
  card: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emoji: { fontSize: 48, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.accent.amber, marginBottom: spacing.xs },
  sub: { ...typography.body, textAlign: 'center', marginBottom: spacing.xs },
  subEn: { ...typography.small, textAlign: 'center', marginBottom: spacing.lg },
  btn: {
    backgroundColor: colors.accent.amber,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  btnText: { ...typography.h3, color: colors.space.bg },
  hint: { ...typography.small, marginBottom: spacing.md },
  fileName: { ...typography.body, color: colors.accent.green, marginBottom: spacing.sm },
  loading: { ...typography.body, marginTop: spacing.md, color: colors.accent.cyan },
  error: { ...typography.body, marginTop: spacing.md, color: colors.status.critical },
})
