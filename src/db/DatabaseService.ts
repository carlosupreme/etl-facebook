import { Platform } from 'react-native'
import type { DbProvider } from './types'

const TABLES = ['users', 'posts', 'interactions', 'pages', 'ad_campaigns', 'ad_metrics', 'moderation_reports', 'activity_log']

let nativeDb: any = null

async function ensureNativeDb() {
  if (!nativeDb) {
    const mod = await import('./nativeProvider')
    nativeDb = await mod.initDatabase()
  }
  return nativeDb
}

class NativeProvider implements DbProvider {
  async init(): Promise<void> {
    await ensureNativeDb()
  }

  async replaceDatabase(uri: string): Promise<void> {
    nativeDb = null
    const mod = await import('./nativeProvider')
    nativeDb = await mod.replaceDatabase(uri)
  }

  async queryAll<T = any>(sql: string, params?: any): Promise<T[]> {
    const db = await ensureNativeDb()
    return await db.getAllAsync(sql, params)
  }

  async queryOne<T = any>(sql: string, params?: any): Promise<T | null> {
    const db = await ensureNativeDb()
    return (await db.getFirstAsync(sql, params)) as T | null
  }

  async getTableInfo(): Promise<{ name: string; rows: number }[]> {
    const result: { name: string; rows: number }[] = []
    for (const t of TABLES) {
      const row = await this.queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${t}`)
      result.push({ name: t, rows: row?.count ?? 0 })
    }
    return result
  }
}

class WebProvider implements DbProvider {
  queryAll<T = any>(_sql: string, _params?: any): Promise<T[]> {
    return Promise.resolve([])
  }

  queryOne<T = any>(_sql: string, _params?: any): Promise<T | null> {
    return Promise.resolve(null)
  }

  async getTableInfo(): Promise<{ name: string; rows: number }[]> {
    return []
  }
}

export function createProvider(): DbProvider {
  if (Platform.OS === 'web') {
    return new WebProvider()
  }
  return new NativeProvider()
}
