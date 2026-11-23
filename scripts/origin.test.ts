import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AI_MARKERS,
  AI_NEEDLE_BYTES,
  aiTagFromHits,
  buildOriginResult,
  bytesToBinaryString,
  detectAiTag,
  exifHasCamera,
  isChatAlbumTitle,
  isChatFilename,
  isOriginCandidate,
  type Origin,
} from '../src/lib/origin-logic';
import { scanOrigins } from '../src/lib/origin-scan';
import { emptyScanResult, type Item } from '../src/lib/scan-logic';
import { parseStoredScanResult, serializeScanResult } from '../src/lib/scan-result-parse';

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  uri: `file:///${id}.jpg`,
  filename: `${id}.jpg`,
  width: 1200,
  height: 1600,
  creationTime: 1_700_000_000_000 + Number(id.replace(/\D/g, '') || 0) * 1000,
  modificationTime: 1,
  duration: 0,
  size: 200_000,
  isVideo: false,
  ...extra,
});
const origin = (o: Partial<Origin> = {}): Origin => ({ hasCamera: false, aiTag: null, textRatio: null, ...o });
const bytes = (text: string) => bytesToBinaryString(new Uint8Array(Buffer.from(text, 'latin1')));

describe('chat sources', () => {
  it('knows chat albums and folders', () => {
    for (const t of ['WhatsApp', 'WhatsApp Images', 'Telegram', 'Signal', 'WhatsApp Business']) assert.equal(isChatAlbumTitle(t), true, t);
    for (const t of ['Camera', 'Recents', 'Favourites', 'Screenshots', '', null]) assert.equal(isChatAlbumTitle(t), false, String(t));
  });
  it('knows chat file names', () => {
    for (const n of ['IMG-20241123-WA0007.jpg', 'PHOTO-2024-11-23-10-15-00.jpg', '3F2504E0-4F89-11D3-9A0C-0305E82C3301.jpg', 'telegram-cloud-photo-size-5.jpg'])
      assert.equal(isChatFilename(n), true, n);
    for (const n of ['IMG_1234.JPG', 'IMG_1234.HEIC', 'Screenshot 1.png', 'DSC0001.jpg']) assert.equal(isChatFilename(n), false, n);
  });
  it('skips videos, screenshots, Live Photos and HEIC originals', () => {
    assert.equal(isOriginCandidate(item('a1')), true);
    assert.equal(isOriginCandidate(item('a2', { isVideo: true })), false);
    assert.equal(isOriginCandidate(item('a3', { isScreenshot: true })), false);
    assert.equal(isOriginCandidate(item('a4', { isLive: true })), false);
    assert.equal(isOriginCandidate(item('a5', { filename: 'IMG_0001.HEIC' })), false);
  });
});

describe('AI labels', () => {
  it('finds the IPTC source type and Content Credentials value', () => {
    const xmp = bytes('\xff\xd8\xff\xe1<x:xmpmeta Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/>\xff\xda');
    assert.equal(detectAiTag(xmp), 'AI label');
  });
  it('prefers the tool name over the generic label', () => {
    assert.equal(detectAiTag(bytes('c2pa ... OpenAI ... trainedAlgorithmicMedia ... ChatGPT')), 'ChatGPT');
    assert.equal(detectAiTag(bytes('Software\0Midjourney')), 'Midjourney');
    assert.equal(detectAiTag(new Uint8Array(Buffer.from('made by DALL·E 3', 'utf8')).reduce((s, b) => s + String.fromCharCode(b), '')), 'DALL·E');
  });
  it('finds Stable Diffusion and ComfyUI PNG text chunks', () => {
    assert.equal(detectAiTag(bytes('\x89PNG....tEXtparameters\0a cat, Steps: 20')), 'Stable Diffusion');
    assert.equal(detectAiTag(bytes('\x89PNG....tEXtprompt\0{"3":{}}')), 'ComfyUI');
  });
  it('leaves ordinary photos and AI-edited real photos alone', () => {
    assert.equal(detectAiTag(bytes('\xff\xd8\xff\xe1Exif\0\0Apple iPhone 15 Pro back camera')), null);
    assert.equal(detectAiTag(bytes('digitalsourcetype/compositeWithTrainedAlgorithmicMedia')), null);
    assert.equal(detectAiTag(bytes('digitalsourcetype/digitalCapture c2pa.created')), null);
  });
  it('byte patterns match the string patterns one to one', () => {
    assert.equal(AI_NEEDLE_BYTES.length, AI_MARKERS.length);
    AI_MARKERS.forEach((m, i) => assert.equal(String.fromCharCode(...AI_NEEDLE_BYTES[i]), m.needle));
    const generic = AI_MARKERS.findIndex((m) => m.label === 'AI label');
    const named = AI_MARKERS.findIndex((m) => m.label === 'Midjourney');
    assert.equal(aiTagFromHits([generic, named]), 'Midjourney');
    assert.equal(aiTagFromHits([generic]), 'AI label');
    assert.equal(aiTagFromHits([]), null);
  });
  it('reads camera details from iPhone and Android EXIF shapes', () => {
    assert.equal(exifHasCamera({ '{TIFF}': { Make: 'Apple', Model: 'iPhone 15' } }), true);
    assert.equal(exifHasCamera({ Make: 'samsung', Model: 'SM-S918B' }), true);
    assert.equal(exifHasCamera({ '{Exif}': { PixelXDimension: 1200 }, Orientation: 1 }), false);
    assert.equal(exifHasCamera(null), false);
  });
});

describe('folders', () => {
  it('puts repeats first with a copy count, then single chat images and text-heavy forwards', () => {
    const rows = [
      { item: item('p1', { dhash: 'ffff0000ffff0000' }), inChatAlbum: true, origin: origin() },
      { item: item('p2', { dhash: 'ffff0000ffff0001' }), inChatAlbum: true, origin: origin() },
      { item: item('p3', { dhash: 'ffff0000ffff0000' }), inChatAlbum: true, origin: origin() },
      { item: item('p4', { dhash: '0123456789abcdef' }), inChatAlbum: true, origin: origin() },
      { item: item('p5', { filename: 'good-morning.jpg' }), inChatAlbum: false, origin: origin({ textRatio: 0.3 }) },
      { item: item('p6', { filename: 'IMG_0006.JPG' }), inChatAlbum: false, origin: origin({ hasCamera: true, textRatio: 0.4 }) },
      { item: item('p7', { filename: 'IMG_0007.JPG' }), inChatAlbum: false, origin: origin({ textRatio: 0.02 }) },
      { item: item('p8', { filename: 'IMG-20241123-WA0001.jpg' }), inChatAlbum: false, origin: null },
    ];
    const out = buildOriginResult(rows);
    assert.deepEqual(new Set(out.forwarded.slice(0, 3).map((i) => i.id)), new Set(['p1', 'p2', 'p3']));
    assert.ok(out.forwarded.slice(0, 3).every((i) => i.fwd === 'repeat' && i.copies === 3));
    assert.deepEqual(out.forwarded.slice(3).map((i) => i.id), ['p8', 'p5', 'p4']);
    assert.equal(out.forwarded.find((i) => i.id === 'p5')?.fwd, 'text');
    assert.equal(out.forwarded.find((i) => i.id === 'p4')?.fwd, 'chat');
    assert.equal(out.forwarded.some((i) => i.id === 'p6' || i.id === 'p7'), false);
  });
  it('lists only labelled pictures as AI, newest first', () => {
    const out = buildOriginResult([
      { item: item('q1'), inChatAlbum: false, origin: origin({ aiTag: 'ChatGPT' }) },
      { item: item('q2'), inChatAlbum: false, origin: origin() },
      { item: item('q3'), inChatAlbum: true, origin: origin({ aiTag: 'AI label' }) },
      { item: item('q4'), inChatAlbum: false, origin: null },
    ]);
    assert.deepEqual(out.aiImages.map((i) => [i.id, i.aiSource]), [['q3', 'AI label'], ['q1', 'ChatGPT']]);
  });
});

describe('origin pass', () => {
  it('inspects candidates only, asks for text only where it matters, hashes only forwarded pictures', async () => {
    const photos = [
      item('r1'), item('r2'), item('r3', { filename: 'IMG_0003.HEIC' }), item('r4', { isScreenshot: true }),
      item('r5', { filename: 'card.jpg' }), item('r6', { filename: 'ai.png' }),
    ];
    const asked: Record<string, boolean> = {};
    const hashed: string[] = [];
    const out = await scanOrigins(photos, {
      chatAlbumIds: async () => new Set(['r1', 'r2']),
      inspect: async (i, o) => {
        asked[i.id] = o.wantText;
        if (i.id === 'r5') return origin({ textRatio: 0.5 });
        if (i.id === 'r6') return origin({ aiTag: 'Midjourney', textRatio: 0 });
        return origin();
      },
      hash: async (i) => {
        hashed.push(i.id);
        return i.id === 'r5' ? '0000000000000000' : 'aaaaaaaaaaaaaaaa';
      },
    });
    assert.deepEqual(asked, { r1: false, r2: false, r5: true, r6: true });
    assert.deepEqual(hashed.sort(), ['r1', 'r2', 'r5']);
    assert.deepEqual(new Set(out.forwarded.slice(0, 2).map((i) => i.id)), new Set(['r1', 'r2']));
    assert.ok(out.forwarded.slice(0, 2).every((i) => i.fwd === 'repeat' && i.copies === 2));
    assert.deepEqual(out.forwarded.slice(2).map((i) => [i.id, i.fwd]), [['r5', 'text']]);
    assert.deepEqual(out.aiImages.map((i) => i.id), ['r6']);
  });
  it('a failing or hanging read skips the photo and the pass still finishes', async () => {
    const out = await scanOrigins([item('s1'), item('s2'), item('s3')], {
      chatAlbumIds: async () => { throw new Error('no albums'); },
      inspect: async (i) => {
        if (i.id === 's1') throw new Error('boom');
        if (i.id === 's2') return new Promise<Origin | null>(() => {});
        return origin({ aiTag: 'OpenAI' });
      },
      hash: async () => null,
      inspectTimeoutMs: 50,
    });
    assert.deepEqual(out.aiImages.map((i) => i.id), ['s3']);
    assert.deepEqual(out.forwarded, []);
  });
  it('fills chat images from the albums before any file is opened, including HEIC and Live Photos in a chat album', async () => {
    let inspected = 0;
    let early: string[] = [];
    let inspectedAtEarly = -1;
    const out = await scanOrigins(
      [item('v1', { filename: 'IMG_0001.HEIC' }), item('v2', { isLive: true }), item('v3', { filename: 'IMG_0003.HEIC' }), item('v4', { isVideo: true })],
      {
        chatAlbumIds: async () => new Set(['v1', 'v2', 'v4']),
        inspect: async () => {
          inspected++;
          return origin();
        },
        hash: async () => null,
      },
      { cancelled: false },
      undefined,
      (r) => {
        early = r.forwarded.map((i) => i.id).sort();
        inspectedAtEarly = inspected;
      },
    );
    assert.deepEqual(early, ['v1', 'v2']);
    assert.equal(inspectedAtEarly, 0);
    assert.deepEqual(out.forwarded.map((i) => i.id).sort(), ['v1', 'v2']);
  });
  it('a cancelled pass returns nothing', async () => {
    const signal = { cancelled: true };
    const out = await scanOrigins([item('t1')], { chatAlbumIds: async () => new Set(['t1']), inspect: async () => origin(), hash: async () => null }, signal);
    assert.deepEqual(out, { forwarded: [], aiImages: [] });
  });
});

describe('saved results', () => {
  it('keeps both folders through save and load, and loads older saves without them', () => {
    const r = { ...emptyScanResult(), photos: [item('u1')], forwarded: [item('u1', { fwd: 'repeat', copies: 2, dhash: 'ffffffffffffffff' })], aiImages: [item('u2', { aiSource: 'ChatGPT' })] };
    const back = parseStoredScanResult(serializeScanResult(r))!;
    assert.equal(back.forwarded[0].copies, 2);
    assert.equal(back.forwarded[0].dhash, undefined);
    assert.equal(back.aiImages[0].aiSource, 'ChatGPT');
    const old = parseStoredScanResult(JSON.stringify({ photos: [item('u1')], screenshots: [] }))!;
    assert.deepEqual([old.forwarded, old.aiImages], [[], []]);
  });
});
