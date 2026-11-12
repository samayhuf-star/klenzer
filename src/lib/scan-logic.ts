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
  dhash?: string | null;
  blur?: number | null;
  isScreenshot?: boolean;
  isLive?: boolean;
};

export const BLUR_THRESHOLD = 80;
export const isBlurryVariance = (variance: number) => variance > 0 && variance < BLUR_THRESHOLD;

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
  /** Every still (regular, screenshot and Live Photo), largest first. Shown on the Photos card. */
  photos: Item[];
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
  photos: [],
});

export const isScreenshotName = (filename: string, subtypes?: string[] | null) =>
  !!subtypes?.includes('screenshot') || /^screenshot/i.test(filename);

export const isLivePhoto = (mediaType: string, subtypes?: string[] | null, screenshot?: boolean) =>
  mediaType === 'photo' && !!subtypes?.includes('livePhoto') && !screenshot;

export const SIMILAR_WINDOW_MS = 60_000;

export function exactKey(item: Item): string {
  const second = Math.round(item.creationTime / 1000);
  const sizePart = item.size > 0 ? String(item.size) : 'unk';
  const durationPart = item.isVideo ? `|${Math.round(item.duration)}` : '';
  return `${sizePart}|${item.width}x${item.height}|${second}${durationPart}`;
}

/** Same capture second and dimensions, used to surface exact duplicates before sizes are known. */
export function metaExactKey(item: Item): string {
  const second = Math.round(item.creationTime / 1000);
  const durationPart = item.isVideo ? `|${Math.round(item.duration)}` : '';
  return `${item.width}x${item.height}|${second}${durationPart}`;
}

export function filenameExactKey(item: Item): string | null {
  const name = item.filename?.trim().toLowerCase();
  if (!name) return null;
  return `fn:${name}|${item.width}x${item.height}`;
}

function toGroups(buckets: Map<string, Item[]>, used: Set<string>): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  for (const [key, list] of buckets) {
    const fresh = list.filter((i) => !used.has(i.id));
    if (fresh.length < 2) continue;
    // If sizes are known and disagree, split; unsized items stay with the matching-size majority when possible.
    const bySize = new Map<number, Item[]>();
    const unknown: Item[] = [];
    for (const item of fresh) {
      if (item.size > 0) {
        const row = bySize.get(item.size);
        if (row) row.push(item);
        else bySize.set(item.size, [item]);
      } else unknown.push(item);
    }
    const sizeGroups = [...bySize.values()];
    if (!sizeGroups.length) {
      // Cheap-key matches stay candidates until at least two items have a confirmed file size.
      continue;
    }
    for (const sized of sizeGroups) {
      const items = [...sized].sort((a, b) => b.size - a.size || a.creationTime - b.creationTime);
      if (items.length + (sizeGroups.length === 1 ? unknown.length : 0) < 2 && items.length < 2) continue;
      if (sizeGroups.length === 1) items.push(...unknown);
      if (items.length < 2) continue;
      for (const i of items) used.add(i.id);
      groups.push({ key: `${key}|${items[0].size || 'm'}`, items });
    }
  }
  return groups;
}

export function groupExact(items: Item[]): DuplicateGroup[] {
  const byMeta = new Map<string, Item[]>();
  const byName = new Map<string, Item[]>();
  for (const item of items) {
    const meta = metaExactKey(item);
    const m = byMeta.get(meta);
    if (m) m.push(item);
    else byMeta.set(meta, [item]);
    const fn = filenameExactKey(item);
    if (fn) {
      const n = byName.get(fn);
      if (n) n.push(item);
      else byName.set(fn, [item]);
    }
  }
  const used = new Set<string>();
  const groups = [...toGroups(byMeta, used), ...toGroups(byName, used)];
  return groups.sort((a, b) => b.items[0].creationTime - a.items[0].creationTime);
}


/** Items that share a cheap exact-dup key (dimensions + capture second, or filename + dimensions). Size is confirmed only for these. */
export function exactCandidateItems(items: Item[]): Item[] {
  const meta = new Map<string, number>();
  const names = new Map<string, number>();
  for (const item of items) {
    const m = metaExactKey(item);
    meta.set(m, (meta.get(m) ?? 0) + 1);
    const fn = filenameExactKey(item);
    if (fn) names.set(fn, (names.get(fn) ?? 0) + 1);
  }
  return items.filter((item) => {
    if ((meta.get(metaExactKey(item)) ?? 0) > 1) return true;
    const fn = filenameExactKey(item);
    return !!fn && (names.get(fn) ?? 0) > 1;
  });
}

/** Photos worth hashing: only burst neighbours (~60s). Isolated shots are skipped so we never all-pairs the library. */
export function similarHashCandidates(items: Item[]): Item[] {
  if (items.length < 2) return [];
  const sorted = [...items].sort((a, b) => a.creationTime - b.creationTime);
  const burst = new Set<string>();
  for (let i = 0; i < sorted.length; i++) {
    const prev = i > 0 && sorted[i].creationTime - sorted[i - 1].creationTime <= SIMILAR_WINDOW_MS;
    const next = i + 1 < sorted.length && sorted[i + 1].creationTime - sorted[i].creationTime <= SIMILAR_WINDOW_MS;
    if (prev || next) burst.add(sorted[i].id);
  }
  return items.filter((item) => burst.has(item.id));
}

export function groupSimilarWindowed(items: { item: Item; dhash: string }[], maxHamming = HAMMING_MAX): DuplicateGroup[] {
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
    const sorted = [...bucket].sort((a, b) => a.item.creationTime - b.item.creationTime);
    for (let i = 0; i < sorted.length; i++) {
      const seed = sorted[i];
      if (used.has(seed.item.id)) continue;
      const members = [seed.item];
      for (let j = i + 1; j < sorted.length; j++) {
        const other = sorted[j];
        if (used.has(other.item.id)) continue;
        const close = Math.abs(other.item.creationTime - seed.item.creationTime) <= SIMILAR_WINDOW_MS;
        const sameDim = other.item.width === seed.item.width && other.item.height === seed.item.height;
        if (!close && !sameDim) continue;
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
  const similar = groupSimilarWindowed((input.hashes ?? []).filter((h) => !inExact.has(h.item.id)));
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
    blurry: [...(input.blurry ?? input.photos.filter((p) => p.blur != null && isBlurryVariance(p.blur)))].sort((a, b) => a.creationTime - b.creationTime),
    photos: [...input.photos, ...input.screenshots, ...input.livePhotos].sort((a, b) => b.size - a.size),
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
