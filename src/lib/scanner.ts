import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { isScanAnalyzeSupported, scanAnalyze, scanThumb } from 'live-photo-convert';
import { analyzeForScan } from './icloud-thumb';
import { analyzeThumb } from './image-hash';
import { getCached, pruneCache, putCached } from './scan-cache';
import {
  buildScanResult,
  dupExtraCount,
  dupExtras,
  dupReclaimable,
  emptyScanResult,
  LARGE_VIDEO_BYTES,
  sum,
  withTimeout,
  type DuplicateGroup,
  type Item,
  type ScanResult,
} from './scan-logic';
import {
  scanLibraryWithIO,
  type CategoryProgress,
  type Progress,
  type ScanCategory,
  type ScanHandlers,
  type ScanSignal,
} from './scan-pipeline';

export {
  buildScanResult,
  dupExtraCount,
  dupExtras,
  dupReclaimable,
  emptyScanResult,
  LARGE_VIDEO_BYTES,
  sum,
  type CategoryProgress,
  type DuplicateGroup,
  type Item,
  type Progress,
  type ScanCategory,
  type ScanHandlers,
  type ScanResult,
};

const PAGE = 400;
const INFO_TIMEOUT_MS = 8000;
const HASH_TIMEOUT_MS = 8000;
const PAGE_TIMEOUT_MS = 20000;

async function assetInfo(id: string): Promise<{ localUri: string | null } | null> {
  return withTimeout(
    (async () => {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false });
        return { localUri: info.localUri ?? null };
      } catch {
        return null;
      }
    })(),
    INFO_TIMEOUT_MS,
    null,
  );
}

async function enrichDevice(item: Item, mode: 'size' | 'hash' | 'blur') {
  const wantHash = mode === 'hash' || mode === 'blur';
  const cached = await getCached(item.id, item.modificationTime);
  if (cached && !wantHash) return { size: cached.size, dhash: cached.dhash, blur: cached.blur };
  if (cached && (cached.dhash != null || cached.size === 0) && wantHash) {
    if (cached.dhash != null && (mode !== 'blur' || cached.blur != null)) {
      return { size: cached.size, dhash: cached.dhash, blur: cached.blur };
    }
  }

  let size = cached?.size ?? 0;
  // The native analyzer reads Photos directly, so a hash/blur pass only asks for the file when it still needs the size.
  const needInfo = !cached || !wantHash || !isScanAnalyzeSupported;
  const info = needInfo ? await assetInfo(item.id) : null;
  const uri = info?.localUri ?? null;
  if (uri && !cached) {
    try {
      size = new File(uri).size ?? 0;
    } catch {
      size = 0;
    }
  }

  let dhash: string | null = cached?.dhash ?? null;
  let blur: number | null = cached?.blur ?? null;
  if (wantHash && (dhash == null || (mode === 'blur' && blur == null))) {
    // iOS uses the native thumbnail analyzer for every photo. Elsewhere: always pass a file URI, never a
    // ph:// library URL, to expo-image-manipulator. A failed or slow analysis skips the photo.
    const analysis = await analyzeForScan(item.id, uri, {
      analyze: analyzeThumb,
      fetchCloudThumb: scanThumb,
      removeFile: (fileUri) => new File(fileUri).delete(),
      // iOS: dHash and blur from a small Photos thumbnail, computed natively. The old file +
      // image-manipulator path never answered on the simulator, so every photo hit HASH_TIMEOUT_MS.
      analyzeNative: isScanAnalyzeSupported ? scanAnalyze : undefined,
      hashTimeoutMs: HASH_TIMEOUT_MS,
    });
    if (analysis) {
      dhash = analysis.dhash;
      blur = analysis.blur;
    }
  }

  await putCached({ id: item.id, modificationTime: item.modificationTime, size, dhash, blur });
  return { size, dhash, blur };
}

export async function scanLibrary(
  handlers: ScanHandlers,
  signal: ScanSignal = { cancelled: false },
  extras: { initialPercent?: number } = {},
): Promise<ScanResult> {
  return scanLibraryWithIO(handlers, signal, {
    initialPercent: extras.initialPercent,
    getPage: async (after) => {
      const page = await withTimeout(
        MediaLibrary.getAssetsAsync({
          first: PAGE,
          after,
          mediaType: ['photo', 'video'],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        }),
        PAGE_TIMEOUT_MS,
        null,
      );
      if (!page) return null;
      return {
        assets: page.assets.map((a) => ({
          id: a.id,
          uri: a.uri,
          filename: a.filename,
          width: a.width,
          height: a.height,
          creationTime: a.creationTime,
          modificationTime: a.modificationTime,
          duration: a.duration,
          mediaType: a.mediaType === 'video' ? 'video' : 'photo',
          mediaSubtypes: a.mediaSubtypes,
        })),
        hasNextPage: page.hasNextPage,
        endCursor: page.endCursor,
        totalCount: page.totalCount,
      };
    },
    enrich: enrichDevice,
    pruneCache,
  });
}

export async function deleteItems(items: Item[]): Promise<boolean> {
  if (!items.length) return false;
  return MediaLibrary.deleteAssetsAsync(items.map((i) => i.id));
}
