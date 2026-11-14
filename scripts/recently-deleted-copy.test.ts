import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RD_SHEET_COPY } from '../src/lib/rd-sheet';

describe('Recently Deleted sheet copy', () => {
  it('has no ellipses and does not claim a deep link to Recently Deleted', () => {
    const headline = RD_SHEET_COPY.headline(12_345_678);
    const all = [headline, RD_SHEET_COPY.stepsTitle, RD_SHEET_COPY.steps, RD_SHEET_COPY.open, RD_SHEET_COPY.later, RD_SHEET_COPY.dontShow].join('\n');
    assert.doesNotMatch(all, /\u2026|\.\.\./);
    assert.match(headline, /is in Recently Deleted/);
    assert.match(headline, /Empty it to free the space now/);
    assert.equal(RD_SHEET_COPY.steps, 'Albums > Recently Deleted > Select > Delete All');
    assert.equal(RD_SHEET_COPY.open, 'Open Photos');
    assert.doesNotMatch(all, /direct link|opens Recently Deleted|take you to Recently Deleted/i);
  });
});
