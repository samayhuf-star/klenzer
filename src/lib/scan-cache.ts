import * as SQLite from 'expo-sqlite';
import { withTimeout } from './scan-logic';

export type CachedAsset = {
  id: string;
  modificationTime: number;
  size: number;
  dhash: string | null;
  blur: number | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;
let cacheDisabled = false;

async function db(): Promise<SQLite.SQLiteDatabase | null> {
  if (cacheDisabled) return null;
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await withTimeout(
        SQLite.openDatabaseAsync('klenzer-scan-cache.db').then(async (opened) => {
          await opened.execAsync(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS asset_cache (
              id TEXT PRIMARY KEY NOT NULL,
              modificationTime INTEGER NOT NULL,
              size INTEGER NOT NULL DEFAULT 0,
              dhash TEXT,
              blur REAL
            );
            CREATE TABLE IF NOT EXISTS origin_cache2 (
              id TEXT PRIMARY KEY NOT NULL,
              modificationTime INTEGER NOT NULL,
              hasCamera INTEGER NOT NULL DEFAULT 0,
              aiTag TEXT,
              textRatio REAL,
              textLines INTEGER
            );
          `);
          return opened;
        }),
        4000,
        null,
      );
      if (!database) cacheDisabled = true;
      return database;
    })();
  }
  return dbPromise;
}

export async function getCached(id: string, modificationTime: number): Promise<CachedAsset | null> {
  try {
    const database = await db();
    if (!database) return null;
    const row = await withTimeout(
      database.getFirstAsync<CachedAsset>(
        'SELECT id, modificationTime, size, dhash, blur FROM asset_cache WHERE id = ? AND modificationTime = ?',
        [id, modificationTime],
      ),
      3000,
      null,
    );
    return row ?? null;
  } catch {
    return null;
  }
}

export async function putCached(row: CachedAsset): Promise<void> {
  try {
    const database = await db();
    if (!database) return;
    await withTimeout(
      database.runAsync(
        'INSERT OR REPLACE INTO asset_cache (id, modificationTime, size, dhash, blur) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.modificationTime, row.size, row.dhash, row.blur],
      ).then(() => true),
      3000,
      false,
    );
  } catch {}
}

export type CachedOrigin = { id: string; modificationTime: number; hasCamera: number; aiTag: string | null; textRatio: number | null; textLines: number | null };

/** What a photo's file said about where it came from, kept so later scans do not open the file again. */
export async function getCachedOrigin(id: string, modificationTime: number): Promise<CachedOrigin | null> {
  try {
    const database = await db();
    if (!database) return null;
    const row = await withTimeout(
      database.getFirstAsync<CachedOrigin>(
        'SELECT id, modificationTime, hasCamera, aiTag, textRatio, textLines FROM origin_cache2 WHERE id = ? AND modificationTime = ?',
        [id, modificationTime],
      ),
      3000,
      null,
    );
    return row ?? null;
  } catch {
    return null;
  }
}

export async function putCachedOrigin(row: CachedOrigin): Promise<void> {
  try {
    const database = await db();
    if (!database) return;
    await withTimeout(
      database.runAsync(
        'INSERT OR REPLACE INTO origin_cache2 (id, modificationTime, hasCamera, aiTag, textRatio, textLines) VALUES (?, ?, ?, ?, ?, ?)',
        [row.id, row.modificationTime, row.hasCamera, row.aiTag, row.textRatio, row.textLines],
      ).then(() => true),
      3000,
      false,
    );
  } catch {}
}

/** Drop cache rows for assets that are no longer in the library (or whose id is gone). */
export async function pruneCache(liveIds: string[]): Promise<void> {
  try {
    const database = await db();
    if (!database) return;
    if (!liveIds.length) {
      await database.execAsync('DELETE FROM asset_cache; DELETE FROM origin_cache; DELETE FROM origin_cache2;');
      return;
    }
    const keep = new Set(liveIds);
    const rows = await database.getAllAsync<{ id: string }>('SELECT id FROM asset_cache');
    const stale = rows.map((r) => r.id).filter((id) => !keep.has(id));
    const chunk = 200;
    for (let i = 0; i < stale.length; i += chunk) {
      const part = stale.slice(i, i + chunk);
      const marks = part.map(() => '?').join(',');
      await database.runAsync(`DELETE FROM asset_cache WHERE id IN (${marks})`, part);
      await database.runAsync(`DELETE FROM origin_cache2 WHERE id IN (${marks})`, part);
    }
  } catch {}
}
