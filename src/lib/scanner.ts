import * as MediaLibrary from 'expo-media-library/legacy';
import { File } from 'expo-file-system';

export type Item = {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  creationTime: number;
  duration: number;
  size: number; // bytes, 0 if unknown (e.g. iCloud-only original)
  isVideo: boolean;
};

export type DuplicateGroup = { key: string; items: Item[] };

export type ScanResult = {
  scannedAt: number;
  photoCount: number;
  videoCount: number;
  duplicates: DuplicateGroup[];
  screenshots: Item[];
  largeVideos: Item[];
};

export type Progress = { phase: 'reading' | 'measuring'; done: number; total: number };

export const LARGE_VIDEO_BYTES = 100 * 1e6;
const PAGE = 400;
const MAX_ASSETS = 60000;
const MAX_MEASURE = 4000;

const toItem = (a: MediaLibrary.Asset): Item => ({
  id: a.id,
  uri: a.uri,
  filename: a.filename,
  width: a.width,
  height: a.height,
  creationTime: a.creationTime,
  duration: a.duration,
  size: 0,
  isVideo: a.mediaType === 'video',
});

const isScreenshot = (a: MediaLibrary.Asset) =>
  a.mediaType === 'photo' &&
  (a.mediaSubtypes?.includes('screenshot') || /^screenshot/i.test(a.filename));

/** Resolve on-disk size without ever downloading from iCloud. */
async function measure(a: Item): Promise<number> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(a.id, { shouldDownloadFromNetwork: false });
    if (!info.localUri) return 0;
    return new File(info.localUri).size ?? 0;
  } catch {
    return 0;
  }
}

async function measureAll(items: Item[], onTick: () => void, signal: { cancelled: boolean }) {
  let i = 0;
  const worker = async () => {
    while (i < items.length && !signal.cancelled) {
      const item = items[i++];
      item.size = await measure(item);
      onTick();
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

export async function scanLibrary(
  onProgress: (p: Progress) => void,
  signal: { cancelled: boolean } = { cancelled: false },
): Promise<ScanResult> {
  const photos: MediaLibrary.Asset[] = [];
  const videos: MediaLibrary.Asset[] = [];

  let after: string | undefined;
  let total = 0;
  let read = 0;
  for (;;) {
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE,
      after,
      mediaType: ['photo', 'video'],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    total = page.totalCount;
    for (const a of page.assets) (a.mediaType === 'video' ? videos : photos).push(a);
    read += page.assets.length;
    onProgress({ phase: 'reading', done: read, total });
    if (!page.hasNextPage || signal.cancelled || read >= MAX_ASSETS) break;
    after = page.endCursor;
  }

  // Duplicates / near-identical: same capture second + same pixel dimensions.
  const buckets = new Map<string, MediaLibrary.Asset[]>();
  for (const a of photos) {
    if (isScreenshot(a)) continue;
    const key = `${a.width}x${a.height}|${Math.round(a.creationTime / 1000)}`;
    const list = buckets.get(key);
    if (list) list.push(a);
    else buckets.set(key, [a]);
  }
  const dupAssets = [...buckets.entries()].filter(([, l]) => l.length > 1);
  const dupItems = new Map<string, Item>();
  for (const [, list] of dupAssets) for (const a of list) dupItems.set(a.id, toItem(a));

  const screenshots = photos.filter(isScreenshot).map(toItem);
  const videoItems = videos.map(toItem).filter((v) => v.duration >= 3);

  // Measure sizes for everything we might show (bounded).
  const toMeasure = [...dupItems.values(), ...screenshots.slice(0, MAX_MEASURE), ...videoItems.slice(0, MAX_MEASURE)];
  let measured = 0;
  onProgress({ phase: 'measuring', done: 0, total: toMeasure.length });
  await measureAll(toMeasure, () => onProgress({ phase: 'measuring', done: ++measured, total: toMeasure.length }), signal);

  const duplicates: DuplicateGroup[] = dupAssets
    .map(([key, list]) => ({
      key,
      // Largest file first: that's the one we keep by default.
      items: list.map((a) => dupItems.get(a.id)!).sort((x, y) => y.size - x.size || x.creationTime - y.creationTime),
    }))
    .sort((a, b) => b.items[0].creationTime - a.items[0].creationTime);

  return {
    scannedAt: Date.now(),
    photoCount: photos.length,
    videoCount: videos.length,
    duplicates,
    screenshots: screenshots.sort((a, b) => b.size - a.size),
    largeVideos: videoItems.filter((v) => v.size >= LARGE_VIDEO_BYTES).sort((a, b) => b.size - a.size),
  };
}

export const sum = (items: Item[]) => items.reduce((n, i) => n + i.size, 0);

/** Items safe to pre-select in a duplicate group: everything except the one we keep. */
export const dupExtras = (g: DuplicateGroup) => g.items.slice(1);

export const dupReclaimable = (groups: DuplicateGroup[]) => groups.reduce((n, g) => n + sum(dupExtras(g)), 0);
export const dupExtraCount = (groups: DuplicateGroup[]) => groups.reduce((n, g) => n + g.items.length - 1, 0);

export async function deleteItems(items: Item[]): Promise<boolean> {
  if (!items.length) return false;
  // The OS shows its own confirmation dialog; resolves false if the user cancels.
  return MediaLibrary.deleteAssetsAsync(items.map((i) => i.id));
}
