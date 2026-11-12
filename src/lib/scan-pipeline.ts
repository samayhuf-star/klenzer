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
  /** Weighted 0–100 across stages. Monotonic: never lower than a previous tick. */
  percent?: number;
};

export const STAGE_WEIGHTS = { reading: 12, sizing: 55, hashing: 18, blur: 15 } as const;
export type StageKey = keyof typeof STAGE_WEIGHTS;
export type StageState = { done: number; total: number; reached: boolean; complete?: boolean };

/** Per-stage weighted progress. Later stages contribute 0 until reached; a reached stage with no work counts as complete. */
export function weightedScanPercent(stages: Record<StageKey, StageState>, floor = 0): number {
  let raw = 0;
  for (const key of Object.keys(STAGE_WEIGHTS) as StageKey[]) {
    const weight = STAGE_WEIGHTS[key];
    const stage = stages[key];
    if (!stage.reached) continue;
    // A reached stage with an unknown total (0, not yet complete) contributes nothing so the
    // opening "reading" tick does not jump to 12% and then freeze.
    if (stage.total <= 0) {
      if (stage.complete) raw += weight;
      continue;
    }
    raw += weight * Math.min(1, Math.max(0, stage.done / stage.total));
  }
  return Math.max(floor, Math.min(100, Math.round(raw)));
}

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

async function mapPool<T>(items: T[], workers: number, fn: (item: T) => Promise<void>, onDone?: () => void): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        await fn(items[i]);
      } catch {}
      onDone?.();
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
  let percentFloor = 0;
  const stages: Record<StageKey, StageState> = {
    reading: { done: 0, total: 0, reached: true },
    sizing: { done: 0, total: 0, reached: false },
    hashing: { done: 0, total: 0, reached: false },
    blur: { done: 0, total: 0, reached: false },
  };
  let latest: Progress = { phase: 'reading', done: 0, total: 0, label: 'Reading your library…', percent: 0 };
  const pushProgress = (p: Progress, force = false) => {
    percentFloor = weightedScanPercent(stages, percentFloor);
    const next = { ...p, percent: percentFloor };
    latest = next;
    const t = now();
    if (force || t - lastProgress >= 250) {
      onProgress(next);
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
      stages.reading.done = seen.size;
      stages.reading.total = total || seen.size;
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
    stages.reading.done = stages.reading.total = Math.max(stages.reading.total, seen.size);
    stages.reading.complete = true;
    stages.sizing.reached = true;
    stages.sizing.total = sizeQueue.length;
    stages.sizing.done = 0;

    const reportSize = (force = false) => {
      const sized = measured.size;
      const category: ScanCategory =
        sized <= screenshots.length ? 'screenshots' : sized <= screenshots.length + videos.length ? 'videos' : 'photos';
      stages.sizing.done = sized;
      pushProgress({
        phase: 'analyzing',
        done: sized,
        total: sizeQueue.length,
        category,
        label: `Matched ${sized.toLocaleString()} of ${sizeQueue.length.toLocaleString()}`,
      }, force);
    };

    for (let start = 0; start < sizeQueue.length && !cancelled(signal); start += sizeBatch) {
      const batch = sizeQueue.slice(start, start + sizeBatch);
      await mapPool(batch, workers, async (item) => {
        if (cancelled(signal)) return;
        try {
          apply(item, await enrich(item, 'size'));
        } catch {}
        measured.add(item.id);
      }, () => reportSize(false));
      reportSize(true);
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

    stages.sizing.done = stages.sizing.total;
    stages.sizing.complete = true;
    const hashTargets = newestFirst(similarHashCandidates(photos));
    stages.hashing.reached = true;
    stages.hashing.total = hashTargets.length;
    stages.hashing.done = 0;
    stages.hashing.complete = hashTargets.length === 0;
    let hashed = 0;
    const reportHash = (force = false) => {
      pushProgress({
        phase: 'analyzing',
        done: hashed,
        total: hashTargets.length || 1,
        category: 'photos',
        label: hashTargets.length
          ? `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()} · similar ${hashed.toLocaleString()} of ${hashTargets.length.toLocaleString()}`
          : `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()}`,
      }, force);
    };
    reportHash(true);
    for (let start = 0; start < hashTargets.length && !cancelled(signal); start += hashBatch) {
      const batch = hashTargets.slice(start, start + hashBatch);
      await mapPool(batch, Math.max(2, Math.min(workers, 6)), async (item) => {
        if (cancelled(signal) || item.dhash) return;
        try {
          apply(item, await enrich(item, 'hash'));
        } catch {}
      }, () => {
        hashed = Math.min(hashTargets.length, hashed + 1);
        stages.hashing.done = hashed;
        reportHash(false);
      });
      hashed = Math.min(hashTargets.length, start + batch.length);
      stages.hashing.done = hashed;
      reportHash(true);
      emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);
    }
    stages.hashing.done = stages.hashing.total;
    stages.hashing.complete = true;

    const blurTargets = photos.filter((p) => p.blur == null);
    stages.blur.reached = true;
    stages.blur.total = blurTargets.length;
    stages.blur.done = 0;
    stages.blur.complete = blurTargets.length === 0;
    let blurred = 0;
    const reportBlur = (force = false) => {
      pushProgress({
        phase: 'analyzing',
        done: blurred,
        total: blurTargets.length || 1,
        category: 'photos',
        label: blurTargets.length
          ? `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()} · blurry ${blurred.toLocaleString()} of ${blurTargets.length.toLocaleString()}`
          : `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()}`,
      }, force);
    };
    reportBlur(true);
    for (let start = 0; start < blurTargets.length && !cancelled(signal); start += blurBatch) {
      const batch = blurTargets.slice(start, start + blurBatch);
      await mapPool(batch, 2, async (item) => {
        if (cancelled(signal) || item.blur != null) return;
        try {
          apply(item, await enrich(item, 'blur'));
        } catch {}
      }, () => {
        blurred = Math.min(blurTargets.length, blurred + 1);
        stages.blur.done = blurred;
        reportBlur(false);
      });
      blurred = Math.min(blurTargets.length, start + batch.length);
      stages.blur.done = blurred;
      reportBlur(true);
      emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);
    }
    stages.blur.done = stages.blur.total;
    stages.blur.complete = true;

    if (cancelled(signal)) {
      stopTicker();
      return result;
    }

    const final = emit(photos, screenshots, livePhotos, videos, photoCount, videoCount);
    onCategory({ category: 'photos', status: 'done', done: photos.length, total: photos.length });
    if (!shotsDone) onCategory({ category: 'screenshots', status: 'done', done: screenshots.length, total: screenshots.length });
    if (!videosDone) onCategory({ category: 'videos', status: 'done', done: videos.length, total: videos.length });
    stages.reading.reached = stages.sizing.reached = stages.hashing.reached = stages.blur.reached = true;
    if (stages.reading.total <= 0) stages.reading.total = stages.reading.done;
    stages.sizing.done = stages.sizing.total;
    stages.hashing.done = stages.hashing.total;
    stages.blur.done = stages.blur.total;
    stages.blur.complete = true;
    percentFloor = 100;
    pushProgress({
      phase: 'analyzing',
      done: sizeQueue.length,
      total: sizeQueue.length,
      label: `Matched ${sizeQueue.length.toLocaleString()} of ${sizeQueue.length.toLocaleString()}`,
      percent: 100,
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
