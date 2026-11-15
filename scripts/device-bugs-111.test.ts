import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { shouldStartScan } from '../src/lib/launch-scan';
import { nextReminderDates, reminderBody, shouldScheduleReminders } from '../src/lib/reminder-plan';
import { emptyScanResult, readyToReviewBytes, type Item } from '../src/lib/scan-logic';
import { alignDisplayedProgress, categoryBarPercent } from '../src/lib/scan-progress';
import { parseStoredScanResult, serializeScanResult } from '../src/lib/scan-result-parse';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

function item(id: string, size: number, extra: Partial<Item> = {}): Item {
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
    ...extra,
  };
}

describe('scan starts only from onboarding or an explicit tap', () => {
  it('refuses cold start, foreground, and notification taps', () => {
    assert.equal(shouldStartScan('cold-start'), false);
    assert.equal(shouldStartScan('foreground'), false);
    assert.equal(shouldStartScan('notification'), false);
    assert.equal(shouldStartScan('onboarding-granted'), true);
    assert.equal(shouldStartScan('user-tapped-scan'), true);
  });

  it('does not resume an unfinished scan when the app becomes active', () => {
    const store = src('src/lib/store.tsx');
    const home = src('src/app/index.tsx');
    assert.doesNotMatch(store, /scanIncomplete\.current && canScan/);
    assert.match(store, /shouldStartScan\(/);
    assert.doesNotMatch(store, /askAboutReminders/);
    assert.doesNotMatch(home, /startClean\(/);
    assert.match(home, /kind: 'smart'/);
    assert.match(src('src/app/onboarding.tsx'), /requestAccess\(/);
  });
});

describe('headline percent matches the item count', () => {
  it('turns 13,574 of 29,712 into 46 percent', () => {
    const aligned = alignDisplayedProgress(13574, 29712);
    assert.equal(aligned.done, 13574);
    assert.equal(aligned.total, 29712);
    assert.equal(aligned.percent, 46);
  });

  it('does not copy the overall percent onto a category that has its own total', () => {
    assert.equal(categoryBarPercent({ status: 'running', done: 0, total: 0 }), 0);
    assert.equal(categoryBarPercent({ status: 'running', done: 10, total: 40 }), 25);
    assert.equal(categoryBarPercent({ status: 'running', done: 80, total: 100 }), 80);
    assert.equal(categoryBarPercent({ status: 'done', done: 4, total: 4 }), 100);
  });
});

describe('ready to review is the sum of the category cards', () => {
  it('includes similar, screenshots, live photos, and short videos', () => {
    const r = {
      ...emptyScanResult(),
      similar: [{ key: 's', items: [item('keep', 20_000_000), item('extra', 14_000_000)] }],
      screenshots: [item('shot', 40_000_000)],
      livePhotos: [item('live', 5_000_000)],
      shortVideos: [item('clip', 4_000_000, { isVideo: true, filename: 'clip.mov', duration: 3 })],
    };
    // 14 MB extra + 40 MB screenshot + 5 MB live + 4 MB short = 63 MB
    assert.equal(readyToReviewBytes(r), 63_000_000);
  });
});

describe('a saved scan can be shown without scanning again', () => {
  it('round-trips groups and drops hashes', () => {
    const r = {
      ...emptyScanResult(),
      scannedAt: 10,
      photoCount: 2,
      duplicates: [{ key: 'd', items: [item('a', 5, { dhash: 'abc', blur: 12 }), item('b', 4)] }],
    };
    const back = parseStoredScanResult(serializeScanResult(r));
    assert.ok(back);
    assert.equal(back?.duplicates[0]?.items[0]?.id, 'a');
    assert.equal(back?.duplicates[0]?.items[0]?.dhash, undefined);
    assert.equal(back?.shortVideos.length, 0);
    assert.equal(parseStoredScanResult('not json'), null);
    assert.equal(parseStoredScanResult('{"nope":true}'), null);
  });
});

describe('cleanup reminders', () => {
  it('fires at 8:00 local time every 3 days, and only in the future', () => {
    const morning = new Date(2026, 10, 15, 7, 15, 0);
    const first = nextReminderDates(morning, 3);
    assert.equal(first[0]?.getDate(), 15);
    assert.equal(first[0]?.getHours(), 8);
    assert.equal(first[0]?.getMinutes(), 0);
    assert.equal(first[1]?.getDate(), 18);
    assert.equal(first[2]?.getDate(), 21);
    assert.ok(first.every((d) => d.getTime() > morning.getTime()));

    const after = new Date(2026, 10, 15, 9, 0, 0);
    const later = nextReminderDates(after, 2);
    assert.equal(later[0]?.getDate(), 16);
    assert.equal(later[1]?.getDate(), 19);
    assert.equal(later[0]?.getHours(), 8);
  });

  it('stays on after a purchase and turns off only with the toggle or missing permission', () => {
    assert.equal(shouldScheduleReminders({ enabled: true, permissionGranted: true, isPro: false }), true);
    assert.equal(shouldScheduleReminders({ enabled: true, permissionGranted: true, isPro: true }), true);
    assert.equal(shouldScheduleReminders({ enabled: false, permissionGranted: true, isPro: false }), false);
    assert.equal(shouldScheduleReminders({ enabled: false, permissionGranted: true, isPro: true }), false);
    assert.equal(shouldScheduleReminders({ enabled: true, permissionGranted: false }), false);
  });

  it('uses a plain cleanup line and the measured size, with no medical or AI wording', () => {
    assert.equal(reminderBody(0), 'Open Ai Klenzer to review your library and choose what to remove.');
    assert.equal(reminderBody(63_000_000), '63 MB is ready to review. Open Ai Klenzer and choose what to remove.');
    assert.match(reminderBody(63_000_000), /Ai Klenzer/);
    assert.doesNotMatch(reminderBody(63_000_000), /artificial intelligence|doctor|diagnos|virus|boost|battery|RAM/i);
    assert.equal(src('src/lib/reminder-plan.ts').includes('Time for a quick cleanup'), true);
  });
});
