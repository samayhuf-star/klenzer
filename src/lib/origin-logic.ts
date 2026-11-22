/**
 * Forwarded and AI Images: pure rules. No Expo or native imports, so unit tests can run in Node.
 *
 * Forwarded: a phone cannot tell an app how many times a picture was forwarded. That label lives
 * inside the chat app. What can be read is where a picture came from (a chat app's album or folder,
 * a chat-style file name, no camera details) and whether the same picture is saved more than once.
 *
 * AI Images: only labels written into the file count. No guessing from how the picture looks.
 */
import { hamming, type DuplicateGroup, type Item } from './scan-logic';

/** What one photo's file says about where it came from. */
export type Origin = {
  /** Camera make, model or lens is recorded in the file. */
  hasCamera: boolean;
  /** Name of the AI label found in the file, or null. */
  aiTag: string | null;
  /** Share of the picture covered by text, 0 to 1. Null when text was not checked. */
  textRatio: number | null;
};

/** Album and folder names that chat apps save received pictures into. */
const CHAT_ALBUM = /whats\s?app|telegram|signal|messenger|viber|wechat|weixin|imo\b|snapchat|line\b|hike|sharechat|botim/i;

export const isChatAlbumTitle = (title: string | null | undefined) => !!title && CHAT_ALBUM.test(title);

/**
 * File names chat apps give to pictures they save.
 * Android WhatsApp: IMG-20241123-WA0007.jpg. Telegram: IMG_20241123_101500_123.jpg or telegram-cloud-photo.
 * iPhone WhatsApp and others: a bare UUID, or PHOTO-2024-11-23-10-15-00.jpg.
 */
const CHAT_NAME =
  /^(img|vid)-\d{8}-wa\d+|^photo-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}|^telegram|^signal-\d{4}|^received_\d+|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i;

export const isChatFilename = (filename: string | null | undefined) => !!filename && CHAT_NAME.test(filename.trim());

/** Photos worth opening: not screenshots, not Live Photos, not videos, and not HEIC camera originals. */
export function isOriginCandidate(item: Item): boolean {
  if (item.isVideo || item.isScreenshot || item.isLive) return false;
  return !/\.(heic|heif|dng|raw)$/i.test(item.filename ?? '');
}

/**
 * Labels that AI tools write into the pictures they make. `needle` is matched byte for byte.
 * "trainedAlgorithmicMedia" is the IPTC digital source type for a fully AI-made picture. It is also what
 * Content Credentials (C2PA) record. The lower-case t is deliberate: "compositeWithTrainedAlgorithmicMedia"
 * marks a real photo that was edited with AI, and those stay out of this folder.
 */
export const AI_MARKERS: { label: string; needle: string }[] = [
  { label: 'AI label', needle: 'trainedAlgorithmicMedia' },
  { label: 'Stable Diffusion', needle: 'tEXtparameters\u0000' },
  { label: 'Stable Diffusion', needle: 'iTXtparameters\u0000' },
  { label: 'ComfyUI', needle: 'tEXtprompt\u0000' },
  { label: 'ComfyUI', needle: 'tEXtworkflow\u0000' },
  { label: 'Midjourney', needle: 'Midjourney' },
  { label: 'DALL·E', needle: 'DALLÂ·E' },
  { label: 'DALL·E', needle: 'DALL-E' },
  { label: 'ChatGPT', needle: 'ChatGPT' },
  { label: 'OpenAI', needle: 'OpenAI' },
  { label: 'Adobe Firefly', needle: 'Adobe Firefly' },
  { label: 'Stable Diffusion', needle: 'Stable Diffusion' },
  { label: 'Stable Diffusion', needle: 'StableDiffusion' },
  { label: 'NovelAI', needle: 'NovelAI' },
  { label: 'Leonardo', needle: 'Leonardo.Ai' },
  { label: 'Ideogram', needle: 'Ideogram' },
  { label: 'Google AI', needle: 'Made with Google AI' },
  { label: 'Bing Image Creator', needle: 'Bing Image Creator' },
  { label: 'Microsoft Designer', needle: 'Microsoft Designer' },
  { label: 'Meta AI', needle: 'Imagined with AI' },
  { label: 'Meta AI', needle: 'Made with Meta AI' },
];

/** How much of the start of a file is read. Labels sit in the header, ahead of the picture data. */
export const AI_HEAD_BYTES = 512 * 1024;

/** One character per byte, so `needle` strings can be matched against raw file bytes. */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + step) as unknown as number[]);
  }
  return out;
}

/** The same patterns as byte values, for the native reader. */
export const AI_NEEDLE_BYTES: number[][] = AI_MARKERS.map((m) => Array.from(m.needle, (c) => c.charCodeAt(0) & 0xff));

/** Label for a set of matched AI_MARKERS indexes. A named tool wins over the generic IPTC label. */
export function aiTagFromHits(hits: number[]): string | null {
  let generic: string | null = null;
  for (const index of [...hits].sort((a, b) => a - b)) {
    const m = AI_MARKERS[index];
    if (!m) continue;
    if (m.label === 'AI label') generic = m.label;
    else return m.label;
  }
  return generic;
}

/** Name of the AI label found in the file's bytes, or null. */
export function detectAiTag(head: string): string | null {
  const hits: number[] = [];
  AI_MARKERS.forEach((m, index) => {
    if (head.includes(m.needle)) hits.push(index);
  });
  return aiTagFromHits(hits);
}

/** Camera details in the EXIF block that expo-media-library returns (nested on iOS, flat on Android). */
export function exifHasCamera(exif: unknown): boolean {
  if (!exif || typeof exif !== 'object') return false;
  const e = exif as Record<string, unknown>;
  const tiff = (e['{TIFF}'] ?? {}) as Record<string, unknown>;
  const sub = (e['{Exif}'] ?? {}) as Record<string, unknown>;
  const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  return (
    filled(tiff.Make) || filled(tiff.Model) || filled(sub.LensModel) || filled(sub.LensMake) ||
    filled(e.Make) || filled(e.Model) || filled(e.LensModel)
  );
}

/** A picture counts as text-heavy (a meme, quote or greeting card) when text covers this much of it. */
export const TEXT_HEAVY_RATIO = 0.12;

export type ForwardedWhy = 'repeat' | 'chat' | 'text';

export type OriginInput = {
  item: Item;
  inChatAlbum: boolean;
  origin: Origin | null;
};

export const isChatImage = (row: OriginInput) =>
  row.inChatAlbum || (isChatFilename(row.item.filename) && !row.origin?.hasCamera);

export const isTextForward = (row: OriginInput) =>
  !!row.origin && !row.origin.hasCamera && row.origin.textRatio != null && row.origin.textRatio >= TEXT_HEAVY_RATIO;

/** Two saved copies of one forward: same picture after the chat app recompressed it. */
export const REPEAT_HAMMING_MAX = 4;

/** Sets of the same picture saved more than once. Any date, any size: forwards arrive weeks apart. */
export function groupRepeats(items: Item[], maxHamming = REPEAT_HAMMING_MAX): DuplicateGroup[] {
  const hashed = items.filter((i) => !!i.dhash);
  const used = new Set<string>();
  const groups: DuplicateGroup[] = [];
  // Close hashes can differ in the first digits, so compare within the whole set. The set is chat images only.
  for (let a = 0; a < hashed.length; a++) {
    const seed = hashed[a];
    if (used.has(seed.id)) continue;
    const members = [seed];
    for (let b = a + 1; b < hashed.length; b++) {
      const other = hashed[b];
      if (used.has(other.id)) continue;
      if (hamming(seed.dhash as string, other.dhash as string) <= maxHamming) members.push(other);
    }
    if (members.length < 2) continue;
    for (const m of members) used.add(m.id);
    groups.push({ key: `fwd:${seed.dhash}`, items: members.sort((x, y) => y.size - x.size || x.creationTime - y.creationTime) });
  }
  return groups;
}

export type OriginResult = { forwarded: Item[]; aiImages: Item[] };

/**
 * Build both folders.
 * Forwarded: pictures saved more than once first (most copies first), then the rest, newest first.
 * AI Images: newest first.
 */
export function buildOriginResult(rows: OriginInput[]): OriginResult {
  const picked = new Map<string, { item: Item; why: ForwardedWhy }>();
  for (const row of rows) {
    if (isChatImage(row)) picked.set(row.item.id, { item: row.item, why: 'chat' });
    else if (isTextForward(row)) picked.set(row.item.id, { item: row.item, why: 'text' });
  }

  const repeats = groupRepeats([...picked.values()].map((p) => p.item));
  const copies = new Map<string, number>();
  for (const g of repeats) for (const i of g.items) copies.set(i.id, g.items.length);

  const repeated: Item[] = [];
  for (const g of [...repeats].sort((a, b) => b.items.length - a.items.length || b.items[0].creationTime - a.items[0].creationTime)) {
    for (const i of g.items) repeated.push({ ...i, fwd: 'repeat', copies: g.items.length });
  }
  const single = [...picked.values()]
    .filter((p) => !copies.has(p.item.id))
    .sort((a, b) => b.item.creationTime - a.item.creationTime)
    .map((p) => ({ ...p.item, fwd: p.why }) as Item);

  const aiImages = rows
    .filter((r) => !!r.origin?.aiTag)
    .sort((a, b) => b.item.creationTime - a.item.creationTime)
    .map((r) => ({ ...r.item, aiSource: r.origin!.aiTag as string }) as Item);

  return { forwarded: [...repeated, ...single], aiImages };
}

/**
 * Lay the two folders over the photos a scan currently holds. The folders can be filled while the
 * main scan is still measuring, so sizes are taken from the scan's own items, and photos that are
 * no longer in the library are dropped.
 */
export function applyOrigin(photos: Item[], origin: OriginResult): OriginResult {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const lay = (items: Item[]) =>
    items.flatMap((i) => {
      const live = byId.get(i.id);
      return live ? [{ ...i, size: live.size || i.size }] : [];
    });
  return { forwarded: lay(origin.forwarded), aiImages: lay(origin.aiImages) };
}
