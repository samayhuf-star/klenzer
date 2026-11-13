import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatBytes } from '../src/lib/format';
import { dupReclaimable, emptyScanResult, sum, type Item, type ScanResult } from '../src/lib/scan-logic';
import { scanCompleteBody } from '../src/lib/scan-complete';

function item(id: string, size: number): Item {
  return {
    id,
    uri: `file:///${id}.jpg`,
    filename: `${id}.jpg`,
    width: 100,
    height: 100,
    creationTime: 1,
    modificationTime: 1,
    duration: 0,
    size,
    isVideo: false,
  };
}

/** Same sources scanReclaimableBytes uses, kept here so the test stays in pure Node modules. */
function reclaimableFromScan(r: ScanResult, tempSize = 0): number {
  return (
    dupReclaimable(r.duplicates) +
    dupReclaimable(r.similar) +
    dupReclaimable(r.duplicateVideos) +
    sum(r.screenshots) +
    sum(r.largeVideos) +
    sum(r.livePhotos) +
    sum(r.blurry) +
    tempSize
  );
}

describe('scanCompleteBody', () => {
  it('uses the clean-library copy when nothing can be freed', () => {
    assert.equal(scanCompleteBody(0), 'Scan complete: your library looks clean');
    assert.equal(scanCompleteBody(-1), 'Scan complete: your library looks clean');
    assert.equal(scanCompleteBody(Number.NaN), 'Scan complete: your library looks clean');
  });

  it('embeds the real formatted size, including values under 1 GB', () => {
    assert.equal(scanCompleteBody(135_000_000), 'Scan complete: 135 MB can be freed');
    assert.equal(scanCompleteBody(2_400_000_000), `Scan complete: ${formatBytes(2_400_000_000)} can be freed`);
    assert.equal(scanCompleteBody(2_400_000_000), 'Scan complete: 2.4 GB can be freed');
  });
});

describe('scan-complete uses the measured reclaimable total', () => {
  it('reports the measured reclaimable total, not a placeholder', () => {
    const r: ScanResult = {
      ...emptyScanResult(),
      duplicates: [{ key: 'dup', items: [item('a', 5_000_000), item('b', 5_000_000)] }],
      blurry: [item('c', 3_000_000)],
    };
    const bytes = reclaimableFromScan(r, 0);
    // One extra in the exact pair (5 MB) plus the blurry shot (3 MB).
    assert.equal(bytes, 8_000_000);
    assert.equal(scanCompleteBody(bytes), 'Scan complete: 8 MB can be freed');
  });

  it('says the library looks clean when the scan found nothing to clear', () => {
    assert.equal(scanCompleteBody(reclaimableFromScan(emptyScanResult(), 0)), 'Scan complete: your library looks clean');
  });
});
