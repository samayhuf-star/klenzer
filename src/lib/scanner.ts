import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { analyzeThumb, isBlurry } from './image-hash';
import { getCached, pruneCache, putCached } from './scan-cache';
import {
  buildScanResult,
  dupExtraCount,
  dupExtras,
  dupReclaimable,
  emptyScanResult,
  isLivePhoto,
  isScreenshotName,
  LARGE_VIDEO_BYTES,
  sum,
  withTimeout,
  type DuplicateGroup,
  type Item,
  type ScanResult,
} from './scan-logic';

export {
  buildScanResult,
  dupExtraCount,
  dupExtras,
  dupReclaimable,
  emptyScanResult,
  LARGE_VIDEO_BYTES,
  sum,
  type DuplicateGroup,
  type Item,
  type ScanResult,
};

export type ScanCategory = 'photos' | 'screenshots' | 'videos';

export type CategoryProgress = {
  category: ScanCategory;
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
};

export type Progress = { phase: 'reading' | 'analyzing'; done: number; total: number; category?: ScanCategory };

const PAGE = 400;
const MAX_ASSETS = 60000;
const WORKERS = 4;
const INFO_TIMEOUT_MS = 8000;
const HASH_TIMEOUT_MS = 8000;
const PAGE_TIMEOUT_MS = 20000;

const toItem = (a: MediaLibrary.Asset): Item => ({
  id: a.id,
  uri: a.uri,
  filename: a.filename,
  width: a.width,
  height: a.height,
  creationTime: a.creationTime,
  modificationTime: a.modificationTime,
  duration: a.duration,
  size: 0,
  isVideo: a.mediaType === 'video',
});

const isLive = (a: MediaLibrary.Asset) => isLivePhoto(a.mediaType, a.mediaSubtypes, isScreenshot(a));

const isScreenshot = (a: MediaLibrary.Asset) =>
  a.mediaType === 'photo' && isScreenshotName(a.filename, a.mediaSubtypes);

type Enrichment = { size: number; dhash: string | null; blur: number | null };

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

async function enrich(item: Item, wantHash: boolean): Promise<Enrichment> {
  const cached = await getCached(item.id, item.modificationTime);
  if (cached && !wantHash) return { size: cached.size, dhash: cached.dhash, blur: cached.blur };
  if (cached && (cached.dhash != null || cached.size === 0)) {
    return { size: cached.size, dhash: cached.dhash, blur: cached.blur };
  }

  let size = cached?.size ?? 0;
  let uri: string | null = null;
  const info = await assetInfo(item.id);
  uri = info?.localUri ?? null;
  if (uri && !cached) {
    try {
      size = new File(uri).size ?? 0;
    } catch {
      size = 0;
    }
  }

  let dhash: string | null = cached?.dhash ?? null;
  let blur: number | null = cached?.blur ?? null;
  if (wantHash && dhash == null && uri) {
    // Always pass a file URI, never a ph:// library URL, to expo-image-manipulator.
    const analysis = await withTimeout(analyzeThumb(uri), HASH_TIMEOUT_MS, null);
    if (analysis) {
      dhash = analysis.dhash;
      blur = analysis.blur;
    }
  }

  await putCached({ id: item.id, modificationTime: item.modificationTime, size, dhash, blur });
  return { size, dhash, blur };
}

async function mapPool<T>(items: T[], fn: (item: T) => Promise<void>, onTick: () => void, signal: { cancelled: boolean }, workers = WORKERS) {
  let i = 0;
  const worker = async () => {
    while (i < items.length && !signal.cancelled) {
      const item = items[i++];
      try {
        await fn(item);
      } catch {
        // Keep the pool moving; a single bad asset must not freeze the scan.
      }
      onTick();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, items.length || 1)) }, worker));
}

export type ScanHandlers = {
  onProgress: (p: Progress) => void;
  onCategory: (p: CategoryProgress) => void;
  onPartial: (result: ScanResult) => void;
  onError?: (message: string) => void;
};

export async function scanLibrary(
  handlers: ScanHandlers,
  signal: { cancelled: boolean } = { cancelled: false },
): Promise<ScanResult> {
  const { onProgress, onCategory, onPartial, onError } = handlers;
  const result = emptyScanResult();

  const failCats = (message: string) => {
    onError?.(message);
    (['photos', 'screenshots', 'videos'] as const).forEach((category) =>
      onCategory({ category, status: 'done', done: 0, total: 0 }),
    );
  };

  try {
    const photos: MediaLibrary.Asset[] = [];
    const videos: MediaLibrary.Asset[] = [];

    let after: string | undefined;
    let read = 0;
    onProgress({ phase: 'reading', done: 0, total: 0 });
    onCategory({ category: 'photos', status: 'running', done: 0, total: 0 });
    onCategory({ category: 'screenshots', status: 'running', done: 0, total: 0 });
    onCategory({ category: 'videos', status: 'running', done: 0, total: 0 });

    for (;;) {
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
      if (!page) {
        failCats('Timed out while reading your library. Check your connection to iCloud photos and try again.');
        return result;
      }
      for (const a of page.assets) (a.mediaType === 'video' ? videos : photos).push(a);
      read += page.assets.length;
      onProgress({ phase: 'reading', done: read, total: page.totalCount });
      if (!page.hasNextPage || signal.cancelled || read >= MAX_ASSETS) break;
      after = page.endCursor;
    }

    result.photoCount = photos.length;
    result.videoCount = videos.length;
    onPartial({ ...result, scannedAt: Date.now() });

    const screenshotAssets = photos.filter(isScreenshot);
    const photoAssets = photos.filter((a) => !isScreenshot(a));
    const liveAssets = photos.filter(isLive);
    const videoAssets = videos.filter((a) => a.duration >= 3);

    const liveItems = liveAssets.map(toItem);
    void pruneCache([...photos, ...videos].map((a) => a.id));

    const screenshots = screenshotAssets.map(toItem);
    onCategory({ category: 'screenshots', status: 'running', done: 0, total: screenshots.length });
    let shotDone = 0;
    await mapPool(
      screenshots,
      async (item) => {
        const e = await enrich(item, false);
        item.size = e.size;
      },
      () => {
        shotDone++;
        onCategory({ category: 'screenshots', status: 'running', done: shotDone, total: screenshots.length });
        onProgress({ phase: 'analyzing', category: 'screenshots', done: shotDone, total: screenshots.length });
      },
      signal,
    );
    if (signal.cancelled) return result;
    Object.assign(result, buildScanResult({
      photoCount: photos.length,
      videoCount: videos.length,
      photos: [],
      screenshots,
      livePhotos: [],
      videos: [],
    }));
    onCategory({ category: 'screenshots', status: 'done', done: screenshots.length, total: screenshots.length });
    onPartial({ ...result });

    const videoItems = videoAssets.map(toItem);
    onCategory({ category: 'videos', status: 'running', done: 0, total: videoItems.length });
    let vidDone = 0;
    await mapPool(
      videoItems,
      async (item) => {
        const e = await enrich(item, false);
        item.size = e.size;
      },
      () => {
        vidDone++;
        onCategory({ category: 'videos', status: 'running', done: vidDone, total: videoItems.length });
        onProgress({ phase: 'analyzing', category: 'videos', done: vidDone, total: videoItems.length });
      },
      signal,
    );
    if (signal.cancelled) return result;
    Object.assign(result, buildScanResult({
      photoCount: photos.length,
      videoCount: videos.length,
      photos: [],
      screenshots,
      livePhotos: [],
      videos: videoItems,
    }));
    onCategory({ category: 'videos', status: 'done', done: videoItems.length, total: videoItems.length });
    onPartial({ ...result });

    const photoItems = photoAssets.map(toItem);
    const photoWork = photoItems.length + liveItems.length;
    onCategory({ category: 'photos', status: 'running', done: 0, total: photoWork || photoItems.length });
    let photoDone = 0;
    const tickPhoto = () => {
      photoDone++;
      onCategory({ category: 'photos', status: 'running', done: photoDone, total: photoWork || photoItems.length });
      onProgress({ phase: 'analyzing', category: 'photos', done: photoDone, total: photoWork || photoItems.length });
    };

    const hashes: { item: Item; dhash: string }[] = [];
    const blurry: Item[] = [];

    await mapPool(
      photoItems,
      async (item) => {
        const e = await enrich(item, true);
        item.size = e.size;
        if (e.dhash) hashes.push({ item, dhash: e.dhash });
        if (e.blur != null && isBlurry(e.blur)) blurry.push(item);
      },
      tickPhoto,
      signal,
    );
    await mapPool(
      liveItems,
      async (item) => {
        const e = await enrich(item, false);
        item.size = e.size;
      },
      tickPhoto,
      signal,
    );
    if (signal.cancelled) return result;

    Object.assign(
      result,
      buildScanResult({
        photoCount: photos.length,
        videoCount: videos.length,
        photos: photoItems,
        screenshots,
        livePhotos: liveItems,
        videos: videoItems,
        hashes,
        blurry,
      }),
    );
    onCategory({ category: 'photos', status: 'done', done: photoWork, total: photoWork });
    onPartial({ ...result });
    return result;
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : 'The scan hit a problem. You can try again.';
    failCats(message);
    return result;
  }
}

export async function deleteItems(items: Item[]): Promise<boolean> {
  if (!items.length) return false;
  return MediaLibrary.deleteAssetsAsync(items.map((i) => i.id));
}
