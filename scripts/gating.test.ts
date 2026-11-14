import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  consumeAllowance,
  crossLimitMessage,
  decideGate,
  FREE_DAILY_ACTIONS,
  localDayKey,
  normalizeAllowance,
  parseAllowance,
  remainingFree,
  remainingLine,
  takeAcrossGroups,
} from '../src/lib/gating';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min, 0);

describe('free daily allowance', () => {
  it('is 10 items per day', () => {
    assert.equal(FREE_DAILY_ACTIONS, 10);
    assert.equal(remainingFree(null, at(2026, 11, 12)), 10);
  });

  it('counts items, not actions, across deletes, merges and Secret Album adds', () => {
    const now = at(2026, 11, 12, 9);
    let a = consumeAllowance(null, 4, now); // a batch delete of 4 photos
    a = consumeAllowance(a, 2, now); // a merge that removed 2 contacts
    a = consumeAllowance(a, 1, now); // one photo added to Secret Album
    assert.equal(remainingFree(a, now), 3);
  });

  it('never goes below zero', () => {
    const now = at(2026, 11, 12);
    assert.equal(remainingFree(consumeAllowance(null, 50, now), now), 0);
  });

  it('resets at local midnight', () => {
    const before = at(2026, 11, 12, 23, 59);
    const after = at(2026, 11, 13, 0, 0);
    const used = consumeAllowance(null, 10, before);
    assert.equal(remainingFree(used, before), 0);
    assert.equal(remainingFree(used, after), 10);
    assert.equal(normalizeAllowance(used, after).day, '2026-11-13');
    assert.equal(consumeAllowance(used, 3, after).used, 3);
  });

  it('uses the local calendar day', () => {
    assert.equal(localDayKey(at(2026, 1, 5, 0, 1)), '2026-01-05');
  });

  it('survives storage round trips and bad data', () => {
    const now = at(2026, 11, 12);
    const a = consumeAllowance(null, 6, now);
    assert.deepEqual(parseAllowance(JSON.stringify(a)), a);
    assert.equal(parseAllowance('not json'), null);
    assert.equal(remainingFree(parseAllowance('{"day":"2026-11-12","used":-4}'), now), 10);
  });
});

describe('the gate', () => {
  it('lets Pro run everything without counting', () => {
    assert.deepEqual(decideGate({ isPro: true, feature: 'delete', count: 40, remaining: 0 }), { freeNow: 40, blocked: 0, needsPaywall: false, countsAgainstAllowance: false });
    assert.equal(decideGate({ isPro: true, feature: 'convert', count: 3, remaining: 0 }).needsPaywall, false);
  });

  it('runs a free batch that fits the allowance and counts it', () => {
    const d = decideGate({ isPro: false, feature: 'delete', count: 4, remaining: 10 });
    assert.deepEqual(d, { freeNow: 4, blocked: 0, needsPaywall: false, countsAgainstAllowance: true });
  });

  it('splits a batch that crosses the limit: free remainder now, paywall for the rest', () => {
    const d = decideGate({ isPro: false, feature: 'delete', count: 12, remaining: 3 });
    assert.deepEqual(d, { freeNow: 3, blocked: 9, needsPaywall: true, countsAgainstAllowance: true });
    assert.equal(crossLimitMessage(d.freeNow, 12), 'You have 3 free items left today. Upgrade to clean all 12.');
  });

  it('applies the same shared count to merges and Secret Album adds', () => {
    assert.equal(decideGate({ isPro: false, feature: 'merge', count: 5, remaining: 2 }).freeNow, 2);
    assert.equal(decideGate({ isPro: false, feature: 'vault', count: 1, remaining: 1 }).needsPaywall, false);
  });

  it('keeps Compress and Convert Live Photos Pro only, with no allowance', () => {
    for (const feature of ['compress', 'convert'] as const) {
      const d = decideGate({ isPro: false, feature, count: 1, remaining: 10 });
      assert.deepEqual(d, { freeNow: 0, blocked: 1, needsPaywall: true, countsAgainstAllowance: false });
    }
  });

  it('sends a free user with nothing left straight to the upgrade prompt', () => {
    const d = decideGate({ isPro: false, feature: 'delete', count: 2, remaining: 0 });
    assert.equal(d.freeNow, 0);
    assert.equal(d.needsPaywall, true);
    assert.equal(crossLimitMessage(0, 2), 'You have used today’s 10 free items. Upgrade to clean all 2.');
  });

  it('writes remaining-count copy without ellipses', () => {
    assert.equal(remainingLine(3), '3 free items left today');
    assert.equal(remainingLine(1), '1 free item left today');
    assert.equal(remainingLine(0), 'No free items left today');
    assert.equal(crossLimitMessage(1, 4, 'merge'), 'You have 1 free item left today. Upgrade to merge all 4.');
    for (const t of [remainingLine(3), crossLimitMessage(3, 12)]) assert.ok(!t.includes('…') && !t.includes('...'));
  });

  it('takes the free part of a clean plan across rows and keeps temporary files', () => {
    const plan = [
      { kind: 'temp', items: [] as number[] },
      { kind: 'screenshots', items: [1, 2] },
      { kind: 'videos', items: [3, 4, 5] },
    ];
    assert.deepEqual(takeAcrossGroups(plan, 3, (g) => g.kind === 'temp'), [
      { kind: 'temp', items: [] },
      { kind: 'screenshots', items: [1, 2] },
      { kind: 'videos', items: [3] },
    ]);
    assert.deepEqual(takeAcrossGroups(plan, 0), []);
  });

  it('routes every delete, merge, Secret Album add and convert through decideGate in the store', () => {
    const store = readFileSync(join(root, 'src/lib/store.tsx'), 'utf8');
    assert.match(store, /feature: 'delete'/);
    assert.match(store, /feature: 'convert'/);
    assert.ok(!/if \(isProRef\.current\) \{\s*router\.push\('\/cleaning'\)/.test(store), 'no direct isPro bypass of the gate');
    assert.match(readFileSync(join(root, 'src/app/contacts.tsx'), 'utf8'), /runGated\(\s*'merge'/);
    assert.match(readFileSync(join(root, 'src/app/secret-album.tsx'), 'utf8'), /runGated\(\s*'vault'/);
    assert.match(readFileSync(join(root, 'src/app/swipe.tsx'), 'utf8'), /startClean\(/);
  });
});
