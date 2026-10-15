import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

type Entry = Directory | File;

function sizeOf(e: Entry): number {
  try {
    if (e instanceof File) return e.size ?? 0;
    return e.list().reduce((n, c) => n + sizeOf(c), 0);
  } catch {
    return 0;
  }
}

/** Bytes in Klenzer's own cache folder (thumbnails, temp files). The OS never lets an app touch other apps' caches. */
export function tempBytes(): number {
  try {
    return Paths.cache.exists ? sizeOf(Paths.cache) : 0;
  } catch {
    return 0;
  }
}

/** Delete Klenzer's cache entry by entry so the UI can show real progress. */
export async function clearTemp(onProgress: (done: number, total: number, bytes: number) => void): Promise<number> {
  let entries: Entry[] = [];
  try {
    entries = Paths.cache.exists ? Paths.cache.list() : [];
  } catch {}
  let freed = 0;
  let done = 0;
  onProgress(0, entries.length, 0);
  for (const e of entries) {
    const n = sizeOf(e);
    try {
      e.delete();
      freed += n;
    } catch {}
    onProgress(++done, entries.length, freed);
    // Yield so the animation can paint between deletions.
    await new Promise((r) => setTimeout(r, 30));
  }
  try {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();
  } catch {}
  return freed;
}
