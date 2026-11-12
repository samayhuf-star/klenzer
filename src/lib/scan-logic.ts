/** Pure scan grouping and classification. No Expo or native imports, so unit tests can run in Node. */

export type Item = {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  duration: number;
  size: number;
  isVideo: boolean;
};

export type DuplicateGroup = { key: string; items: Item[] };

export type ScanResult = {
  scannedAt: number;
  photoCount: number;
  videoCount: number;
  duplicates: DuplicateGroup[];
  similar: DuplicateGroup[];
  screenshots: Item[];
  largeVideos: Item[];
  duplicateVideos: DuplicateGroup[];
  livePhotos: Item[];
  blurry: Item[];
};

export const LARGE_VIDEO_BYTES = 100 * 1e6;
export const HAMMING_MAX = 8;

export const emptyScanResult = (): ScanResult => ({
  scannedAt: Date.now(),
  photoCount: 0,
  videoCount: 0,
  duplicates: [],
  similar: [],
  screenshots: [],
  largeVideos: [],
  duplicateVideos: [],
  livePhotos: [],
  blurry: [],
});

export const isScreenshotName = (filename: string, subtypes?: string[] | null) =>
  !!subtypes?.includes('screenshot') || /^screenshot/i.test(filename);

export const isLivePhoto = (mediaType: string, subtypes?: string[] | null, screenshot?: boolean) =>
  mediaType === 'photo' && !!subtypes?.includes('livePhoto') && !screenshot;

export function exactKey(item: Item): string {
  const second = Math.round(item.creationTime / 1000);
  const sizePart = item.size > 0 ? String(item.size) : 'unk';
  const durationPart = item.isVideo ? `|${Math.round(item.duration)}` : '';
  return `${sizePart}|${item.width}x${item.height}|${second}${durationPart}`;
}

export function groupExact(items: Item[]): DuplicateGroup[] {
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

export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      n += x & 1;
      x >>= 1;
    }
  }
  return n;
}

export function groupSimilar(items: { item: Item; dhash: string }[], maxHamming = HAMMING_MAX): DuplicateGroup[] {
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
        if (hamming(seed.dhash, other.dhash) <= maxHamming) members.push(other.item);
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

export const sum = (items: Item[]) => items.reduce((n, i) => n + i.size, 0);
export const dupExtras = (g: DuplicateGroup) => g.items.slice(1);
export const dupReclaimable = (groups: DuplicateGroup[]) => groups.reduce((n, g) => n + sum(dupExtras(g)), 0);
export const dupExtraCount = (groups: DuplicateGroup[]) => groups.reduce((n, g) => n + g.items.length - 1, 0);

/** Build the categorized result after items have sizes (and optional hashes). Used by the scanner and by tests. */
export function buildScanResult(input: {
  photoCount: number;
  videoCount: number;
  photos: Item[];
  screenshots: Item[];
  livePhotos: Item[];
  videos: Item[];
  hashes?: { item: Item; dhash: string }[];
  blurry?: Item[];
}): ScanResult {
  const duplicates = groupExact(input.photos);
  const inExact = new Set(duplicates.flatMap((g) => g.items.map((i) => i.id)));
  const similar = groupSimilar((input.hashes ?? []).filter((h) => !inExact.has(h.item.id)));
  return {
    scannedAt: Date.now(),
    photoCount: input.photoCount,
    videoCount: input.videoCount,
    duplicates,
    similar,
    screenshots: [...input.screenshots].sort((a, b) => b.size - a.size),
    largeVideos: input.videos.filter((v) => v.size >= LARGE_VIDEO_BYTES).sort((a, b) => b.size - a.size),
    duplicateVideos: groupExact(input.videos),
    livePhotos: [...input.livePhotos].sort((a, b) => b.size - a.size),
    blurry: [...(input.blurry ?? [])].sort((a, b) => a.creationTime - b.creationTime),
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
