import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dupExtraCount } from '../src/lib/scan-logic';
import { scanLibraryWithIO, type LibraryAsset, type ScanResult } from '../src/lib/scan-pipeline';
import { tileNote } from '../src/lib/format';

const NOW = 1_735_000_000_000;

/** A library shaped like a real iPhone: nearly every camera shot is a Live Photo. */
function liveLibrary(): LibraryAsset[] {
  const a: LibraryAsset[] = [];
  const live = (id: string, t: number, filename = `IMG_${id}.HEIC`): LibraryAsset => ({
    id, uri: `file:///${id}.heic`, filename, width: 4032, height: 3024,
    creationTime: t, modificationTime: t, duration: 0, mediaType: 'photo', mediaSubtypes: ['livePhoto'],
  });
  // 5 exact duplicate pairs (same file saved twice: same name, size, dimensions and second).
  for (let i = 0; i < 5; i++) {
    const t = NOW - i * 3_600_000;
    a.push(live(`dup${i}a`, t, `IMG_70${i}.HEIC`), live(`dup${i}b`, t, `IMG_70${i}.HEIC`));
  }
  // 5 blurry shots, far apart in time.
  for (let i = 0; i < 5; i++) a.push(live(`blur${i}`, NOW - 50_000_000 - i * 3_600_000));
  // Normal shots.
  for (let i = 0; i < 300; i++) a.push(live(`p${i}`, NOW - 100_000_000 - i * 600_000));
  return a.sort((x, y) => y.creationTime - x.creationTime);
}

describe('Live Photos in Duplicate and Blurry', () => {
  it('finds exact duplicates and blurry shots when every camera photo is a Live Photo, with partial results on the way', async () => {
    const assets = liveLibrary();
    const partials: ScanResult[] = [];
    const result = await scanLibraryWithIO(
      { onProgress: () => {}, onCategory: () => {}, onPartial: (r) => partials.push(r) },
      { cancelled: false },
      {
        sizeBatch: 50,
        blurBatch: 20,
        getPage: async (after) => {
          const start = after ? Number(after) : 0;
          const slice = assets.slice(start, start + 100);
          return { assets: slice, hasNextPage: start + 100 < assets.length, endCursor: String(start + 100), totalCount: assets.length };
        },
        enrich: async (item) => {
          const pair = /^dup(\d)[ab]$/.exec(item.id);
          const size = pair ? 2_000_000 + Number(pair[1]) : 1_000_000 + item.id.length * 1000 + item.creationTime % 997;
          const blur = item.id.startsWith('blur') ? 20 : 400;
          const n = item.creationTime % 65_521;
          return { size, dhash: n.toString(16).padStart(16, '0'), blur };
        },
      },
    );
    assert.equal(result.duplicates.length, 5);
    assert.equal(dupExtraCount(result.duplicates), 5);
    assert.equal(result.blurry.length, 5);
    assert.ok(result.livePhotos.length >= 310, 'Live Photos still listed on their own card');
    const midScan = partials.slice(0, -1);
    assert.ok(midScan.some((p) => p.duplicates.length > 0), 'duplicates stream before the scan ends');
    assert.ok(midScan.some((p) => p.blurry.length > 0), 'blurry streams before the scan ends');
  });
});

describe('category tile note', () => {
  it('never says None yet while the scan is still running', () => {
    assert.equal(tileNote(0, 0, true, 37), 'Scanning 37%');
    assert.equal(tileNote(0, 0, true, 0), 'Scanning 1%');
    assert.equal(tileNote(0, 0, false, 100), 'None yet');
    assert.equal(tileNote(0, 3, true, 50), 'items');
  });
});
