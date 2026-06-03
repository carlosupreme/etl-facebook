export interface DbProvider {
  queryAll<T = any>(sql: string, params?: any): Promise<T[]>
  queryOne<T = any>(sql: string, params?: any): Promise<T | null>
  getTableInfo(): Promise<{ name: string; rows: number }[]>
  replaceDatabase?(uri: string): Promise<void>
}

export interface DbContextValue {
  db: DbProvider | null
  ready: boolean
  needsUpload: boolean
  error: string | null
  version: number
  uploadDb: (file: File) => Promise<void>
  pickNativeDb: () => Promise<void>
  reset: () => void
}
