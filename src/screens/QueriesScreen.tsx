import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Keyboard,
} from 'react-native'
import { useState, useRef, useCallback, useEffect } from 'react'
import { colors, spacing, radius, typography, shadows } from '../theme/tokens'
import { DataTable } from '../components/DataTable'
import { useDb } from '../db/DbContext'
import { openaiKeyStore } from '../services/openaiKeyStore'

const DB_SCHEMA = `
TABLAS:
- users: user_id, username, first_name, last_name, email, birth_date, country, city, registration_date
- posts: post_id, author_id, content, media_type (image|video|link|story|reel|text), privacy (public|friends|only_me|private), reach_count, timestamp
- interactions: interaction_id, user_id, post_id, type (like|love|share|comment|haha|wow|sad|angry), timestamp
- pages: page_id, owner_id, name, category, followers_count, created_at
- ad_campaigns: campaign_id, page_id, objective (reach|brand_awareness|conversions), budget, start_date, end_date
- ad_metrics: metric_id, campaign_id, impressions, clicks, spend, ctr, cpm
- moderation_reports: report_id, post_id, reporter_id, reason, status, created_at
- third_party_apps: app_id, name, developer
- app_permissions: permission_id, app_id, user_id, permission_type, granted_at
- activity_log: log_id, user_id, action_type, timestamp
- followers: follower_id, followed_id, created_at

VOLUMEN: users(15.5k), posts(570k), interactions(250k), followers(200k), moderation_reports(200k), activity_log(220k), pages(100), ad_campaigns(50), ad_metrics(50), third_party_apps(20), app_permissions(200k)
`

const SYSTEM_PROMPT = `Eres un asistente de análisis de datos para una red social. Generas SQL para SQLite basado en preguntas en lenguaje natural.

${DB_SCHEMA}

REGLAS:
- Responde SIEMPRE con JSON válido, sin texto extra
- Si puedes generar SQL: {"sql":"SELECT ..."}
- Si no puedes o es pregunta general: {"message":"respuesta en español"}
- Usa LIMIT 100 máximo
- Solo SQLite syntax
- Usa ROUND() para decimales`

const SUGGESTIONS = [
  '¿Cuáles son los posts con más interacciones?',
  '¿Quiénes son los usuarios más activos?',
  'Distribución por tipo de media',
  '¿Cómo se desempeñan las campañas publicitarias?',
  'Posts más recientes',
  'Tendencia de posts por año',
  '¿Quiénes tienen más seguidores?',
  'Posts sin ninguna interacción',
  'Distribución de privacidad de posts',
  'Top apps con más permisos concedidos',
]

type Message = {
  id: string
  role: 'user' | 'assistant'
  text?: string
  sql?: string
  rows?: any[]
  columns?: { key: string; label: string }[]
  error?: string
  loading?: boolean
}

async function callOpenAI(apiKey: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      instructions: SYSTEM_PROMPT,
      input: userMessage,
    }),
  })

  if (!res.ok) {
    let msg = `Error ${res.status}`
    try { const e = await res.json(); msg = e?.error?.message ?? msg } catch {}
    throw new Error(msg)
  }

  const data = await res.json()
  return data.output?.[0]?.content?.[0]?.text ?? ''
}

export default function QueriesScreen() {
  const { db, ready } = useDb()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [apiKey, setApiKey] = useState(openaiKeyStore.get())
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    return openaiKeyStore.subscribe(() => setApiKey(openaiKeyStore.get()))
  }, [])

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const sub = Keyboard.addListener(event, () => {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
    })
    return () => sub.remove()
  }, [])

  const updateLoadingMsg = useCallback((id: string, update: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, loading: false, ...update } : m))
  }, [])

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const uid = Date.now().toString()
    const aid = uid + '_ai'
    const userMsg: Message = { id: uid, role: 'user', text: trimmed }
    const aiMsg: Message = { id: aid, role: 'assistant', loading: true }

    setMessages(prev => [...prev, userMsg, aiMsg])
    setInput('')
    setSending(true)

    try {
      const key = openaiKeyStore.get()
      if (!key) {
        updateLoadingMsg(aid, { text: 'No hay API key configurada. Ve a Ajustes y escribe tu API key de OpenAI.' })
        return
      }
      if (!db || !ready) {
        updateLoadingMsg(aid, { text: 'La base de datos no está lista todavía. Espera un momento.' })
        return
      }

      const raw = await callOpenAI(key, trimmed)

      let parsed: { sql?: string; message?: string } | null = null
      try {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
      } catch {}

      if (parsed?.sql) {
        try {
          const rows: any[] = await db.queryAll(parsed.sql)
          const cols = rows.length > 0
            ? Object.keys(rows[0]).map(k => ({ key: k, label: k }))
            : []
          updateLoadingMsg(aid, {
            sql: parsed.sql,
            rows,
            columns: cols,
            text: rows.length === 0 ? 'La consulta no devolvió resultados.' : undefined,
          })
        } catch (sqlErr: any) {
          updateLoadingMsg(aid, {
            sql: parsed.sql,
            error: sqlErr?.message ?? 'Error al ejecutar la consulta SQL',
          })
        }
      } else if (parsed?.message) {
        updateLoadingMsg(aid, { text: parsed.message })
      } else {
        updateLoadingMsg(aid, { text: raw || 'No se obtuvo respuesta.' })
      }
    } catch (err: any) {
      updateLoadingMsg(aid, { error: err?.message ?? 'Error al conectar con OpenAI' })
    } finally {
      setSending(false)
    }
  }, [db, ready, sending, updateLoadingMsg])

  const isEmpty = messages.length === 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Consultas</Text>
        <Text style={styles.headerSub}>
          {apiKey ? 'Haz consultas fáciles en lenguaje natural' : '⚠️ Configura tu API key en Ajustes'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
      >
      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyTitle}>¿Qué quieres consultar?</Text>
          <Text style={styles.emptySubtitle}>Escribe en español y obtén los datos al instante</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.messageList}
          style={{ flex: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {isEmpty && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionsScroll}
          contentContainerStyle={styles.suggestionsContent}
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTIONS.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.chip}
              onPress={() => handleSend(s)}
              disabled={sending}
            >
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe tu pregunta..."
          placeholderTextColor={colors.text.tertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => handleSend(input)}
          disabled={!input.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendIcon}>▲</Text>
          }
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  )
}

function MessageBubble({ message: m }: { message: Message }) {
  if (m.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{m.text}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.aiRow}>
      <View style={styles.aiBubble}>
        {m.loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent.amber} />
            <Text style={styles.loadingText}>Procesando...</Text>
          </View>
        )}

        {m.text && !m.loading && (
          <Text style={styles.aiText}>{m.text}</Text>
        )}

        {m.sql && (
          <View style={styles.sqlBlock}>
            <Text style={styles.sqlLabel}>SQL generado</Text>
            <Text style={styles.sqlText}>{m.sql}</Text>
          </View>
        )}

        {m.error && (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>⚠️ {m.error}</Text>
          </View>
        )}

        {m.rows && m.rows.length > 0 && m.columns && (
          <View style={styles.resultBlock}>
            <Text style={styles.resultCount}>
              {m.rows.length} resultado{m.rows.length !== 1 ? 's' : ''}
              {m.rows.length > 20 ? ' (mostrando primeros 20)' : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <DataTable columns={m.columns} data={m.rows.slice(0, 20)} />
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.space.bg,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.glass.cardBorder,
    backgroundColor: colors.glass.card,
  },
  headerTitle: {
    ...typography.h1,
    marginBottom: 2,
  },
  headerSub: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.text.tertiary,
    lineHeight: 20,
  },
  messageList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  userBubble: {
    backgroundColor: colors.accent.amber,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '80%',
    ...shadows.glass,
  },
  userText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 20,
  },
  aiRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
  },
  aiBubble: {
    backgroundColor: colors.glass.card,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
    padding: spacing.md,
    maxWidth: '92%',
    ...shadows.glass,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  aiText: {
    ...typography.body,
    lineHeight: 20,
    color: colors.text.primary,
  },
  sqlBlock: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.cyan,
  },
  sqlLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent.cyan,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sqlText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  errorBlock: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(220,38,38,0.06)',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: {
    ...typography.small,
    color: colors.status.critical,
    lineHeight: 18,
  },
  resultBlock: {
    marginTop: spacing.sm,
  },
  resultCount: {
    ...typography.small,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  suggestionsScroll: {
    flexShrink: 0,
    marginBottom: spacing.sm,
    maxHeight: 40,
  },
  suggestionsContent: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  chip: {
    backgroundColor: colors.glass.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glass.cardBorder,
    backgroundColor: colors.glass.card,
  },
  input: {
    flex: 1,
    backgroundColor: colors.space.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glass.cardBorder,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    maxHeight: 100,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.amber,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glass,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
