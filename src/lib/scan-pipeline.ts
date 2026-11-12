/** Device-agnostic streaming scan. Injectable I/O so Node tests can drive the real path. */
import {
  buildScanResult,
  emptyScanResult,
  isLivePhoto,
  isScreenshotName,
  similarHashCandidates,
  type Item,
  type ScanResult,
} from './scan-logic';

export type ScanCategory = 'photos' | 'screenshots' | 'videos';

export type CategoryProgress = {
  category: ScanCategory;
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
};

export type Progress = {
  phase: 'reading' | 'analyzing';
  done: number;
  total: number;
  category?: ScanCategory;
  label?: string;
};

export type ScanHandlers = {
  onProgress: (p: Progress) => void;
  onCategory: (p: CategoryProgress) => void;
  onPartial: (result: ScanResult) => void;
  onError?: (message: string) => void;
};

export type ScanSignal = { cancelled: boolean };

export type LibraryAsset = {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  duration: number;
  mediaType: 'photo' | 'video';
  mediaSubtypes?: string[] | null;
};

export type AssetPage = {
  assets: LibraryAsset[];
  hasNextPage: boolean;
  endCursor?: string;
  totalCount: number;
};

export type Enrichment = { size: number; dhash: string | null; blur: number | null };

export type ScanIO = {
  getPage: (after?: string) => Promise<AssetPage | null>;
  enrich: (item: Item, mode: 'size' | 'hash' | 'blur') => Promise<Enrichment>;
  pruneCache?: (ids: string[]) => Promise<void> | void;
  workers?: number;
  sizeBatch?: number;
  hashBatch?: number;
  blurBatch?: number;
  now?: () => number;
};

export const DEFAULT_WORKERS = 8;
export const DEFAULT_SIZE_BATCH = 250;
export const DEFAULT_HASH_BATCH = 80;
export const DEFAULT_BLUR_BATCH = 40;
export const PROGRESS_MAX_GAP_MS = 2000;
export const MAX_ASSETS = 60_000;

function cancelled(signal?: ScanSignal) {
  return !!signal?.cancelled;
}

function itemFromAsset(asset: LibraryAsset): Item {
  const screenshot = isScreenshotName(asset.filename, asset.mediaSubtypes);
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    width: asset.width,
    height: asset.height,
    creationTime: asset.creationTime,
    modificationTime: asset.modificationTime,
    duration: asset.duration ?? 0,
    size: 0,
    isVideo: asset.mediaType === 'video',
    isScreenshot: screenshot,
    isLive: isLivePhoto(asset.mediaType, asset.mediaSubtypes, screenshot),
  };
}

async function mapPool<T>(items: T[], workers: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        await fn(items[i]);
      } catch {}
    }
  }
  const n = Math.max(1, Math.min(workers, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
}

function newestFirst(items: Item[]): Item[] {
  return [...items].sort((a, b) => b.creationTime - a.creationTime);
}

function hashesOf(items: Item[]): { item: Item; dhash: string }[] {
  return items.filter((i) => !!i.dhash).map((i) => ({ item: i, dhash: i.dhash as string }));
}

export async function scanLibraryWithIO(
  handlers: ScanHandlers,
  signal: ScanSignal = { cancelled: false },
  io: ScanIO,
): Promise<ScanResult> {
  const { onProgress, onCategory, onPartial, onError } = handlers;
  const {
    getPage,
    enrich,
    pruneCache,
    workers = DEFAULT_WORKERS,
    sizeBatch = DEFAULT_SIZE_BATCH,
    hashBatch = DEFAULT_HASH_BATCH,
    blurBatch = DEFAULT_BLUR_BATCH,
    now = () => Date.now(),
  } = io;

  const result = emptyScanResult();
  const failCats = (message: string) => {
    onError?.(message);
    (['photos', 'screenshots', 'videos'] as const).forEach((category) =>
      onCategory({ category, status: 'done', done: 0, total: 0 }),
    );
  };

  let lastProgress = 0;
  let latest: Progress = { phase: 'reading', done: 0, total: 0, label: 'Reading your library…' };
  const pushProgress = (p: Progress, force = false) => {
    latest = p;
    const t = now();
    if (force || t - lastProgress >= 250) {
      onProgress(p);
      lastProgress = t;
    }
  };

  let ticker: ReturnType<typeof setInterval> | null = null;
  const startTicker = () => {
    stopTicker();
    ticker = setInterval(() => {
      if (cancelled(signal)) return;
      if (now() - lastProgress >= PROGRESS_MAX_GAP_MS) pushProgress({ ...latest }, true);
    }, 400);
  };
  const stopTicker = () => {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };

  const emit = (photos: Item[], screenshots: Item[], livePhotos: Item[], videos: Item[], photoCount: number, videoCount: number) => {
    const next = buildScanResult({
      photoCount,
      videoCount,
      photos,
      screenshots,
      livePhotos,
      videos,
      hashes: hashesOf(photos),
    });
    Object.assign(result, next);
    onPartial({ ...result });
    return result;
  };

  try {
    startTicker();
    onCategory({ category: 'photos', status: 'running', done: 0, total: 0 });
    onCategory({ category: 'screenshots', status: 'running', done: 0, total: 0 });
    onCategory({ category: 'videos', status: 'running', done: 0, total: 0 });
    pushProgress({ phase: 'reading', done: 0, total: 0, label: 'Reading your library…' }, true);

    const seen = new Set<string>();
    const photoItems: Item[] = [];
    const screenshotItems: Item[] = [];
    const liveItems: Item[] = [];
    const videoItems: Item[] = [];
    let after: string | undefined;
    let total = 0;

    while (!cancelled(signal)) {
      const page = await getPage(after);
      if (!page) break;
      if (!total) total = Math.min(page.totalCount || page.assets.length, MAX_ASSETS);
      for (const asset of page.assets) {
        if (seen.has(asset.id)) continue;
        seen.add(asset.id);
        const item = itemFromAsset(asset);
        if (item.isVideo) videoItems.push(item);
        else if (item.isScreenshot) screenshotItems.push(item);
        else if (item.isLive) liveItems.push(item);
        else photoItems.push(item);
        if (seen.size >= MAX_ASSETS) break;
      }
      pushProgress({
        phase: 'reading',
        done: seen.size,
        total: total || seen.size,
        label: `Reading ${seen.size.toLocaleString()} of ${(total || seen.size).toLocaleString()}…`,
      });
      if (!page.hasNextPage || seen.size >= MAX_ASSETS) break;
      after = page.endCursor;
    }

    if (cancelled(signal)) {
      stopTicker();
      return result;
    }

    const photos = newestFirst(photoItems);
    const screenshots = newestFirst(screenshotItems);
    const livePhotos = newestFirst(liveItems);
    const videos = newestFirst(videoItems);
    const photoCount = photos.length + screenshots.length + livePhotos.length;
    const videoCount = videos.length;
    try {
      await pruneCache?.([...photos, ...screenshots, ...livePhotos, ...videos].map((i) => i.id));
    } catch {}

    // Exact duplicates from size+dims+time or filename, visible before any hash work.
    emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);

    const apply = (item: Item, e: Enrichment) => {
      item.size = e.size;
      if (e.dhash) item.dhash = e.dhash;
      if (e.blur != null) item.blur = e.blur;
    };

    // Size screenshots, then videos, then (newest first) stills and live photos.
    const sizeQueue = [...screenshots, ...videos, ...photos, ...livePhotos];
    const measured = new Set<string>();
    let shotsDone = false;
    let videosDone = false;

    for (let start = 0; start < sizeQueue.length && !cancelled(signal); start += sizeBatch) {
      const batch = sizeQueue.slice(start, start + sizeBatch);
      await mapPool(batch, workers, async (item) => {
        if (cancelled(signal)) return;
        try {
          apply(item, await enrich(item, 'size'));
        } catch {}
        measured.add(item.id);
      });
      const sized = measured.size;
      const category: ScanCategory =
        sized <= screenshots.length ? 'screenshots' : sized <= screenshots.length + videos.length ? 'videos' : 'photos';
      pushProgress({
        phase: 'analyzing',
        done: sized,
        total: sizeQueue.length,
        category,
        label: `Matched ${sized.toLocaleString()} of ${sizeQueue.length.toLocaleString()}`,
      }, true);
      emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);
      if (!shotsDone && screenshots.every((i) => measured.has(i.id))) {
        shotsDone = true;
        onCategory({ category: 'screenshots', status: 'done', done: screenshots.length, total: screenshots.length });
      }
      if (!videosDone && videos.every((i) => measured.has(i.id))) {
        videosDone = true;
        onCategory({ category: 'videos', status: 'done', done: videos.length, total: videos.length });
      }
    }

    if (cancelled(signal)) {
      stopTicker();
      return result;
    }

    const hashTargets = newestFirst(similarHashCandidates(photos));
    for (let start = 0; start < hashTargets.length && !cancelled(signal); start += hashBatch) {
      const batch = hashTargets.slice(start, start + hashBatch);
      await mapPool(batch, Math.max(2, Math.min(workers, 6)), async (item) => {
        if (cancelled(signal) || item.dhash) return;
        try {
          apply(item, await enrich(item, 'hash'));
        } catch {}
      });
      const hashed = Math.min(hashTargets.length, start + batch.length);
      pushProgress({
        phase: 'analyzing',
        done: hashed,
        total: hashTargets.length || 1,
        category: 'photos',
        label: `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()} · similar ${hashed.toLocaleString()} of ${hashTargets.length.toLocaleString()}`,
      }, true);
      emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);
    }

    const blurTargets = photos.filter((p) => p.blur == null);
    for (let start = 0; start < blurTargets.length && !cancelled(signal); start += blurBatch) {
      const batch = blurTargets.slice(start, start + blurBatch);
      await mapPool(batch, 2, async (item) => {
        if (cancelled(signal) || item.blur != null) return;
        try {
          apply(item, await enrich(item, 'blur'));
        } catch {}
      });
      const blurred = Math.min(blurTargets.length, start + batch.length);
      pushProgress({
        phase: 'analyzing',
        done: blurred,
        total: blurTargets.length || 1,
        category: 'photos',
        label: `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()} · blurry ${blurred.toLocaleString()} of ${blurTargets.length.toLocaleString()}`,
      }, true);
      emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);
    }

    if (cancelled(signal)) {
      stopTicker();
      return result;
    }

    const final = emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);
    onCategory({ category: 'photos', status: 'done', done: photos.length, total: photos.length });
    if (!shotsDone) onCategory({ category: 'screenshots', status: 'done', done: screenshots.length, total: screenshots.length });
    if (!videosDone) onCategory({ category: 'videos', status: 'done', done: videos.length, total: videos.length });
    pushProgress({
      phase: 'analyzing',
      done: sizeQueue.length,
      total: sizeQueue.length,
      label: `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()}`,
    }, true);
    stopTicker();
    return final;
  } catch (err) {
    stopTicker();
    const message = err instanceof Error && err.message ? err.message : 'The scan hit a problem. You can try again.';
    failCats(message);
    return result;
  } finally {
    stopTicker();
  }
}
