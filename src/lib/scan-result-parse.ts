import type { DuplicateGroup, Item, ScanResult } from './scan-logic';

function isItem(v: unknown): v is Item {
  if (!v || typeof v !== 'object') return false;
  const i = v as Partial<Item>;
  return typeof i.id === 'string' && typeof i.uri === 'string';
}

function asItems(v: unknown): Item[] {
  return Array.isArray(v) ? v.filter(isItem) : [];
}

function asGroups(v: unknown): DuplicateGroup[] {
  if (!Array.isArray(v)) return [];
  const out: DuplicateGroup[] = [];
  for (const g of v) {
    if (!g || typeof g !== 'object') continue;
    const key = (g as { key?: unknown }).key;
    const items = asItems((g as { items?: unknown }).items);
    if (typeof key === 'string' && items.length > 1) out.push({ key, items });
  }
  return out;
}

function slimItem(item: Item): Item {
  const copy: Item = { ...item };
  delete copy.dhash;
  delete copy.blur;
  return copy;
}

function slimGroups(groups: DuplicateGroup[]): DuplicateGroup[] {
  return groups.map((g) => ({ key: g.key, items: g.items.map(slimItem) }));
}

/** Drop hashes and blur scores. The grouped result is what the home screen needs. */
export function serializeScanResult(result: ScanResult): string {
  const slim: ScanResult = {
    ...result,
    duplicates: slimGroups(result.duplicates ?? []),
    similar: slimGroups(result.similar ?? []),
    duplicateVideos: slimGroups(result.duplicateVideos ?? []),
    screenshots: (result.screenshots ?? []).map(slimItem),
    largeVideos: (result.largeVideos ?? []).map(slimItem),
    shortVideos: (result.shortVideos ?? []).map(slimItem),
    screenRecordings: (result.screenRecordings ?? []).map(slimItem),
    livePhotos: (result.livePhotos ?? []).map(slimItem),
    blurry: (result.blurry ?? []).map(slimItem),
    photos: (result.photos ?? []).map(slimItem),
    forwarded: (result.forwarded ?? []).map(slimItem),
    aiImages: (result.aiImages ?? []).map(slimItem),
  };
  return JSON.stringify(slim);
}

/** Accept a previously saved result. Missing newer arrays become empty. Returns null if it isn't a scan. */
export function parseStoredScanResult(raw: string | null | undefined): ScanResult | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ScanResult>;
    if (!v || typeof v !== 'object') return null;
    if (!Array.isArray(v.screenshots) && !Array.isArray(v.duplicates) && !Array.isArray(v.similar) && !Array.isArray(v.photos)) {
      return null;
    }
    return {
      scannedAt: typeof v.scannedAt === 'number' ? v.scannedAt : 0,
      photoCount: typeof v.photoCount === 'number' ? v.photoCount : 0,
      videoCount: typeof v.videoCount === 'number' ? v.videoCount : 0,
      duplicates: asGroups(v.duplicates),
      similar: asGroups(v.similar),
      screenshots: asItems(v.screenshots),
      largeVideos: asItems(v.largeVideos),
      duplicateVideos: asGroups(v.duplicateVideos),
      shortVideos: asItems(v.shortVideos),
      screenRecordings: asItems(v.screenRecordings),
      livePhotos: asItems(v.livePhotos),
      blurry: asItems(v.blurry),
      photos: asItems(v.photos),
      forwarded: asItems(v.forwarded),
      aiImages: asItems(v.aiImages),
      originAt: typeof v.originAt === 'number' ? v.originAt : undefined,
    };
  } catch {
    return null;
  }
}
