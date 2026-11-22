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
/** The folders on screen are refreshed after this many photos, so they fill while the pass runs. */
export const ORIGIN_PARTIAL_EVERY = 200;

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
  onPartial?: (r: OriginResult) => void,
): Promise<OriginResult> {
  const workers = io.workers ?? ORIGIN_WORKERS;
  const timeout = io.inspectTimeoutMs ?? ORIGIN_TIMEOUT_MS;

  let chatIds = new Set<string>();
  try {
    chatIds = await io.chatAlbumIds();
  } catch {}

  const candidates = [...photos]
    .filter(isOriginCandidate)
    .sort((a, b) => b.creationTime - a.creationTime)
    .slice(0, io.maxInspect ?? ORIGIN_MAX_INSPECT)
    .map((item) => ({ ...item }));

  // Pictures in a chat app's album are known before any file is opened, so they show straight away.
  const rowById = new Map<string, OriginInput>();
  for (const item of candidates) {
    if (chatIds.has(item.id)) rowById.set(item.id, { item, inChatAlbum: true, origin: null });
  }
  const currentRows = () => [...rowById.values()];
  const publish = () => {
    if (onPartial && !signal.cancelled) onPartial(buildOriginResult(currentRows()));
  };
  onProgress?.({ done: 0, total: candidates.length });
  if (rowById.size) publish();

  let done = 0;
  await pool(candidates, workers, async (item) => {
    if (signal.cancelled) return;
    const inChatAlbum = chatIds.has(item.id);
    // Text is only checked where it can change the answer: pictures not already known to be from a chat.
    const wantText = !inChatAlbum && !isChatFilename(item.filename);
    const origin = await withTimeout(io.inspect(item, { wantText }), timeout, null);
    rowById.set(item.id, { item, inChatAlbum, origin });
    onProgress?.({ done: ++done, total: candidates.length });
    if (done % ORIGIN_PARTIAL_EVERY === 0) publish();
  });
  if (signal.cancelled) return { forwarded: [], aiImages: [] };
  const rows = currentRows();

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
