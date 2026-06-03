import { useState, useEffect, useRef, useCallback } from 'react'
import { useDb } from '../db/DbContext'
import i18n from '../i18n'

type QueryFn<T> = (db: import('../db/types').DbProvider) => Promise<T>

let activeQueries = 0
let refreshKey = 0
const listeners = new Set<() => void>()

export function getActiveQueries() { return activeQueries }
export function getRefreshKey() { return refreshKey }
export function refreshAllQueries() { refreshKey++; listeners.forEach(cb => cb()) }
export function onQueryChange(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notifyListeners() {
  listeners.forEach(cb => cb())
}

function ensureArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value
}

function safeNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeString(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value)
}

export function useDbQuery<T>(_key: string, fn: QueryFn<T>) {
  const { db, ready, version } = useDb()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshCount, setRefreshCount] = useState(refreshKey)
  const mounted = useRef(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    mounted.current = true
    const unsub = onQueryChange(() => setRefreshCount(refreshKey))
    return () => { mounted.current = false; void unsub() }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (!db || !ready) return

    activeQueries++
    notifyListeners()
    setLoading(true)

    const currentFn = fnRef.current
    currentFn(db)
      .then((result) => {
        if (mounted.current) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted.current) setLoading(false)
      })
      .finally(() => {
        if (mounted.current) {
          activeQueries--
          notifyListeners()
        }
      })

    return () => { mounted.current = false }
  }, [_key, db, ready, version, i18n.language, refreshCount])

  return { data, loading, ensureArray, safeNumber, safeString }
}
