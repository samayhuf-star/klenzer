import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dupExtraCount } from '../src/lib/scan-logic';
import {
  scanLibraryWithIO,
  weightedScanPercent,
  type LibraryAsset,
  type Progress,
  type ScanResult,
  type StageState,
} from '../src/lib/scan-pipeline';

const TOTAL = 30_000;
const PAGE = 400;
const NOW = 1_735_000_000_000;

function makeAssets(): LibraryAsset[] {
  const assets: LibraryAsset[] = [];
  // Newest first, matching MediaLibrary sortBy creationTime desc.
  // A tight exact-duplicate pair at the front so the first Duplicate arrives immediately after enumerate.
  assets.push({
    id: 'dup-a',
    uri: 'file:///dup-a.jpg',
    filename: 'IMG_0001.JPG',
    width: 4032,
    height: 3024,
    creationTime: NOW,
    modificationTime: NOW,
    duration: 0,
    mediaType: 'photo',
  });
  assets.push({
    id: 'dup-b',
    uri: 'file:///dup-b.jpg',
    filename: 'IMG_0001.JPG',
    width: 4032,
    height: 3024,
    creationTime: NOW + 200,
    modificationTime: NOW + 200,
    duration: 0,
    mediaType: 'photo',
  });
  // A 4-shot burst for similar hashing (within 60s).
  for (let i = 0; i < 4; i++) {
    assets.push({
      id: `burst-${i}`,
      uri: `file:///burst-${i}.jpg`,
      filename: `IMG_BURST_${i}.JPG`,
      width: 4032,
      height: 3024,
      creationTime: NOW - 5_000 - i * 4_000,
      modificationTime: NOW - 5_000 - i * 4_000,
      duration: 0,
      mediaType: 'photo',
    });
  }
  let n = assets.length;
  while (n < TOTAL) {
    const i = n;
    const isShot = i % 40 === 0;
    const isVideo = i % 55 === 0 && !isShot;
    const t = NOW - 60_000 - i * 8_000;
    assets.push({
      id: `a-${i}`,
      uri: `file:///a-${i}.${isVideo ? 'mov' : 'jpg'}`,
      filename: isShot ? `Screenshot ${i}.png` : isVideo ? `VID_${i}.MOV` : `IMG_${i}.JPG`,
      width: isVideo ? 1920 : i % 7 === 0 ? 3024 : 4032,
      height: isVideo ? 1080 : i % 7 === 0 ? 4032 : 3024,
      creationTime: t,
      modificationTime: t,
      duration: isVideo ? 12 : 0,
      mediaType: isVideo ? 'video' : 'photo',
      mediaSubtypes: isShot ? ['screenshot'] : undefined,
    });
    n++;
  }
  return assets;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


const idle = (reached = false): StageState => ({ done: 0, total: 0, reached });
const stage = (done: number, total: number, reached = true): StageState => ({ done, total, reached });

describe('weighted scan percent', () => {
  it('is monotonic across stages and never jumps backward when a new stage starts at 0', () => {
    const base = { reading: idle(true), sizing: idle(), hashing: idle(), blur: idle() };
    const r0 = weightedScanPercent({ ...base, reading: stage(0, 10000) });
    const rHalf = weightedScanPercent({ ...base, reading: stage(5000, 10000) });
    const rDone = weightedScanPercent({ ...base, reading: stage(10000, 10000) });
    const sizeStart = weightedScanPercent({
      reading: stage(10000, 10000),
      sizing: stage(0, 30000),
      hashing: idle(),
      blur: idle(),
    }, rDone);
    const sizeHalf = weightedScanPercent({
      reading: stage(10000, 10000),
      sizing: stage(15000, 30000),
      hashing: idle(),
      blur: idle(),
    }, sizeStart);
    const sizeDone = weightedScanPercent({
      reading: stage(10000, 10000),
      sizing: stage(30000, 30000),
      hashing: idle(),
      blur: idle(),
    }, sizeHalf);
    const hashStart = weightedScanPercent({
      reading: stage(10000, 10000),
      sizing: stage(30000, 30000),
      hashing: stage(0, 800),
      blur: idle(),
    }, sizeDone);
    const hashDone = weightedScanPercent({
      reading: stage(10000, 10000),
      sizing: stage(30000, 30000),
      hashing: stage(800, 800),
      blur: idle(),
    }, hashStart);
    const blurStart = weightedScanPercent({
      reading: stage(10000, 10000),
      sizing: stage(30000, 30000),
      hashing: stage(800, 800),
      blur: stage(0, 20000),
    }, hashDone);
    const done = weightedScanPercent({
      reading: stage(10000, 10000),
      sizing: stage(30000, 30000),
      hashing: stage(800, 800),
      blur: stage(20000, 20000),
    }, blurStart);
    const seq = [r0, rHalf, rDone, sizeStart, sizeHalf, sizeDone, hashStart, hashDone, blurStart, done];
    for (let i = 1; i < seq.length; i++) {
      assert.ok(seq[i] >= seq[i - 1], `percent went backward at ${i}: ${seq[i - 1]} -> ${seq[i]}`);
    }
    assert.equal(r0, 0);
    assert.equal(rHalf, 6);
    assert.equal(rDone, 12);
    assert.equal(sizeStart, 12);
    assert.equal(sizeHalf, 40); // 12 + 27.5 rounded
    assert.equal(sizeDone, 67);
    assert.equal(hashStart, 67);
    assert.equal(hashDone, 85);
    assert.equal(blurStart, 85);
    assert.equal(done, 100);
  });

  it('counts a reached stage with no work as complete so progress does not stall', () => {
    const empty: StageState = { done: 0, total: 0, reached: true, complete: true };
    const percent = weightedScanPercent({
      reading: stage(100, 100),
      sizing: stage(100, 100),
      hashing: empty,
      blur: empty,
    });
    assert.equal(percent, 100);
  });

  it('does not treat an unknown (0/0, not complete) stage as finished', () => {
    assert.equal(weightedScanPercent({
      reading: { done: 0, total: 0, reached: true },
      sizing: idle(),
      hashing: idle(),
      blur: idle(),
    }), 0);
  });
});

describe('scanLibrary streaming path', () => {
  it('emits the first Duplicate within 10s and progress at least every 2s on a 30k library', { timeout: 60_000 }, async () => {
    const assets = makeAssets();
    assert.equal(assets.length, TOTAL);

    const pages: Record<string, number> = { cursor: 0 };
    const progressLog: { t: number; p: Progress }[] = [];
    const partials: { t: number; dups: number; similar: number; blurry: number; shots: number }[] = [];
    const started = Date.now();

    const result = await scanLibraryWithIO(
      {
        onProgress: (p) => progressLog.push({ t: Date.now(), p }),
        onCategory: () => {},
        onPartial: (r: ScanResult) => {
          partials.push({
            t: Date.now(),
            dups: dupExtraCount(r.duplicates),
            similar: dupExtraCount(r.similar),
            blurry: r.blurry.length,
            shots: r.screenshots.length,
          });
        },
      },
      { cancelled: false },
      {
        workers: 8,
        sizeBatch: 250,
        hashBatch: 80,
        blurBatch: 40,
        getPage: async () => {
          const start = pages.cursor;
          if (start >= assets.length) return { assets: [], hasNextPage: false, totalCount: TOTAL };
          const slice = assets.slice(start, start + PAGE);
          pages.cursor = start + slice.length;
          return {
            assets: slice,
            hasNextPage: pages.cursor < assets.length,
            endCursor: String(pages.cursor),
            totalCount: TOTAL,
          };
        },
        enrich: async (item, mode) => {
          // Realistic per-asset I/O: each size lookup pays ~1ms (media-info). Hash/blur are
          // instant here so the 30k blur pass does not dominate wall time.
          if (mode === 'size') await sleep(1);
          const size = item.isVideo ? 120_000_000 : item.filename.startsWith('IMG_0001') ? 2_400_000 : 1_800_000 + (item.id.length % 7) * 1000;
          const dhash = item.id.startsWith('burst-') ? 'aaaaaaaaaaaaaaa' + (item.id === 'burst-3' ? '0' : 'a') : null;
          const blur = item.id.startsWith('burst-') ? 40 : 200;
          return { size, dhash, blur };
        },
      },
    );

    const firstDup = partials.find((p) => p.dups > 0);
    assert.ok(firstDup, 'expected a Duplicate group to stream');
    const firstDupMs = firstDup.t - started;
    assert.ok(firstDupMs <= 10_000, `first Duplicate took ${firstDupMs}ms`);

    const percents = progressLog.map((e) => e.p.percent).filter((n): n is number => n != null);
    assert.ok(percents.length >= 2, 'expected weighted percent ticks');
    for (let i = 1; i < percents.length; i++) {
      assert.ok(percents[i] >= percents[i - 1], `percent went backward: ${percents[i - 1]} -> ${percents[i]}`);
    }
    assert.equal(percents[percents.length - 1], 100);
    assert.ok(percents.some((n) => n > 0 && n < 100), 'percent should advance through the scan, not jump 0 to 100');

    const analyzing = progressLog.filter((e) => e.p.phase === 'analyzing');
    assert.ok(analyzing.length >= 2, 'expected analyzing progress ticks');
    assert.ok(analyzing.some((e) => (e.p.label ?? '').startsWith('Matched ')), 'expected “Matched X of Y” progress');
    const span = analyzing[analyzing.length - 1].t - analyzing[0].t;
    if (span >= 2000) {
      for (let i = 1; i < analyzing.length; i++) {
        const gap = analyzing[i].t - analyzing[i - 1].t;
        assert.ok(gap <= 2500, `progress gap ${gap}ms at tick ${i}`);
      }
    }

    assert.ok(dupExtraCount(result.duplicates) >= 1);
    assert.ok(result.screenshots.length > 0);
    assert.ok(result.blurry.length >= 1, 'blurry counts should stream from hashed/blurred batches');
  });
});
