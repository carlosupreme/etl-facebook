import * as SQLite from 'expo-sqlite'
import { Paths, File, Directory } from 'expo-file-system'
import { Asset } from 'expo-asset'

let db: SQLite.SQLiteDatabase | null = null

function dbFileUri() {
  const docDir = Paths.document
  const sqliteDir = new Directory(docDir.uri, 'SQLite')
  const dbFile = new File(sqliteDir, 'social_network.db')
  return { docDir, sqliteDir, dbFile }
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db

  const { sqliteDir, dbFile } = dbFileUri()

  if (!sqliteDir.exists) {
    sqliteDir.create({ intermediates: true })
  }

  // Always copy from bundled asset so changes to assets/social_network.db
  // are reflected on every cold start without manual re-upload.
  if (dbFile.exists) dbFile.delete()
  const asset = Asset.fromModule(require('../../assets/social_network.db'))
  await asset.downloadAsync()
  const srcFile = new File(asset.localUri!)
  await srcFile.copy(dbFile)

  db = await SQLite.openDatabaseAsync(dbFile.uri)
  return db
}

export async function replaceDatabase(fromUri: string): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    try { await db.closeAsync() } catch {}
    db = null
  }

  const { sqliteDir, dbFile } = dbFileUri()

  if (!sqliteDir.exists) {
    sqliteDir.create({ intermediates: true })
  }

  const srcFile = new File(fromUri)
  await srcFile.copy(dbFile)

  db = await SQLite.openDatabaseAsync(dbFile.uri)
  return db
}
