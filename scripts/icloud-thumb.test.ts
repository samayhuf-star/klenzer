import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  analyzeForScan,
  clampThumbPx,
  ICLOUD_THUMB_MAX_PX,
  ICLOUD_THUMB_PX,
  ICLOUD_THUMB_REQUEST,
  type ThumbIO,
} from '../src/lib/icloud-thumb';
import { scanLibraryWithIO, type LibraryAsset, type Progress } from '../src/lib/scan-pipeline';

const root = join(__dirname, '..');
const swift = readFileSync(join(root, 'modules/live-photo-convert/ios/ScanThumb.swift'), 'utf8');
const moduleSwift = readFileSync(join(root, 'modules/live-photo-convert/ios/LivePhotoConvertModule.swift'), 'utf8');
const scanner = readFileSync(join(root, 'src/lib/scanner.ts'), 'utf8');

const GOOD = { dhash: 'ffff0000ffff0000', blur: 400 };
const never = <T>() => new Promise<T>(() => {});

function io(overrides: Partial<ThumbIO> = {}): ThumbIO & { removed: string[]; fetched: string[] } {
  const removed: string[] = [];
  const fetched: string[] = [];
  return {
    analyze: async () => GOOD,
    fetchCloudThumb: async (id) => {
      fetched.push(id);
      return `file:///tmp/klenzer-scan-thumbs/${id}.jpg`;
    },
    removeFile: (uri) => removed.push(uri),
    hashTimeoutMs: 200,
    cloudTimeoutMs: 50,
    removed,
    fetched,
    ...overrides,
  };
}

describe('iCloud scan thumbnails', () => {
  it('asks Photos for a small thumbnail with network access allowed', () => {
    assert.equal(ICLOUD_THUMB_REQUEST.networkAccessAllowed, true);
    assert.equal(ICLOUD_THUMB_REQUEST.synchronous, false);
    assert.equal(ICLOUD_THUMB_REQUEST.deliveryMode, 'fastFormat');
    assert.equal(ICLOUD_THUMB_REQUEST.resizeMode, 'fast');
    assert.ok(ICLOUD_THUMB_PX <= 300 && ICLOUD_THUMB_MAX_PX <= 300);
    assert.equal(clampThumbPx(10_000), ICLOUD_THUMB_MAX_PX);
    assert.equal(clampThumbPx(Number.POSITIVE_INFINITY), ICLOUD_THUMB_PX);

    // The native request matches: network allowed, fast format, small capped target, async.
    assert.match(swift, /options\.isNetworkAccessAllowed = true/);
    assert.match(swift, /options\.deliveryMode = \.fastFormat/);
    assert.match(swift, /options\.resizeMode = \.fast/);
    assert.match(swift, /options\.isSynchronous = false/);
    assert.match(swift, /let scanThumbMaxPx = 300\b/);
    assert.match(swift, /min\(max\(targetPx, 32\), scanThumbMaxPx\)/);
    assert.match(swift, /requestImage\(\s*for: asset,\s*targetSize: CGSize\(width: px, height: px\)/);
    assert.match(swift, /cancelImageRequest/);
    assert.match(moduleSwift, /AsyncFunction\("scanThumb"\)[\s\S]*requestScanThumb\(/);
  });

  it('never uses a full-size API in the scan path', () => {
    const banned = [
      /PHImageManagerMaximumSize/,
      /requestImageData/,
      /requestAVAsset/,
      /requestLivePhoto/,
      /requestPlayerItem/,
      /requestExportSession/,
      /PHAssetResourceManager/,
      /writeData/,
      /requestContentEditingInput/,
    ];
    for (const re of banned) {
      assert.doesNotMatch(swift, re, `ScanThumb.swift must not use ${re}`);
      assert.doesNotMatch(scanner, re, `scanner.ts must not use ${re}`);
    }
    assert.match(scanner, /shouldDownloadFromNetwork: false/, 'asset info never downloads the original');
  });

  it('reads local originals as before and does not touch iCloud for them', async () => {
    const t = io();
    assert.deepEqual(await analyzeForScan('a', 'file:///local/a.jpg', t), GOOD);
    assert.deepEqual(t.fetched, []);
  });

  it('hashes an iCloud-only photo from its thumbnail and removes the temp file', async () => {
    const t = io();
    assert.deepEqual(await analyzeForScan('cloud', null, t), GOOD);
    assert.deepEqual(t.fetched, ['cloud']);
    assert.deepEqual(t.removed, ['file:///tmp/klenzer-scan-thumbs/cloud.jpg']);
  });

  it('skips the photo when the iCloud fetch fails, errors or times out', async () => {
    assert.equal(await analyzeForScan('x', null, io({ fetchCloudThumb: async () => null })), null);
    assert.equal(await analyzeForScan('x', null, io({ fetchCloudThumb: async () => { throw new Error('offline'); } })), null);
    const started = Date.now();
    assert.equal(await analyzeForScan('x', null, io({ fetchCloudThumb: () => never<string | null>() })), null);
    assert.ok(Date.now() - started < 3000, 'a stalled fetch is abandoned');
  });

  it('a stalled iCloud fetch does not block Blurry or progress', async () => {
    const NOW = 1_735_000_000_000;
    const assets: LibraryAsset[] = [];
    for (let i = 0; i < 40; i++) {
      assets.push({
        id: i % 4 === 0 ? `cloud${i}` : i % 4 === 1 ? `blur${i}` : `p${i}`,
        uri: `ph://${i}`, filename: `IMG_${i}.HEIC`, width: 4032, height: 3024,
        creationTime: NOW - i * 3_600_000, modificationTime: NOW - i * 3_600_000, duration: 0, mediaType: 'photo',
      });
    }
    const progress: Progress[] = [];
    const seen = new Map<string, { size: number; dhash: string | null; blur: number | null }>();
    const t = io({
      analyze: async (uri) => ({ dhash: GOOD.dhash, blur: uri.includes('blur') ? 20 : 400 }),
      fetchCloudThumb: () => never<string | null>(),
    });
    const result = await scanLibraryWithIO(
      { onProgress: (p) => progress.push(p), onCategory: () => {}, onPartial: () => {} },
      { cancelled: false },
      {
        getPage: async () => ({ assets, hasNextPage: false, endCursor: '40', totalCount: assets.length }),
        enrich: async (item, mode) => {
          // Like the device cache: a size pass returns what an earlier hash pass found.
          const size = 1_000_000 + item.creationTime % 997;
          const prev = seen.get(item.id);
          if (mode === 'size') return prev ?? { size, dhash: null, blur: null };
          const local = item.id.startsWith('cloud') ? null : `file:///${item.id}.jpg`;
          const a = await analyzeForScan(item.id, local, t);
          const next = { size, dhash: a?.dhash ?? null, blur: a?.blur ?? null };
          seen.set(item.id, next);
          return next;
        },
      },
    );
    assert.equal(result.blurry.length, 10, 'blurry photos still found while iCloud fetches stall');
    assert.ok(!result.blurry.some((b) => b.id.startsWith('cloud')), 'stalled iCloud photos are skipped');
    assert.equal(progress[progress.length - 1]?.percent, 100);
  });
});

describe('native thumbnail analysis (iOS)', () => {
  it('uses the native analyzer for every photo and never the file + image-manipulator path', async () => {
    let fileAnalyzed = 0;
    const asked: [string, number][] = [];
    const t = io({
      analyze: async () => { fileAnalyzed++; return GOOD; },
      analyzeNative: async (id, px) => { asked.push([id, px]); return { dhash: '0123456789abcdef', blur: 12 }; },
    });
    assert.deepEqual(await analyzeForScan('local', 'file:///local/a.jpg', t), { dhash: '0123456789abcdef', blur: 12 });
    assert.deepEqual(await analyzeForScan('cloud', null, t), { dhash: '0123456789abcdef', blur: 12 });
    assert.equal(fileAnalyzed, 0, 'the old manipulator path is not touched');
    assert.deepEqual(t.fetched, [], 'no temp thumbnail file is written');
    for (const [, px] of asked) assert.ok(px <= ICLOUD_THUMB_MAX_PX, 'small thumbnail only');
  });

  it('skips a photo whose native analysis stalls, errors or fails, within the timeout', async () => {
    const started = Date.now();
    assert.equal(await analyzeForScan('x', 'file:///a.jpg', io({ analyzeNative: () => never() })), null);
    assert.equal(await analyzeForScan('x', null, io({ analyzeNative: async () => { throw new Error('bridge'); } })), null);
    assert.equal(await analyzeForScan('x', null, io({ analyzeNative: async () => null })), null);
    assert.ok(Date.now() - started < 3000, 'a stalled native call is abandoned');
  });

  it('is registered natively, asks Photos for a small thumbnail, and computes dHash and blur in Swift', () => {
    assert.match(moduleSwift, /AsyncFunction\("scanAnalyze"\)[\s\S]*requestScanAnalyze\(/);
    assert.match(swift, /func requestScanAnalyze\(/);
    assert.match(swift, /min\(max\(targetPx, 32\), scanThumbMaxPx\)/);
    assert.match(swift, /cancelImageRequest/);
    assert.match(swift, /private func dHash\(/);
    assert.match(swift, /private func laplacianVariance\(/);
    assert.match(scanner, /analyzeNative: isScanAnalyzeSupported \? scanAnalyze : undefined/);
  });
});
