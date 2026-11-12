import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildScanResult,
  dupExtraCount,
  dupReclaimable,
  exactKey,
  groupExact,
  groupSimilar,
  hamming,
  isScreenshotName,
  LARGE_VIDEO_BYTES,
  sum,
  withTimeout,
  type Item,
} from '../src/lib/scan-logic';

const item = (partial: Partial<Item> & Pick<Item, 'id'>): Item => ({
  uri: `file:///${partial.id}.jpg`,
  filename: `${partial.id}.jpg`,
  width: 1000,
  height: 1000,
  creationTime: 1_700_000_000_000,
  modificationTime: 1_700_000_000_000,
  duration: 0,
  size: 2_000_000,
  isVideo: false,
  ...partial,
});

describe('classification', () => {
  it('detects screenshots by filename and subtype', () => {
    assert.equal(isScreenshotName('Screenshot 2024-01-01.png', null), true);
    assert.equal(isScreenshotName('IMG_001.jpg', ['screenshot']), true);
    assert.equal(isScreenshotName('IMG_001.jpg', null), false);
  });
});

describe('exact grouping', () => {
  it('groups photos that share size, dimensions and the same creation second', () => {
    const a = item({ id: 'a', size: 4_000_000, width: 12, height: 8, creationTime: 1000 });
    const b = item({ id: 'b', size: 4_000_000, width: 12, height: 8, creationTime: 1400 });
    const c = item({ id: 'c', size: 4_000_000, width: 12, height: 8, creationTime: 3000 });
    const groups = groupExact([a, b, c]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].items.map((i) => i.id).sort(), ['a', 'b']);
    assert.equal(exactKey(a), exactKey(b));
    assert.notEqual(exactKey(a), exactKey(c));
  });

  it('groups videos by size, dimensions, duration and creation second', () => {
    const a = item({ id: 'v1', isVideo: true, size: 80_000_000, duration: 12.2, width: 1920, height: 1080, creationTime: 5000 });
    const b = item({ id: 'v2', isVideo: true, size: 80_000_000, duration: 12.4, width: 1920, height: 1080, creationTime: 5300 });
    const c = item({ id: 'v3', isVideo: true, size: 80_000_000, duration: 20, width: 1920, height: 1080, creationTime: 5300 });
    const groups = groupExact([a, b, c]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].items.map((i) => i.id).sort(), ['v1', 'v2']);
  });
});

describe('similar grouping', () => {
  it('clusters near-identical dHashes in the same prefix bucket', () => {
    // 16 hex chars = 64-bit dHash. Flip two bits so Hamming distance is 2.
    const seed = 'aaaaaaaaaaaaaaaa';
    const near = 'aaaaaaaacaaaaaaa';
    const far = 'ffffffffffffffff';
    assert.equal(hamming(seed, near), 2);
    assert.ok(hamming(seed, far) > 8);
    const groups = groupSimilar([
      { item: item({ id: 's1' }), dhash: seed },
      { item: item({ id: 's2' }), dhash: near },
      { item: item({ id: 's3' }), dhash: far },
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].items.map((i) => i.id).sort(), ['s1', 's2']);
  });
});

describe('buildScanResult', () => {
  it('counts screenshots, a large video, and duplicate videos for the Home cards', () => {
    const shot = item({ id: 'shot', filename: 'Screenshot.png', size: 3_000_000 });
    const photoA = item({ id: 'p1', size: 5_000_000, creationTime: 2000 });
    const photoB = item({ id: 'p2', size: 5_000_000, creationTime: 2400 });
    const unique = item({ id: 'p3', size: 1_000_000, creationTime: 9000 });
    const large = item({ id: 'vid-large', isVideo: true, size: LARGE_VIDEO_BYTES, duration: 40, uri: 'file:///vid-large.mp4' });
    const smallVid = item({ id: 'vid-small', isVideo: true, size: 20_000_000, duration: 8, uri: 'file:///vid-small.mp4' });
    const dupA = item({ id: 'vd1', isVideo: true, size: 60_000_000, duration: 15, creationTime: 8000, uri: 'file:///vd1.mp4' });
    const dupB = item({ id: 'vd2', isVideo: true, size: 60_000_000, duration: 15, creationTime: 8100, uri: 'file:///vd2.mp4' });

    const result = buildScanResult({
      photoCount: 4,
      videoCount: 4,
      photos: [photoA, photoB, unique],
      screenshots: [shot],
      livePhotos: [],
      videos: [large, smallVid, dupA, dupB],
      hashes: [
        { item: unique, dhash: 'bbbbbbbbbbbbbbbb' },
        { item: item({ id: 'p4', size: 1_100_000, creationTime: 9100 }), dhash: 'bbbbbbbbbbbbbbba' },
      ],
    });

    assert.equal(result.screenshots.length, 1);
    assert.equal(dupExtraCount(result.duplicates), 1);
    assert.equal(result.largeVideos.length, 1);
    assert.equal(result.largeVideos[0].id, 'vid-large');
    assert.equal(dupExtraCount(result.duplicateVideos), 1);
    assert.equal(result.photoCount, 4);
    assert.equal(result.videoCount, 4);
    // similar hash p4 is not in photos; still grouped
    assert.equal(dupExtraCount(result.similar), 1);
    assert.equal(sum(result.screenshots), 3_000_000);
    assert.ok(dupReclaimable(result.duplicates) > 0);
  });
});

describe('timeouts', () => {
  it('returns the fallback when a promise never settles', async () => {
    const hanging = new Promise<string>(() => {});
    const started = Date.now();
    const value = await withTimeout(hanging, 40, 'fallback');
    const elapsed = Date.now() - started;
    assert.equal(value, 'fallback');
    assert.ok(elapsed >= 30, `expected ~40ms, got ${elapsed}`);
    assert.ok(elapsed < 400, `timeout took too long: ${elapsed}`);
  });

  it('returns the resolved value when it arrives in time', async () => {
    const value = await withTimeout(Promise.resolve('ok'), 200, 'fallback');
    assert.equal(value, 'ok');
  });
});

/** Mirrors the Home spinner rule: a category keeps spinning until its status is done. */
function spinnerFor(scanning: boolean, status: 'idle' | 'running' | 'done') {
  return scanning && status !== 'done';
}

describe('scan stages stream counts and stop Home spinners', () => {
  it('fills cards as each category finishes and stops every spinner at the end', () => {
    const shots = [item({ id: 's1', filename: 'Screenshot 1.png', size: 2_500_000 })];
    const videos = [
      item({ id: 'big', isVideo: true, size: LARGE_VIDEO_BYTES + 1, duration: 90, uri: 'file:///big.mp4' }),
      item({ id: 'd1', isVideo: true, size: 70_000_000, duration: 11, creationTime: 1000, uri: 'file:///d1.mp4' }),
      item({ id: 'd2', isVideo: true, size: 70_000_000, duration: 11, creationTime: 1100, uri: 'file:///d2.mp4' }),
    ];
    const photos = [
      item({ id: 'a', size: 4_000_000, creationTime: 2000 }),
      item({ id: 'b', size: 4_000_000, creationTime: 2300 }),
    ];

    let scanning = true;
    const cats = {
      photos: 'running' as 'running' | 'done',
      screenshots: 'running' as 'running' | 'done',
      videos: 'running' as 'running' | 'done',
    };
    let result = buildScanResult({
      photoCount: 3,
      videoCount: 3,
      photos: [],
      screenshots: [],
      livePhotos: [],
      videos: [],
    });

    // After screenshots: Home should show the shot count and stop only the shots spinner.
    result = buildScanResult({
      photoCount: 3,
      videoCount: 3,
      photos: [],
      screenshots: shots,
      livePhotos: [],
      videos: [],
    });
    cats.screenshots = 'done';
    assert.equal(result.screenshots.length, 1);
    assert.equal(spinnerFor(scanning, cats.screenshots), false);
    assert.equal(spinnerFor(scanning, cats.photos), true);
    assert.equal(spinnerFor(scanning, cats.videos), true);
    assert.equal(result.largeVideos.length, 0);

    // After videos: Videos tab cards fill in; photos still spinning.
    result = buildScanResult({
      photoCount: 3,
      videoCount: 3,
      photos: [],
      screenshots: shots,
      livePhotos: [],
      videos,
    });
    cats.videos = 'done';
    assert.equal(result.largeVideos.length, 1);
    assert.equal(dupExtraCount(result.duplicateVideos), 1);
    assert.equal(spinnerFor(scanning, cats.videos), false);
    assert.equal(spinnerFor(scanning, cats.photos), true);

    // After photos: every card has its real count and every spinner stops.
    result = buildScanResult({
      photoCount: 3,
      videoCount: 3,
      photos,
      screenshots: shots,
      livePhotos: [],
      videos,
    });
    cats.photos = 'done';
    scanning = false;
    assert.equal(dupExtraCount(result.duplicates), 1);
    assert.equal(spinnerFor(scanning, cats.photos), false);
    assert.equal(spinnerFor(false, 'running'), false);
  });
});

describe('stress grouping', () => {
  it('groups a large seeded library without leaving stray extras', () => {
    const photos: Item[] = [];
    const videos: Item[] = [];
    const hashes: { item: Item; dhash: string }[] = [];
    const screenshots: Item[] = [];

    // 400 exact-duplicate pairs (800 photos) plus 2,200 unique photos.
    for (let i = 0; i < 400; i++) {
      const size = 1_000_000 + i;
      const t = 2_000_000 + i * 10_000;
      photos.push(item({ id: `dup-a-${i}`, size, creationTime: t, width: 2000, height: 1500 }));
      photos.push(item({ id: `dup-b-${i}`, size, creationTime: t + 200, width: 2000, height: 1500 }));
    }
    for (let i = 0; i < 2200; i++) {
      const p = item({ id: `u-${i}`, size: 3_000_000 + i, creationTime: 9_000_000 + i * 1000, width: 1200, height: 800 });
      photos.push(p);
      // 150 similar pairs among unique photos, same 2-char dHash prefix.
      if (i < 150) {
        const base = (i % 200).toString(16).padStart(2, '0') + 'aa'.repeat(7);
        hashes.push({ item: p, dhash: base });
      }
    }
    for (let i = 0; i < 150; i++) {
      const mate = item({
        id: `sim-${i}`,
        size: 3_100_000 + i,
        creationTime: 20_000_000 + i * 1000,
        width: 1200,
        height: 800,
      });
      photos.push(mate);
      const near = (i % 200).toString(16).padStart(2, '0') + 'aa'.repeat(6) + 'ab';
      hashes.push({ item: mate, dhash: near });
    }
    for (let i = 0; i < 80; i++) {
      screenshots.push(item({ id: `shot-${i}`, filename: `Screenshot ${i}.png`, size: 800_000 + i }));
    }
    // 12 large videos, 30 exact video-duplicate pairs, 40 unique small videos.
    for (let i = 0; i < 12; i++) {
      videos.push(item({ id: `lv-${i}`, isVideo: true, size: LARGE_VIDEO_BYTES + i * 1_000_000, duration: 60 + i, uri: `file:///lv-${i}.mp4` }));
    }
    for (let i = 0; i < 30; i++) {
      const size = 50_000_000 + i;
      const t = 5_000_000 + i * 8000;
      videos.push(item({ id: `vd-a-${i}`, isVideo: true, size, duration: 18, creationTime: t, uri: `file:///vd-a-${i}.mp4` }));
      videos.push(item({ id: `vd-b-${i}`, isVideo: true, size, duration: 18, creationTime: t + 100, uri: `file:///vd-b-${i}.mp4` }));
    }
    for (let i = 0; i < 40; i++) {
      videos.push(item({ id: `sv-${i}`, isVideo: true, size: 20_000_000 + i, duration: 8 + i, creationTime: 8_000_000 + i, uri: `file:///sv-${i}.mp4` }));
    }

    const started = Date.now();
    const result = buildScanResult({
      photoCount: photos.length + screenshots.length,
      videoCount: videos.length,
      photos,
      screenshots,
      livePhotos: [],
      videos,
      hashes,
    });
    const elapsed = Date.now() - started;

    assert.equal(result.duplicates.length, 400);
    assert.equal(dupExtraCount(result.duplicates), 400);
    assert.equal(result.screenshots.length, 80);
    assert.equal(result.largeVideos.length, 12);
    assert.equal(dupExtraCount(result.duplicateVideos), 30);
    assert.equal(result.similar.length, 150);
    assert.equal(dupExtraCount(result.similar), 150);
    assert.ok(elapsed < 2000, `stress grouping was too slow: ${elapsed}ms`);
    // eslint-disable-next-line no-console
    console.log(`stress: ${photos.length} photos, ${videos.length} videos, ${elapsed}ms`);
  });
});
