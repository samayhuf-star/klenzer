import type { ShotScene } from './screenshotMode';
import type { DuplicateGroup, Item, Progress, ScanResult } from './scanner';

const GB = 1_000_000_000;
const MB = 1_000_000;

const DISK = { total: 256 * GB, free: 41.2 * GB, used: 256 * GB - 41.2 * GB };

/** Same four clips the results card totals as 3.2 GB. Biggest (recordings) first. */
const LARGE_VIDEOS: Item[] = [
  video('v1', '/shot-samples/vid-rec-1.jpg', 1.5 * GB, 8 * 60 + 24, 'Screen Recording.mp4', Date.UTC(2026, 9, 18, 16, 2)),
  video('v2', '/shot-samples/vid-rec-2.jpg', 1.1 * GB, 12 * 60 + 6, 'Screen Recording 2.mp4', Date.UTC(2026, 9, 11, 9, 40)),
  video('v3', '/shot-samples/vid-clip.jpg', 420 * MB, 3 * 60 + 41, 'IMG_4412.mp4', Date.UTC(2026, 7, 2, 18, 15)),
  video('v4', '/shot-samples/vid-clip-2.jpg', 180 * MB, 48, 'IMG_3901.mp4', Date.UTC(2026, 6, 20, 11, 5)),
];

export type ShotFixture = {
  disk: { total: number; free: number; used: number };
  scanning: boolean;
  progress: Progress | null;
  result: ScanResult | null;
  tempSize: number;
};

export function buildFixture(scene: ShotScene): ShotFixture {
  if (scene === 'scanning') {
    return {
      disk: DISK,
      scanning: true,
      progress: { phase: 'measuring', done: 1734, total: 2710 },
      result: null,
      tempSize: 0,
    };
  }
  if (scene === 'duplicates') {
    return { disk: DISK, scanning: false, progress: null, result: duplicateReview(), tempSize: 0 };
  }
  if (scene === 'results' || scene === 'control') {
    return { disk: DISK, scanning: false, progress: null, result: library(), tempSize: 22 * MB };
  }
  return { disk: DISK, scanning: false, progress: null, result: null, tempSize: 0 };
}

function library(): ScanResult {
  return {
    scannedAt: Date.UTC(2026, 10, 14, 9, 41),
    photoCount: 4286,
    videoCount: 86,
    duplicates: duplicateGroups(64, 1.1 * GB),
    screenshots: photos('shot', 186, 240 * MB),
    largeVideos: LARGE_VIDEOS,
    livePhotos: photos('live', 28, 96 * MB),
  };
}

/** Two near-identical pairs. The larger file in each pair is the one the app keeps. */
function duplicateReview(): ScanResult {
  const morning = Date.UTC(2026, 5, 12, 15, 4);
  const evening = Date.UTC(2026, 4, 3, 19, 18);
  return {
    scannedAt: Date.UTC(2026, 10, 14, 9, 41),
    photoCount: 1280,
    videoCount: 42,
    duplicates: [
      pair('m', '/shot-samples/dup-a.jpg', '/shot-samples/dup-b.jpg', 4.8 * MB, 4.2 * MB, morning),
      pair('e', '/shot-samples/dup-c.jpg', '/shot-samples/dup-d.jpg', 5.1 * MB, 4.6 * MB, evening),
    ],
    screenshots: [],
    largeVideos: LARGE_VIDEOS,
    livePhotos: [],
  };
}

function duplicateGroups(groups: number, extraBytes: number): DuplicateGroup[] {
  const base = Math.floor(extraBytes / groups);
  return Array.from({ length: groups }, (_, i) => {
    const extra = i === groups - 1 ? extraBytes - base * (groups - 1) : base;
    const time = Date.UTC(2026, 5, 1 + (i % 27), 12, i % 50);
    return pair(`g${i}`, '/shot-samples/dup-a.jpg', '/shot-samples/dup-b.jpg', extra + 600_000, extra, time);
  });
}

function photos(prefix: string, count: number, total: number): Item[] {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) =>
    item({
      id: `${prefix}${i}`,
      size: i === count - 1 ? total - base * (count - 1) : base,
      filename: `${prefix}_${i}.jpg`,
    }),
  );
}

function pair(id: string, keepUri: string, extraUri: string, keepSize: number, extraSize: number, time: number): DuplicateGroup {
  const items = [
    item({ id: `${id}-keep`, uri: keepUri, size: keepSize, creationTime: time, filename: `IMG_${id}A.jpg` }),
    item({ id: `${id}-extra`, uri: extraUri, size: extraSize, creationTime: time, filename: `IMG_${id}B.jpg` }),
  ].sort((a, b) => b.size - a.size || a.creationTime - b.creationTime);
  return { key: id, items };
}

function video(id: string, uri: string, size: number, duration: number, filename: string, creationTime: number): Item {
  return item({ id, uri, size, duration, filename, creationTime, isVideo: true, width: 1170, height: 2532 });
}

function item(p: Partial<Item> & Pick<Item, 'id' | 'size'>): Item {
  return {
    uri: '/shot-samples/dup-a.jpg',
    filename: `${p.id}.jpg`,
    width: 3024,
    height: 4032,
    creationTime: Date.UTC(2026, 5, 12, 15, 4),
    duration: 0,
    isVideo: false,
    ...p,
  };
}
