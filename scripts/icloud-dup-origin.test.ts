import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyOrigin, type Origin } from '../src/lib/origin-logic';
import { scanOrigins } from '../src/lib/origin-scan';
import { buildScanResult, dupExtraCount, groupExact, type Item } from '../src/lib/scan-logic';

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  uri: `file:///${id}.jpg`,
  filename: `${id}.jpg`,
  width: 1200,
  height: 1600,
  creationTime: 1_700_000_000_000 + Number(id.replace(/\D/g, '') || 0) * 86_400_000,
  modificationTime: 1,
  duration: 0,
  size: 200_000,
  isVideo: false,
  ...extra,
});

describe('duplicates saved on different days', () => {
  it('groups the same file saved twice under different names and dates', () => {
    const a = item('a1', { dhash: 'abcdef0123456789', size: 345_678 });
    const b = item('b9', { dhash: 'abcdef0123456789', size: 345_678 });
    const groups = groupExact([a, b, item('c3', { dhash: '1111111111111111' })]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].items.map((i) => i.id), ['a1', 'b9']);
  });
  it('needs the same size, the same dimensions and the same fingerprint', () => {
    const base = { dhash: 'abcdef0123456789', size: 345_678 };
    assert.equal(groupExact([item('a1', base), item('b2', { ...base, size: 345_679 })]).length, 0);
    assert.equal(groupExact([item('a1', base), item('b2', { ...base, width: 1201 })]).length, 0);
    assert.equal(groupExact([item('a1', base), item('b2', { ...base, dhash: 'abcdef0123456788' })]).length, 0);
    assert.equal(groupExact([item('a1', { ...base, size: 0 }), item('b2', { ...base, size: 0 })]).length, 0);
    assert.equal(groupExact([item('a1', { size: 345_678 }), item('b2', { size: 345_678 })]).length, 0);
  });
  it('counts iCloud photos once Photos reports their size', () => {
    // Same capture second and dimensions. With size 0 (the old iCloud case) nothing was confirmed.
    const t = 1_700_000_000_000;
    const unsized = [item('a1', { creationTime: t, size: 0 }), item('a2', { creationTime: t + 100, size: 0 })];
    assert.equal(dupExtraCount(buildScanResult({ photoCount: 2, videoCount: 0, photos: unsized, screenshots: [], livePhotos: [], videos: [] }).duplicates), 0);
    const sized = unsized.map((i) => ({ ...i, size: 2_400_000 }));
    assert.equal(dupExtraCount(buildScanResult({ photoCount: 2, videoCount: 0, photos: sized, screenshots: [], livePhotos: [], videos: [] }).duplicates), 1);
  });
});

describe('Forwarded and AI Images fill while the pass runs', () => {
  const origin = (o: Partial<Origin> = {}): Origin => ({ hasCamera: false, aiTag: null, textRatio: null, ...o });
  it('shows chat-album pictures before any file is opened, then streams the rest', async () => {
    const photos = Array.from({ length: 450 }, (_, n) => item(`p${n}`, { size: 0 }));
    const chat = new Set(['p3', 'p7']);
    const partials: { fwd: number; ai: number; inspected: number }[] = [];
    let inspected = 0;
    const final = await scanOrigins(
      photos,
      {
        chatAlbumIds: async () => chat,
        inspect: async (i) => {
          inspected++;
          return origin({ aiTag: i.id === 'p100' ? 'ChatGPT' : null });
        },
        hash: async () => null,
        workers: 1,
      },
      { cancelled: false },
      undefined,
      (r) => partials.push({ fwd: r.forwarded.length, ai: r.aiImages.length, inspected }),
    );
    assert.deepEqual(partials[0], { fwd: 2, ai: 0, inspected: 0 });
    assert.ok(partials.length >= 3);
    assert.ok(partials.some((p) => p.ai === 1));
    assert.equal(final.forwarded.length, 2);
    assert.equal(final.aiImages.length, 1);
  });
  it('takes sizes from the scan and drops photos that are gone', () => {
    const found = { forwarded: [item('a1', { size: 0, fwd: 'chat' }), item('a2', { size: 0, fwd: 'chat' })], aiImages: [item('a3', { size: 0, aiSource: 'ChatGPT' })] };
    const now = applyOrigin([item('a1', { size: 111 }), item('a3', { size: 333 })], found);
    assert.deepEqual(now.forwarded.map((i) => [i.id, i.size, i.fwd]), [['a1', 111, 'chat']]);
    assert.deepEqual(now.aiImages.map((i) => [i.id, i.size, i.aiSource]), [['a3', 333, 'ChatGPT']]);
  });
});
