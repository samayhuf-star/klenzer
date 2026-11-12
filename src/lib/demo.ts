/**
 * Dev-only demo data for screenshots on Expo web or a simulator: `EXPO_PUBLIC_DEMO=1 npx expo start --web`.
 * Never active in a production build: `__DEV__` is false there, so DEMO is always false.
 */
import type { DuplicateGroup, Item, ScanResult } from './scan-logic';
import type { ContactRecord } from './contacts-logic';

declare const __DEV__: boolean | undefined;

export const DEMO: boolean = typeof __DEV__ !== 'undefined' && __DEV__ === true && process.env.EXPO_PUBLIC_DEMO === '1';

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 9, 28, 10, 0, 0);

const IMG_BASE = process.env.EXPO_PUBLIC_DEMO_IMG_BASE;
const seedNum = (seed: string) => Array.from(seed).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Demo photo URL. EXPO_PUBLIC_DEMO_IMG_BASE points at a local folder of 0.jpg to 23.jpg for screenshots; otherwise picsum. */
export const pic = (seed: string, w = 600, h = 800) =>
  IMG_BASE ? `${IMG_BASE}/${(/^\d+$/.test(seed) ? Number(seed) : seedNum(seed)) % 24}.jpg` : `https://picsum.photos/seed/klenzer-${seed}/${w}/${h}`;

export function demoItem(n: number, extra: Partial<Item> = {}): Item {
  const isVideo = !!extra.isVideo;
  return {
    id: `demo-${n}`,
    uri: pic(String(n)),
    filename: isVideo ? `IMG_${4000 + n}.MOV` : `IMG_${4000 + n}.HEIC`,
    width: 3024,
    height: 4032,
    creationTime: BASE - Math.floor(n / 3) * 9 * DAY - n * 3_600_000,
    modificationTime: BASE,
    duration: 0,
    size: 1_800_000 + ((n * 7919) % 4_200_000),
    isVideo,
    ...extra,
  };
}

const group = (key: string, items: Item[]): DuplicateGroup => ({ key, items });

export function demoScanResult(): ScanResult {
  const photos = Array.from({ length: 60 }, (_, i) => demoItem(i + 1));
  const screenshots = Array.from({ length: 14 }, (_, i) => demoItem(200 + i, { filename: `Screenshot ${i + 1}.PNG`, isScreenshot: true, width: 1320, height: 2868, size: 900_000 + i * 40_000 }));
  const videos = Array.from({ length: 10 }, (_, i) => demoItem(300 + i, { isVideo: true, duration: i < 5 ? 3 + i : 40 + i * 30, size: 6_000_000 + i * 9_000_000 }));
  const screenRecordings = [0, 1, 2].map((i) => demoItem(400 + i, { isVideo: true, filename: `RPReplay_Final170000000${i}.MP4`, duration: 45 + i * 20, size: 38_000_000 + i * 12_000_000 }));
  // Each group shows the same picture so the demo reads like real look-alike shots.
  const sim = [0, 1, 2, 3].map((g) => group(`s${g}`, [0, 1, 2].map((k) => demoItem(500 + g * 3 + k, { uri: pic(String([3, 6, 21, 13][g])) }))));
  const dup = [0, 1, 2].map((g) => group(`d${g}`, [0, 1].map((k) => demoItem(600 + g * 2 + k, { uri: pic(String([8, 19, 1][g])) }))));
  return {
    scannedAt: BASE,
    photoCount: 4182,
    videoCount: 236,
    duplicates: dup,
    similar: sim,
    screenshots,
    largeVideos: videos.filter((v) => v.size >= 100e6),
    duplicateVideos: [group('v0', [demoItem(700, { isVideo: true, duration: 22, size: 54_000_000 }), demoItem(701, { isVideo: true, duration: 22, size: 54_000_000 })])],
    shortVideos: videos.filter((v) => v.duration <= 10),
    screenRecordings,
    livePhotos: photos.slice(0, 8).map((p) => ({ ...p, isLive: true })),
    blurry: photos.slice(10, 16),
    photos,
  };
}

export function demoContacts(): ContactRecord[] {
  return [
    { id: 'c1', name: 'Priya Sharma', phones: ['+91 98100 12345'], emails: ['priya@example.com'] },
    { id: 'c2', name: 'priya sharma', phones: ['098100 12345'], emails: [] },
    { id: 'c3', name: 'Priya S', phones: ['+91-98100-12345'], emails: ['priya.s@example.com'] },
    { id: 'c4', name: 'Rahul Mehta', phones: ['+1 (415) 555-0134'], emails: [] },
    { id: 'c5', name: 'Rahul Mehta', phones: [], emails: ['rahul@example.com'] },
    { id: 'c6', name: 'Dentist', phones: ['+44 20 7946 0958'], emails: [] },
    { id: 'c7', name: 'Dr. Ana Lopez', phones: ['020 7946 0958'], emails: ['ana@example.com'] },
    { id: 'c8', name: 'Sam Lee', phones: ['+1 212 555 0199'], emails: [] },
  ];
}
