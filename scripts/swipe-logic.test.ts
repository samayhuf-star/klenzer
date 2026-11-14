import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chunk, deleteBatch, emptySwipe, groupByMonth, monthLabel, pending, progressPercent, pruneDeleted, releaseBytes, swipe, undo } from '../src/lib/swipe-logic';

const t = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const it_ = (id: string, ts: number, size = 1_000_000) => ({ id, creationTime: ts, size });

const items = [it_('a', t(2026, 3, 2), 2e6), it_('b', t(2026, 3, 1), 3e6), it_('c', t(2026, 4, 9), 5e6), it_('d', t(2025, 12, 31), 1e6)];

describe('Swipe to Organize', () => {
  it('groups by month, newest month first, oldest photo first inside a month', () => {
    const months = groupByMonth(items);
    assert.deepEqual(months.map((m) => m.key), ['2026-04', '2026-03', '2025-12']);
    assert.deepEqual(months[1].items.map((i) => i.id), ['b', 'a']);
    assert.equal(monthLabel('2026-03'), 'March 2026');
  });

  it('marks left for deletion and right to keep, and moves to the next card', () => {
    const march = groupByMonth(items)[1].items;
    let s = swipe(emptySwipe(), 'b', 'left');
    assert.equal(pending(march, s)[0].id, 'a');
    s = swipe(s, 'a', 'right');
    assert.deepEqual(pending(march, s), []);
    assert.equal(progressPercent(march, s), 100);
    assert.deepEqual(deleteBatch(march, s).map((i) => i.id), ['b']);
    assert.equal(releaseBytes(march, s), 3e6);
  });

  it('undoes the last swipe only', () => {
    let s = swipe(emptySwipe(), 'a', 'left');
    s = swipe(s, 'b', 'left');
    const u = undo(s);
    assert.equal(u.restoredId, 'b');
    assert.deepEqual(Object.keys(u.state.decisions), ['a']);
    assert.equal(releaseBytes(items, u.state), 2e6);
    assert.equal(undo(emptySwipe()).restoredId, null);
  });

  it('replaces an earlier decision when an item is swiped again', () => {
    let s = swipe(emptySwipe(), 'a', 'left');
    s = swipe(s, 'a', 'right');
    assert.deepEqual(s.history, ['a']);
    assert.equal(deleteBatch(items, s).length, 0);
  });

  it('builds one delete batch across months and reports progress per month', () => {
    let s = swipe(emptySwipe(), 'c', 'left');
    s = swipe(s, 'd', 'left');
    s = swipe(s, 'a', 'right');
    const batch = groupByMonth(items).flatMap((m) => deleteBatch(m.items, s));
    assert.deepEqual(batch.map((i) => i.id), ['c', 'd']);
    assert.equal(progressPercent(groupByMonth(items)[1].items, s), 50);
    assert.equal(progressPercent([], s), 100);
  });

  it('forgets deleted ids so undo cannot bring them back', () => {
    let s = swipe(emptySwipe(), 'a', 'left');
    s = swipe(s, 'b', 'right');
    s = pruneDeleted(s, ['a']);
    assert.deepEqual(s.decisions, { b: 'keep' });
    assert.deepEqual(s.history, ['b']);
  });

  it('chunks large batches', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });
});
