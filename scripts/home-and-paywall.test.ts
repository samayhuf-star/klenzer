import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildScanResult, isScreenRecordingName, SHORT_VIDEO_SECONDS, type Item } from '../src/lib/scan-logic';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

const video = (id: string, filename: string, duration: number, size = 5_000_000): Item => ({
  id,
  uri: `file:///${id}.mov`,
  filename,
  width: 1080,
  height: 1920,
  creationTime: 1_700_000_000_000 + Number(id.replace(/\D/g, '') || 0),
  modificationTime: 1_700_000_000_000,
  duration,
  size,
  isVideo: true,
});

describe('video categories', () => {
  it('detects iOS screen recordings by file name', () => {
    assert.equal(isScreenRecordingName('RPReplay_Final1700000000.MP4'), true);
    assert.equal(isScreenRecordingName('ScreenRecording_11-12-2026 19-01-02_1.MP4'), true);
    assert.equal(isScreenRecordingName('IMG_0001.MOV'), false);
  });

  it('splits short recordings and screen recordings, largest first', () => {
    const r = buildScanResult({
      photoCount: 0,
      videoCount: 4,
      photos: [],
      screenshots: [],
      livePhotos: [],
      videos: [
        video('v1', 'IMG_0001.MOV', 3, 1_000_000),
        video('v2', 'IMG_0002.MOV', SHORT_VIDEO_SECONDS, 3_000_000),
        video('v3', 'IMG_0003.MOV', 45),
        video('v4', 'RPReplay_Final1.MP4', 4, 9_000_000),
      ],
    });
    assert.deepEqual(r.shortVideos.map((v) => v.id), ['v2', 'v1']);
    assert.deepEqual(r.screenRecordings.map((v) => v.id), ['v4']);
  });
});

describe('home layout', () => {
  const home = src('src/app/index.tsx');
  it('has no All Photos or All Videos tiles and no circular percent scanner', () => {
    assert.doesNotMatch(home, /kind="photos"/);
    assert.doesNotMatch(home, /title="Videos"/);
    assert.doesNotMatch(home, /ScanProgress/);
    assert.match(home, /<ScanBar/);
  });
  it('has the Photos, Videos and Contacts switcher and no Compress row', () => {
    assert.match(home, /<Segmented/);
    for (const kind of ['similar', 'duplicates', 'blurry', 'screenshots', 'videoDuplicates', 'shortVideos', 'screenRecordings']) {
      assert.match(home, new RegExp(`kind="${kind}"`));
    }
    assert.doesNotMatch(home, /Want to save up extra space\?/);
  });
  it('scan bar copy has no ellipsis character', () => {
    const bar = src('src/components/ScanBar.tsx');
    assert.match(bar, /'Scanning your library on this iPhone'/);
    assert.doesNotMatch(bar, /\u2026/);
  });
});

describe('paywall copy', () => {
  const paywall = src('src/app/paywall.tsx');
  const purchases = src('src/lib/purchases.ts');
  it('shows one unavailable message, not the same line twice, with a Retry', () => {
    assert.doesNotMatch(paywall, /Plans unavailable right now, try again later/);
    assert.doesNotMatch(purchases, /Plans unavailable right now, try again later/);
    assert.match(paywall, /\{PLANS_UNAVAILABLE_MESSAGE\}/);
    assert.match(paywall, /label="Retry"/);
    assert.doesNotMatch(paywall, /offers\?\.error/);
  });
  it('never mentions Google Play on iOS', () => {
    assert.doesNotMatch(paywall, /App Store or Google Play/);
    assert.doesNotMatch(paywall, /Apple ID or Google account/);
  });
  it('stays silent when Restore is cancelled and never renders raw errors', () => {
    assert.match(purchases, /return 'cancelled'/);
    assert.match(paywall, /r === 'none'/);
    assert.match(paywall, /r === 'error'/);
    assert.doesNotMatch(paywall, /\.message\b/);
    assert.doesNotMatch(paywall, /OPENIAP/);
  });
  it('fetches subs as subs and the lifetime as in-app, after connecting, with retries', () => {
    assert.match(purchases, /type: 'subs'/);
    assert.match(purchases, /type: 'in-app'/);
    assert.match(purchases, /ensureConnected\(\)/);
    assert.match(purchases, /delays = \[/);
    assert.match(purchases, /displayPrice/);
    assert.doesNotMatch(purchases, /revenuecat/i);
  });
});
