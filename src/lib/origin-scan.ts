/** Forwarded and AI Images pass. Runs after the main scan. Injectable I/O so Node tests can drive it. */
import { withTimeout, type Item } from './scan-logic';
import { buildOriginResult, isChatFilename, isOriginCandidate, type Origin, type OriginInput, type OriginResult } from './origin-logic';

export type OriginIO = {
  /** Ids of every photo inside a chat app's album or folder. */
  chatAlbumIds: () => Promise<Set<string>>;
  /** Read one photo's file details. Null when the file is not on this phone or cannot be read. */
  inspect: (item: Item, opts: { wantText: boolean }) => Promise<Origin | null>;
  /** Picture fingerprint, used to find the same forward saved more than once. */
  hash: (item: Item) => Promise<string | null>;
  workers?: number;
  inspectTimeoutMs?: number;
  /** Newest photos checked per scan. Older ones are picked up from the cache on later scans. */
  maxInspect?: number;
};

export type OriginProgress = { done: number; total: number };

export const ORIGIN_WORKERS = 4;
export const ORIGIN_TIMEOUT_MS = 12_000;
export const ORIGIN_MAX_INSPECT = 12_000;

async function pool<T>(items: T[], workers: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(workers, items.length || 1)) }, run));
}

export async function scanOrigins(
  photos: Item[],
  io: OriginIO,
  signal: { cancelled: boolean } = { cancelled: false },
  onProgress?: (p: OriginProgress) => void,
  /** Called as soon as the chat albums are read, so the Chat images card fills before any file is opened. */
  onEarly?: (r: OriginResult) => void,
): Promise<OriginResult> {
  const workers = io.workers ?? ORIGIN_WORKERS;
  const timeout = io.inspectTimeoutMs ?? ORIGIN_TIMEOUT_MS;

  let chatIds = new Set<string>();
  try {
    chatIds = await io.chatAlbumIds();
  } catch {}

  const candidates = [...photos]
    // Everything in a chat app's album counts, whatever its file type.
    .filter((p) => isOriginCandidate(p) || (!p.isVideo && chatIds.has(p.id)))
    .sort((a, b) => b.creationTime - a.creationTime)
    .slice(0, io.maxInspect ?? ORIGIN_MAX_INSPECT)
    .map((item) => ({ ...item }));

  if (onEarly && !signal.cancelled) {
    const early = buildOriginResult(
      candidates.filter((i) => chatIds.has(i.id) || isChatFilename(i.filename)).map((item) => ({ item, inChatAlbum: chatIds.has(item.id), origin: null })),
    );
    if (early.forwarded.length) onEarly(early);
  }

  const rows: OriginInput[] = [];
  let done = 0;
  await pool(candidates, workers, async (item) => {
    if (signal.cancelled) return;
    const inChatAlbum = chatIds.has(item.id);
    // Text cover decides whether a picture joins the folder, and which tab of it (meme, document, photo) it sits under.
    const wantText = true;
    const origin = await withTimeout(io.inspect(item, { wantText }), timeout, null);
    rows.push({ item, inChatAlbum, origin });
    onProgress?.({ done: ++done, total: candidates.length });
  });
  if (signal.cancelled) return { forwarded: [], aiImages: [] };

  // Only pictures headed for the Forwarded folder need a fingerprint.
  const first = buildOriginResult(rows);
  const byId = new Map(rows.map((r) => [r.item.id, r.item]));
  const toHash = first.forwarded.map((i) => byId.get(i.id)).filter((i): i is Item => !!i && !i.dhash);
  await pool(toHash, workers, async (item) => {
    if (signal.cancelled) return;
    const dhash = await withTimeout(io.hash(item), timeout, null);
    if (dhash) item.dhash = dhash;
  });

  return buildOriginResult(rows);
}
