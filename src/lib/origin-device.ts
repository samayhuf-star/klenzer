/** Device I/O for the Forwarded and AI Images pass. Everything here reads on-device only. */
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';
import { isScanAnalyzeSupported, isScanOriginSupported, scanAnalyze, scanOrigin } from 'live-photo-convert';
import { analyzeThumb } from './image-hash';
import {
  AI_HEAD_BYTES,
  AI_NEEDLE_BYTES,
  aiTagFromHits,
  bytesToBinaryString,
  detectAiTag,
  exifHasCamera,
  isChatAlbumTitle,
  type Origin,
  type OriginResult,
} from './origin-logic';
import { scanOrigins, type OriginProgress } from './origin-scan';
import { getCached, getCachedOrigin, putCachedOrigin } from './scan-cache';
import { withTimeout, type Item } from './scan-logic';

const ALBUM_PAGE = 500;
const ALBUM_TIMEOUT_MS = 20_000;
const NATIVE_TIMEOUT_MS = 10_000;
const MAX_ALBUM_ASSETS = 60_000;

/** Ids of every photo in a chat app's album (iPhone) or folder (Android). */
async function chatAlbumIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const albums = await withTimeout(MediaLibrary.getAlbumsAsync({ includeSmartAlbums: false }), ALBUM_TIMEOUT_MS, []);
  for (const album of albums) {
    if (!isChatAlbumTitle(album.title)) continue;
    let after: string | undefined;
    for (;;) {
      const page = await withTimeout(
        MediaLibrary.getAssetsAsync({ album, first: ALBUM_PAGE, after, mediaType: ['photo'] }),
        ALBUM_TIMEOUT_MS,
        null,
      );
      if (!page) break;
      for (const a of page.assets) ids.add(a.id);
      if (!page.hasNextPage || ids.size >= MAX_ALBUM_ASSETS) break;
      after = page.endCursor;
    }
  }
  return ids;
}

/** Read the first bytes of a local file. Null if it cannot be opened. */
function readHead(uri: string, length: number): Uint8Array | null {
  try {
    const handle = new File(uri).open();
    try {
      const size = handle.size ?? length;
      return handle.readBytes(Math.max(0, Math.min(length, size)));
    } finally {
      handle.close();
    }
  } catch {
    return null;
  }
}

async function inspectFresh(item: Item, wantText: boolean): Promise<Origin | null> {
  if (isScanOriginSupported) {
    const r = await scanOrigin(item.id, AI_NEEDLE_BYTES, AI_HEAD_BYTES, wantText, NATIVE_TIMEOUT_MS);
    if (!r) return null;
    return { hasCamera: r.hasCamera, aiTag: aiTagFromHits(r.hits), textRatio: r.textRatio };
  }
  // Android: the file is read directly. Text cover is an iPhone-only check for now.
  if (Platform.OS !== 'android') return null;
  let info: MediaLibrary.AssetInfo;
  try {
    info = await MediaLibrary.getAssetInfoAsync(item.id, { shouldDownloadFromNetwork: false });
  } catch {
    return null;
  }
  if (!info.localUri) return null;
  const head = readHead(info.localUri, AI_HEAD_BYTES);
  if (!head) return null;
  return { hasCamera: exifHasCamera(info.exif), aiTag: detectAiTag(bytesToBinaryString(head)), textRatio: null };
}

async function inspect(item: Item, opts: { wantText: boolean }): Promise<Origin | null> {
  const cached = await getCachedOrigin(item.id, item.modificationTime);
  const canText = isScanOriginSupported;
  if (cached && (!opts.wantText || !canText || cached.textRatio != null)) {
    return { hasCamera: cached.hasCamera === 1, aiTag: cached.aiTag, textRatio: cached.textRatio };
  }
  const fresh = await inspectFresh(item, opts.wantText);
  if (!fresh) return null;
  await putCachedOrigin({
    id: item.id,
    modificationTime: item.modificationTime,
    hasCamera: fresh.hasCamera ? 1 : 0,
    aiTag: fresh.aiTag,
    textRatio: fresh.textRatio,
  });
  return fresh;
}

async function hash(item: Item): Promise<string | null> {
  // The main scan fingerprints every photo for Similar and Blurry. Reuse that when it is already saved.
  const known = (await getCached(item.id, item.modificationTime))?.dhash;
  if (known) return known;
  if (isScanAnalyzeSupported) return (await scanAnalyze(item.id, 256, NATIVE_TIMEOUT_MS))?.dhash ?? null;
  try {
    const info = await MediaLibrary.getAssetInfoAsync(item.id, { shouldDownloadFromNetwork: false });
    if (!info.localUri) return null;
    return (await analyzeThumb(info.localUri))?.dhash ?? null;
  } catch {
    return null;
  }
}

/** Fill the Forwarded and AI Images folders for the photos a scan found. */
export function scanOriginsOnDevice(
  photos: Item[],
  signal: { cancelled: boolean },
  onProgress?: (p: OriginProgress) => void,
  onPartial?: (r: OriginResult) => void,
): Promise<OriginResult> {
  return scanOrigins(photos, { chatAlbumIds, inspect, hash }, signal, onProgress, onPartial);
}
