/** Secret Album rules that do not touch native code: PIN format, lockout after wrong PINs, and the album index. */

export const PIN_MIN = 4;
export const PIN_MAX = 6;
/** Wrong PINs allowed before a short lockout. Each further lockout doubles, capped at 15 minutes. */
export const PIN_FREE_ATTEMPTS = 5;
export const LOCKOUT_BASE_MS = 30_000;
export const LOCKOUT_MAX_MS = 15 * 60_000;
/** Items larger than this are refused, because each file is encrypted in memory in one pass. */
export const VAULT_MAX_ITEM_BYTES = 150 * 1e6;

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

export type Lockout = { failures: number; lockedUntil: number };
export const noLockout = (): Lockout => ({ failures: 0, lockedUntil: 0 });

export function registerFailure(state: Lockout, now: number): Lockout {
  const failures = state.failures + 1;
  if (failures < PIN_FREE_ATTEMPTS) return { failures, lockedUntil: 0 };
  const step = failures - PIN_FREE_ATTEMPTS;
  const wait = Math.min(LOCKOUT_MAX_MS, LOCKOUT_BASE_MS * 2 ** step);
  return { failures, lockedUntil: now + wait };
}

export const lockRemainingMs = (state: Lockout, now: number) => Math.max(0, state.lockedUntil - now);

/** Compare two hex digests without stopping at the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type VaultEntry = {
  id: string;
  /** Original file name, used when exporting back to Photos. */
  filename: string;
  mime: string;
  width: number;
  height: number;
  /** Plaintext size in bytes. */
  size: number;
  /** When the photo was taken, if known. */
  createdAt: number;
  addedAt: number;
};

export type VaultIndex = { version: 1; entries: VaultEntry[] };
export const emptyIndex = (): VaultIndex => ({ version: 1, entries: [] });

export const addEntries = (index: VaultIndex, entries: VaultEntry[]): VaultIndex => {
  const known = new Set(index.entries.map((e) => e.id));
  return { version: 1, entries: [...entries.filter((e) => !known.has(e.id)), ...index.entries] };
};
export const removeEntry = (index: VaultIndex, id: string): VaultIndex => ({ version: 1, entries: index.entries.filter((e) => e.id !== id) });

export function parseIndex(json: string | null | undefined): VaultIndex {
  if (!json) return emptyIndex();
  try {
    const v = JSON.parse(json) as Partial<VaultIndex>;
    if (v && v.version === 1 && Array.isArray(v.entries)) return { version: 1, entries: v.entries.filter((e) => e && typeof e.id === 'string') };
  } catch {}
  return emptyIndex();
}

/** File extension for an exported or temporarily decrypted copy. */
export function extensionFor(filename: string, mime: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(filename ?? '');
  if (m) return m[1].toLowerCase();
  if (/png/.test(mime)) return 'png';
  if (/heic|heif/.test(mime)) return 'heic';
  return 'jpg';
}
