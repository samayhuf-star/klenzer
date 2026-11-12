import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { analyzeThumb, hamming, isBlurry } from './image-hash';
import { getCached, pruneCache, putCached } from './scan-cache';

export type Item = {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  duration: number;
  size: number; // bytes, 0 if unknown (e.g. iCloud-only original)
  isVideo: boolean;
};

export type DuplicateGroup = { key: string; items: Item[] };

export type ScanCategory = 'photos' | 'screenshots' | 'videos';

export type CategoryProgress = {
  category: ScanCategory;
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
};

export type ScanResult = {
  scannedAt: number;
  photoCount: number;
  videoCount: number;
  duplicates: DuplicateGroup[];
  similar: DuplicateGroup[];
  screenshots: Item[];
  largeVideos: Item[];
  livePhotos: Item[];
  blurry: Item[];
};

export const emptyScanResult = (): ScanResult => ({
  scannedAt: Date.now(),
  photoCount: 0,
  videoCount: 0,
  duplicates: [],
  similar: [],
  screenshots: [],
  largeVideos: [],
  livePhotos: [],
  blurry: [],
});

export type Progress = { phase: 'reading' | 'analyzing'; done: number; total: number; category?: ScanCategory };

export const LARGE_VIDEO_BYTES = 100 * 1e6;
const PAGE = 400;
const MAX_ASSETS = 60000;
const WORKERS = 4;
const HAMMING_MAX = 8;

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

const isLive = (a: MediaLibrary.Asset) =>
  a.mediaType === 'photo' && !!a.mediaSubtypes?.includes('livePhoto') && !isScreenshot(a);

const isScreenshot = (a: MediaLibrary.Asset) =>
  a.mediaType === 'photo' &&
  (a.mediaSubtypes?.includes('screenshot') || /^screenshot/i.test(a.filename));

async function localUriFor(id: string): Promise<string | null> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false });
    return info.localUri ?? null;
  } catch {
    return null;
  }
}

type Enrichment = { size: number; dhash: string | null; blur: number | null };

async function enrich(item: Item, wantHash: boolean): Promise<Enrichment> {
  const cached = await getCached(item.id, item.modificationTime);
  if (cached && (!wantHash || cached.dhash != null || cached.size === 0)) {
    // size-only cache hit is enough when we don't need a hash, or we already tried and have no local file (size 0, no hash).
    if (!wantHash || cached.dhash != null || (cached.dhash == null && cached.blur == null && cached.size === 0)) {
      if (!wantHash || cached.dhash != null || cached.size === 0) {
        return { size: cached.size, dhash: cached.dhash, blur: cached.blur };
      }
    }
    if (!wantHash) return { size: cached.size, dhash: cached.dhash, blur: cached.blur };
    if (cached.dhash != null) return { size: cached.size, dhash: cached.dhash, blur: cached.blur };
  }

  let size = cached?.size ?? 0;
  let uri: string | null = null;
  if (!cached) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(item.id, { shouldDownloadFromNetwork: false });
      uri = info.localUri ?? null;
      if (uri) size = new File(uri).size ?? 0;
    } catch {
      size = 0;
    }
  } else if (wantHash && cached.dhash == null) {
    uri = await localUriFor(item.id);
  }

  let dhash: string | null = cached?.dhash ?? null;
  let blur: number | null = cached?.blur ?? null;
  if (wantHash && dhash == null && uri) {
    const analysis = await analyzeThumb(uri);
    if (analysis) {
      dhash = analysis.dhash;
      blur = analysis.blur;
    }
  }

  const row = { id: item.id, modificationTime: item.modificationTime, size, dhash, blur };
  await putCached(row);
  return { size, dhash, blur };
}

async function mapPool<T>(items: T[], fn: (item: T) => Promise<void>, onTick: () => void, signal: { cancelled: boolean }, workers = WORKERS) {
  let i = 0;
  const worker = async () => {
    while (i < items.length && !signal.cancelled) {
      const item = items[i++];
      await fn(item);
      onTick();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, items.length || 1)) }, worker));
}

function exactKey(item: Item): string {
  const second = Math.round(item.creationTime / 1000);
  const sizePart = item.size > 0 ? String(item.size) : 'unk';
  return `${sizePart}|${item.width}x${item.height}|${second}`;
}

function groupExact(items: Item[]): DuplicateGroup[] {
  const buckets = new Map<string, Item[]>();
  for (const item of items) {
    const key = exactKey(item);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      key,
      items: list.sort((a, b) => b.size - a.size || a.creationTime - b.creationTime),
    }))
    .sort((a, b) => b.items[0].creationTime - a.items[0].creationTime);
}

function groupSimilar(items: { item: Item; dhash: string }[]): DuplicateGroup[] {
  const used = new Set<string>();
  const groups: DuplicateGroup[] = [];
  const buckets = new Map<string, { item: Item; dhash: string }[]>();
  for (const row of items) {
    const prefix = row.dhash.slice(0, 2);
    const list = buckets.get(prefix);
    if (list) list.push(row);
    else buckets.set(prefix, [row]);
  }
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const seed = bucket[i];
      if (used.has(seed.item.id)) continue;
      const members = [seed.item];
      for (let j = i + 1; j < bucket.length; j++) {
        const other = bucket[j];
        if (used.has(other.item.id)) continue;
        if (hamming(seed.dhash, other.dhash) <= HAMMING_MAX) members.push(other.item);
      }
      if (members.length > 1) {
        for (const m of members) used.add(m.id);
        groups.push({
          key: `sim:${seed.dhash}`,
          items: members.sort((a, b) => b.size - a.size || a.creationTime - b.creationTime),
        });
      }
    }
  }
  return groups.sort((a, b) => b.items[0].creationTime - a.items[0].creationTime);
}

export type ScanHandlers = {
  onProgress: (p: Progress) => void;
  onCategory: (p: CategoryProgress) => void;
  onPartial: (result: ScanResult) => void;
};

export async function scanLibrary(
  handlers: ScanHandlers,
  signal: { cancelled: boolean } = { cancelled: false },
): Promise<ScanResult> {
  const { onProgress, onCategory, onPartial } = handlers;
  const result = emptyScanResult();

  const photos: MediaLibrary.Asset[] = [];
  const videos: MediaLibrary.Asset[] = [];

  let after: string | undefined;
  let read = 0;
  onProgress({ phase: 'reading', done: 0, total: 0 });
  onCategory({ category: 'photos', status: 'running', done: 0, total: 0 });
  onCategory({ category: 'screenshots', status: 'running', done: 0, total: 0 });
  onCategory({ category: 'videos', status: 'running', done: 0, total: 0 });

  for (;;) {
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE,
      after,
      mediaType: ['photo', 'video'],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    for (const a of page.assets) (a.mediaType === 'video' ? videos : photos).push(a);
    read += page.assets.length;
    onProgress({ phase: 'reading', done: read, total: page.totalCount });
    if (!page.hasNextPage || signal.cancelled || read >= MAX_ASSETS) break;
    after = page.endCursor;
  }

  result.photoCount = photos.length;
  result.videoCount = videos.length;
  onPartial({ ...result });

  const screenshotAssets = photos.filter(isScreenshot);
  const photoAssets = photos.filter((a) => !isScreenshot(a));
  const liveAssets = photos.filter(isLive);
  const videoAssets = videos.filter((a) => a.duration >= 3);

  const liveItems = liveAssets.map(toItem);
  const allIds = [...photos, ...videos].map((a) => a.id);
  void pruneCache(allIds);

  // --- Screenshots ---
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
  result.screenshots = screenshots.sort((a, b) => b.size - a.size);
  result.scannedAt = Date.now();
  onCategory({ category: 'screenshots', status: 'done', done: screenshots.length, total: screenshots.length });
  onPartial({ ...result });

  // --- Videos ---
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
  result.largeVideos = videoItems.filter((v) => v.size >= LARGE_VIDEO_BYTES).sort((a, b) => b.size - a.size);
  result.scannedAt = Date.now();
  onCategory({ category: 'videos', status: 'done', done: videoItems.length, total: videoItems.length });
  onPartial({ ...result });

  // --- Photos: size, exact dups, then dHash / blur ---
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

  const duplicates = groupExact(photoItems);
  const inExact = new Set(duplicates.flatMap((g) => g.items.map((i) => i.id)));
  const similar = groupSimilar(hashes.filter((h) => !inExact.has(h.item.id)));

  result.duplicates = duplicates;
  result.similar = similar;
  result.blurry = blurry.sort((a, b) => a.creationTime - b.creationTime);
  result.livePhotos = liveItems.sort((a, b) => b.size - a.size);
  result.scannedAt = Date.now();
  onCategory({ category: 'photos', status: 'done', done: photoWork, total: photoWork });
  onPartial({ ...result });
  return result;
}

export const sum = (items: Item[]) => items.reduce((n, i) => n + i.size, 0);

/** Items safe to pre-select in a duplicate group: everything except the one we keep. */
export const dupExtras = (g: DuplicateGroup) => g.items.slice(1);

export const dupReclaimable = (groups: DuplicateGroup[]) => groups.reduce((n, g) => n + sum(dupExtras(g)), 0);
export const dupExtraCount = (groups: DuplicateGroup[]) => groups.reduce((n, g) => n + g.items.length - 1, 0);

export async function deleteItems(items: Item[]): Promise<boolean> {
  if (!items.length) return false;
  // One array → one native performChanges / deleteAssets call. The OS shows its own confirmation.
  return MediaLibrary.deleteAssetsAsync(items.map((i) => i.id));
}
