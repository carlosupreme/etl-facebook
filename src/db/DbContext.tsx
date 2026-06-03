import React, { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { Platform, Alert } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { createProvider } from './DatabaseService'
import type { DbProvider, DbContextValue } from './types'

const DbContext = createContext<DbContextValue>({
  db: null,
  ready: false,
  needsUpload: false,
  error: null,
  version: 0,
  uploadDb: async () => {},
  pickNativeDb: async () => {},
  reset: () => {},
})

export function useDb(): DbContextValue {
  return useContext(DbContext)
}

interface Props {
  children: ReactNode
}

const LOCAL_SQL_JS_URL = '/sql-wasm.js'
const WASM_URL = '/sql-wasm.wasm'

function createWebProvider(sqlDb: any): DbProvider {
  const queryAll = async (sql: string) => {
    const result = sqlDb.exec(sql)
    if (!result || result.length === 0 || !result[0]) return []
    const { columns, values } = result[0]
    if (!columns || !values) return []
    return values.map((row: any[]) => {
      const obj: any = {}
      columns.forEach((col: string, i: number) => { obj[col] = row[i] })
      return obj
    })
  }
  const queryOne = async <T = any>(sql: string): Promise<T | null> => {
    const rows = await queryAll(sql)
    return rows[0] ?? null
  }
  const getTableInfo = async () => {
    const tables = ['users', 'posts', 'interactions', 'pages', 'ad_campaigns', 'ad_metrics', 'moderation_reports', 'activity_log', 'followers', 'third_party_apps', 'app_permissions']
    const result: { name: string; rows: number }[] = []
    for (const t of tables) {
      const r = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${t}`)
      result.push({ name: t, rows: r?.count ?? 0 })
    }
    return result
  }
  return { queryAll, queryOne, getTableInfo }
}

function loadSqlJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((globalThis as any).__SQL_JS_READY) {
      return resolve((globalThis as any).__SQL_JS)
    }
    const script = document.createElement('script')
    script.src = LOCAL_SQL_JS_URL
    script.onload = () => {
      const initSqlJs = (globalThis as any).initSqlJs
      if (initSqlJs) {
        initSqlJs({ locateFile: () => WASM_URL })
          .then((SQL: any) => {
            ;(globalThis as any).__SQL_JS = SQL
            ;(globalThis as any).__SQL_JS_READY = true
            resolve(SQL)
          })
          .catch(reject)
      }
    }
    script.onerror = () => reject(new Error(`Failed to load sql.js from ${LOCAL_SQL_JS_URL}`))
    document.head.appendChild(script)
  })
}

export function DbProvider({ children }: Props) {
  const providerRef = useRef<DbProvider | null>(null)
  const [provider, setProvider] = useState<DbProvider | null>(null)
  const [ready, setReady] = useState(false)
  const [needsUpload, setNeedsUpload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (Platform.OS === 'web') {
      setNeedsUpload(true)
      return
    }
    const p = createProvider() as any
    providerRef.current = p
    p.init!()
      .then(() => {
        setProvider(p as DbProvider)
        setReady(true)
      })
      .catch((e: Error) => {
        setError(e.message)
      })
  }, [])

  const uploadDb = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const SQL = await loadSqlJs()
      const u8 = new Uint8Array(buf)
      const sqlDb = new SQL.Database(u8)
      const p = createWebProvider(sqlDb)
      providerRef.current = p
      setProvider(p)
      setReady(true)
      setNeedsUpload(false)
      setError(null)
      setVersion(v => v + 1)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load database')
    }
  }, [])

  const pickNativeDb = useCallback(async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.length) return

    const file = result.assets[0]
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
      Alert.alert('Archivo inválido', 'Seleccioná un archivo .db, .sqlite o .sqlite3')
      return
    }

    setError(null)

    try {
      const p = createProvider() as any
      await p.replaceDatabase(file.uri)
      providerRef.current = p
      setProvider(p)
      setReady(true)
      setNeedsUpload(false)
      setVersion(v => v + 1)
    } catch (e: any) {
      setError(e.message ?? 'Failed to replace database')
    }
  }, [])

  const reset = useCallback(() => {
    providerRef.current = null
    setProvider(null)
    setReady(false)
    setNeedsUpload(true)
    setError(null)
  }, [])

  return (
    <DbContext.Provider value={{ db: provider, ready, needsUpload, error, version, uploadDb, pickNativeDb, reset }}>
      {children}
    </DbContext.Provider>
  )
}
