import * as SQLite from 'expo-sqlite';

export type CachedAsset = {
  id: string;
  modificationTime: number;
  size: number;
  dhash: string | null;
  blur: number | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('klenzer-scan-cache.db');
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS asset_cache (
          id TEXT PRIMARY KEY NOT NULL,
          modificationTime INTEGER NOT NULL,
          size INTEGER NOT NULL DEFAULT 0,
          dhash TEXT,
          blur REAL
        );
      `);
      return database;
    })();
  }
  return dbPromise;
}

export async function getCached(id: string, modificationTime: number): Promise<CachedAsset | null> {
  try {
    const row = await (await db()).getFirstAsync<CachedAsset>(
      'SELECT id, modificationTime, size, dhash, blur FROM asset_cache WHERE id = ? AND modificationTime = ?',
      [id, modificationTime],
    );
    return row ?? null;
  } catch {
    return null;
  }
}

export async function putCached(row: CachedAsset): Promise<void> {
  try {
    await (await db()).runAsync(
      'INSERT OR REPLACE INTO asset_cache (id, modificationTime, size, dhash, blur) VALUES (?, ?, ?, ?, ?)',
      [row.id, row.modificationTime, row.size, row.dhash, row.blur],
    );
  } catch {}
}

/** Drop cache rows for assets that are no longer in the library (or whose id is gone). */
export async function pruneCache(liveIds: string[]): Promise<void> {
  try {
    const database = await db();
    if (!liveIds.length) {
      await database.execAsync('DELETE FROM asset_cache');
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
    }
  } catch {}
}
