import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canScan,
  PHOTO_PERMISSION_REQUEST,
  scanStartAction,
  shouldStartScanAfterAccessChange,
  toPhotoAccess,
} from '../src/lib/photo-access';
import { analysisComplete, scanLibraryWithIO, type Enrichment, type LibraryAsset, type Progress } from '../src/lib/scan-pipeline';
import { dupReclaimable, sum, type Item, type ScanResult } from '../src/lib/scan-logic';
import { scanCompleteBody } from '../src/lib/scan-complete';

const NOW = 1_735_000_000_000;
const MB = 1024 * 1024;

/** 400 photos like the simulator seed: 5 exact pairs, the rest unique and spread out in time. */
function seedAssets(): LibraryAsset[] {
  const out: LibraryAsset[] = [];
  for (let p = 0; p < 5; p++) {
    for (const s of ['a', 'b']) {
      out.push({
        id: `pair-${p}-${s}`, uri: `file:///pair-${p}-${s}.jpg`, filename: `IMG_PAIR_${p}.JPG`,
        width: 4032, height: 3024, creationTime: NOW - p * 3_600_000 - (s === 'b' ? 100 : 0),
        modificationTime: NOW - p * 3_600_000, duration: 0, mediaType: 'photo',
      });
    }
  }
  for (let i = out.length; i < 400; i++) {
    out.push({
      id: `p-${i}`, uri: `file:///p-${i}.jpg`, filename: `IMG_${i}.JPG`,
      width: 3000 + i, height: 2000 + i, creationTime: NOW - 20_000_000 - i * 600_000,
      modificationTime: NOW - 20_000_000 - i * 600_000, duration: 0, mediaType: 'photo',
    });
  }
  return out;
}

function pagedIO(assets: LibraryAsset[], pageSize = 100) {
  return async (after?: string) => {
    const start = after ? Number(after) : 0;
    const slice = assets.slice(start, start + pageSize);
    return { assets: slice, hasNextPage: start + pageSize < assets.length, endCursor: String(start + pageSize), totalCount: assets.length };
  };
}

const never = <T,>() => new Promise<T>(() => {});

function reclaimable(r: ScanResult): number {
  return dupReclaimable(r.duplicates) + dupReclaimable(r.similar) + dupReclaimable(r.duplicateVideos) +
    sum(r.screenshots) + sum(r.largeVideos) + sum(r.livePhotos) + sum(r.blurry);
}

describe('Photos permission for the scan', () => {
  it('asks for read-write access, never add-only', () => {
    assert.equal(PHOTO_PERMISSION_REQUEST.writeOnly, false);
    assert.deepEqual([...PHOTO_PERMISSION_REQUEST.granular], ['photo', 'video']);
  });

  it('maps the permission response', () => {
    assert.equal(toPhotoAccess({ status: 'granted', accessPrivileges: 'all' }), 'granted');
    assert.equal(toPhotoAccess({ status: 'granted', accessPrivileges: 'limited' }), 'limited');
    assert.equal(toPhotoAccess({ status: 'denied' }), 'denied');
    // Add-only (read-write still undetermined) reads as unknown, so the first scan asks for read-write.
    assert.equal(toPhotoAccess({ status: 'undetermined' }), 'unknown');
    assert.equal(toPhotoAccess(null), 'unknown');
    assert.equal(canScan('unknown'), false);
  });

  it('a Scan tap with no access asks and then scans; it is never a dead end', () => {
    assert.equal(scanStartAction('unknown', true), 'request-then-scan');
    assert.equal(scanStartAction('denied', true), 'request-then-scan');
    assert.equal(scanStartAction('denied', false), 'open-settings');
    assert.equal(scanStartAction('granted', true), 'scan');
    assert.equal(scanStartAction('limited', false), 'scan');
  });

  it('starts the pending scan when access is granted later (Photos sheet or Settings)', () => {
    assert.equal(shouldStartScanAfterAccessChange({ prev: 'unknown', next: 'granted', pendingScan: true, scanning: false }), true);
    assert.equal(shouldStartScanAfterAccessChange({ prev: 'denied', next: 'limited', pendingScan: true, scanning: false }), true);
    assert.equal(shouldStartScanAfterAccessChange({ prev: 'unknown', next: 'granted', pendingScan: false, scanning: false }), false);
    assert.equal(shouldStartScanAfterAccessChange({ prev: 'unknown', next: 'granted', pendingScan: true, scanning: true }), false);
    assert.equal(shouldStartScanAfterAccessChange({ prev: 'unknown', next: 'unknown', pendingScan: true, scanning: false }), false);
  });
});

describe('scan completion', () => {
  it('finishes when some assets never answer, shows partial Duplicate counts first, and reports the real size', async () => {
    const assets = seedAssets();
    const stuck = new Set(['p-50', 'p-51', 'p-300']);
    const partials: number[] = [];
    let finalPercent = 0;
    const enrich = async (item: Item, mode: 'size' | 'hash' | 'blur'): Promise<Enrichment> => {
      if (stuck.has(item.id)) return never<Enrichment>(); // an iCloud fetch or hash that never resolves
      if (item.id === 'p-60') throw new Error('broken asset');
      const pair = item.id.startsWith('pair-');
      return { size: pair ? 3 * MB : 2 * MB + item.width, dhash: null, blur: mode === 'blur' ? 500 : null };
    };
    const started = Date.now();
    const r = await scanLibraryWithIO(
      {
        onProgress: (p) => { finalPercent = p.percent ?? finalPercent; },
        onCategory: () => {},
        onPartial: (x) => partials.push(x.duplicates.length),
      },
      { cancelled: false },
      { getPage: pagedIO(assets), enrich, enrichTimeoutMs: 50, sizeBatch: 20, workers: 4 },
    );
    assert.ok(Date.now() - started < 15_000, 'scan must not hang on stuck assets');
    assert.equal(r.duplicates.length, 5);
    assert.equal(finalPercent, 100);
    // Duplicates show up in a partial result before the last emit.
    const firstNonZero = partials.findIndex((n) => n > 0);
    assert.ok(firstNonZero >= 0 && firstNonZero < partials.length - 1, `partials: ${partials.join(',')}`);
    const bytes = reclaimable(r);
    assert.equal(bytes, 5 * 3 * MB);
    assert.match(scanCompleteBody(bytes), /^Scan complete: .+ can be freed$/);
    assert.doesNotMatch(scanCompleteBody(bytes), /looks clean/);
  });

  it('finishes when a library page never answers', async () => {
    const assets = seedAssets();
    const base = pagedIO(assets);
    let calls = 0;
    const r = await scanLibraryWithIO(
      { onProgress: () => {}, onCategory: () => {}, onPartial: () => {} },
      { cancelled: false },
      {
        getPage: (after) => (++calls === 3 ? never() : base(after)),
        enrich: async () => ({ size: MB, dhash: null, blur: null }),
        pageTimeoutMs: 50,
      },
    );
    assert.equal(r.photoCount, 200);
  });

  it('marks every category done at the end', async () => {
    const done = new Set<string>();
    await scanLibraryWithIO(
      { onProgress: () => {}, onCategory: (c) => c.status === 'done' && done.add(c.category), onPartial: () => {} },
      { cancelled: false },
      { getPage: pagedIO(seedAssets().slice(0, 30)), enrich: async () => ({ size: MB, dhash: null, blur: null }) },
    );
    assert.deepEqual([...done].sort(), ['photos', 'screenshots', 'videos']);
  });

  // Reproduces sim run 43429495465: every hash/blur call hung (the image-manipulator path never answered),
  // so each photo cost a full timeout and the scan crawled at 97–99% with Similar and Blurry at 0.
  it('completes by processed + skipped == total when the photo analyzer never answers, trying each photo once', async () => {
    const assets = seedAssets();
    let analysisCalls = 0;
    const progress: Progress[] = [];
    const enrich = async (item: Item, mode: 'size' | 'hash' | 'blur'): Promise<Enrichment> => {
      if (mode !== 'size') {
        analysisCalls++;
        return never<Enrichment>();
      }
      return { size: item.id.startsWith('pair-') ? 3 * MB : 2 * MB + item.width, dhash: null, blur: null };
    };
    const started = Date.now();
    const r = await scanLibraryWithIO(
      { onProgress: (p) => progress.push(p), onCategory: () => {}, onPartial: () => {} },
      { cancelled: false },
      { getPage: pagedIO(assets), enrich, analyzeTimeoutMs: 20, workers: 8 },
    );
    assert.ok(Date.now() - started < 20_000, 'a hung analyzer must not hold the scan');
    const last = progress[progress.length - 1];
    assert.equal(last.complete, true);
    assert.deepEqual(last.analysis, { processed: 0, skipped: 400, total: 400 });
    assert.ok(analysisComplete(last.analysis!));
    assert.ok(analysisCalls <= 400, `each photo is analyzed at most once (calls=${analysisCalls})`);
    assert.equal(r.duplicates.length, 5, 'Duplicate still reports what it found');
  });

  it('publishes Similar and Blurry once analysis answers, and counts every photo', async () => {
    const assets = seedAssets();
    // Ten near-identical burst shots one second apart, and five blurry photos.
    for (let i = 0; i < 10; i++) {
      assets.push({
        id: `burst-${i}`, uri: `file:///burst-${i}.jpg`, filename: `IMG_B${i}.JPG`, width: 4032, height: 3024,
        creationTime: NOW - 1000 * i, modificationTime: NOW - 1000 * i, duration: 0, mediaType: 'photo',
      });
    }
    const hashOf = (id: string) => {
      if (id.startsWith('burst-')) return 'aaaaaaaaaaaaaaa' + (id.endsWith('0') ? 'b' : 'a');
      let h = 0;
      for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return (h.toString(16).padStart(8, '0') + (h ^ 0x5bd1e995).toString(16).padStart(8, '0')).slice(0, 16);
    };
    const blurry = new Set(['p-20', 'p-21', 'p-22', 'p-23', 'p-24']);
    const r = await scanLibraryWithIO(
      { onProgress: () => {}, onCategory: () => {}, onPartial: () => {} },
      { cancelled: false },
      {
        getPage: pagedIO(assets),
        enrich: async (item, mode) => ({
          size: 2 * MB + item.width,
          dhash: mode === 'size' ? null : hashOf(item.id),
          blur: mode === 'size' ? null : blurry.has(item.id) ? 20 : 900,
        }),
      },
    );
    assert.equal(r.blurry.length, 5);
    assert.ok(r.similar.some((g) => g.items.some((i) => i.id.startsWith('burst-'))), 'burst shots group as Similar');
    assert.match(scanCompleteBody(reclaimable(r)), /^Scan complete: .+ can be freed$/);
  });
});

