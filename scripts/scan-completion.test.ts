import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canScan,
  PHOTO_PERMISSION_REQUEST,
  scanStartAction,
  shouldStartScanAfterAccessChange,
  toPhotoAccess,
} from '../src/lib/photo-access';
import { scanLibraryWithIO, type Enrichment, type LibraryAsset } from '../src/lib/scan-pipeline';
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
});
