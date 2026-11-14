import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isScreenRecordingName, isShortVideo, SHORT_VIDEO_SECONDS, type Item } from '../src/lib/scan-logic';
import { addEntries, constantTimeEqual, emptyIndex, extensionFor, isValidPin, lockRemainingMs, LOCKOUT_BASE_MS, noLockout, parseIndex, PIN_FREE_ATTEMPTS, registerFailure, removeEntry, type VaultEntry } from '../src/lib/vault-logic';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const video = (filename: string, duration: number): Item => ({ id: filename, uri: '', filename, width: 1080, height: 1920, creationTime: 0, modificationTime: 0, duration, size: 1, isVideo: true });

describe('short and screen recording classification', () => {
  it('treats clips at or under the limit as short, but not screen recordings', () => {
    assert.equal(SHORT_VIDEO_SECONDS, 10);
    assert.equal(isShortVideo(video('IMG_0001.MOV', 3)), true);
    assert.equal(isShortVideo(video('IMG_0002.MOV', 10)), true);
    assert.equal(isShortVideo(video('IMG_0003.MOV', 10.5)), false);
    assert.equal(isShortVideo(video('IMG_0004.MOV', 0)), false);
    assert.equal(isShortVideo(video('RPReplay_Final1700000000.MP4', 4)), false);
    assert.equal(isShortVideo({ ...video('IMG_0005.HEIC', 2), isVideo: false }), false);
  });

  it('spots iOS screen recordings by name', () => {
    assert.equal(isScreenRecordingName('RPReplay_Final1700000000.MP4'), true);
    assert.equal(isScreenRecordingName('ScreenRecording_11-12-2026 19-30-00_1.MP4'), true);
    assert.equal(isScreenRecordingName('Screen Recording 2026-11-12 at 7.30.00 PM.mov'), true);
    assert.equal(isScreenRecordingName('IMG_0001.MOV'), false);
  });
});

describe('Secret Album rules', () => {
  it('accepts 4 to 6 digit PINs only', () => {
    for (const ok of ['1234', '12345', '123456']) assert.equal(isValidPin(ok), true);
    for (const bad of ['123', '1234567', '12a4', '']) assert.equal(isValidPin(bad), false);
  });

  it('locks out after repeated wrong PINs, doubling each time', () => {
    let l = noLockout();
    for (let i = 0; i < PIN_FREE_ATTEMPTS - 1; i++) l = registerFailure(l, 0);
    assert.equal(lockRemainingMs(l, 0), 0);
    l = registerFailure(l, 1000);
    assert.equal(lockRemainingMs(l, 1000), LOCKOUT_BASE_MS);
    l = registerFailure(l, 2000);
    assert.equal(lockRemainingMs(l, 2000), LOCKOUT_BASE_MS * 2);
  });

  it('compares hashes in constant time', () => {
    assert.equal(constantTimeEqual('abcd', 'abcd'), true);
    assert.equal(constantTimeEqual('abcd', 'abce'), false);
    assert.equal(constantTimeEqual('abc', 'abcd'), false);
  });

  it('keeps an index of encrypted items', () => {
    const e = (id: string): VaultEntry => ({ id, filename: `${id}.HEIC`, mime: 'image/heic', width: 1, height: 1, size: 1, createdAt: 0, addedAt: 0 });
    let idx = addEntries(emptyIndex(), [e('a'), e('b')]);
    idx = addEntries(idx, [e('b'), e('c')]);
    assert.deepEqual(idx.entries.map((x) => x.id), ['c', 'a', 'b']);
    idx = removeEntry(idx, 'a');
    assert.deepEqual(parseIndex(JSON.stringify(idx)), idx);
    assert.deepEqual(parseIndex('garbage'), emptyIndex());
    assert.equal(extensionFor('IMG_1.HEIC', 'image/heic'), 'heic');
    assert.equal(extensionFor('', 'image/png'), 'png');
  });

  it('encrypts with expo-crypto AES-GCM, keeps the key in secure storage, and never stores the PIN itself', () => {
    const vault = readFileSync(join(root, 'src/lib/vault.ts'), 'utf8');
    assert.match(vault, /aesEncryptAsync/);
    assert.match(vault, /AESKeySize\.AES256/);
    assert.match(vault, /SecureStore\.setItemAsync\(K\.key/);
    assert.match(vault, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
    assert.ok(!/setItemAsync\(K\.pin, pin/.test(vault));
  });
});

describe('demo data', () => {
  it('only turns on in development with EXPO_PUBLIC_DEMO=1', () => {
    const demo = readFileSync(join(root, 'src/lib/demo.ts'), 'utf8');
    assert.match(demo, /__DEV__ === true && process\.env\.EXPO_PUBLIC_DEMO === '1'/);
  });
});
