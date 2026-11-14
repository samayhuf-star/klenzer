/**
 * Klenzer Pro gating. Pure logic only (no Expo or native imports) so unit tests run in Node.
 *
 * Free: scanning, reviewing, Swipe to Organize swiping, the contact merge preview,
 * Secret Album setup and viewing.
 * Pro: deleting photos and videos (bulk clean, the Swipe batch, Short and Screen Recordings),
 * merging contacts, adding items to the Secret Album, Compress and Convert Live Photos.
 *
 * Free users get FREE_DAILY_ACTIONS items per local day across deletes, merges and Secret Album adds.
 * Compress and Convert Live Photos have no free allowance.
 */

/** Free items per local day, counted across deleted photos and videos, merged-away contacts and Secret Album adds. */
export const FREE_DAILY_ACTIONS = 10;

export type ProFeature = 'delete' | 'merge' | 'vault' | 'compress' | 'convert';

/** Features that draw from the free daily allowance. Everything else is Pro only. */
export const ALLOWANCE_FEATURES: readonly ProFeature[] = ['delete', 'merge', 'vault'];

export type Allowance = { day: string; used: number };

/** Local calendar day, e.g. "2026-11-12". The count resets when this changes, at local midnight. */
export function localDayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function freshAllowance(now: Date): Allowance {
  return { day: localDayKey(now), used: 0 };
}

/** Roll the stored count over to today. A stored day that is not today (including a clock moved back) starts fresh. */
export function normalizeAllowance(a: Allowance | null | undefined, now: Date): Allowance {
  const day = localDayKey(now);
  if (!a || a.day !== day || !Number.isFinite(a.used) || a.used < 0) return { day, used: 0 };
  return { day, used: Math.floor(a.used) };
}

export function remainingFree(a: Allowance | null | undefined, now: Date, limit = FREE_DAILY_ACTIONS): number {
  return Math.max(0, limit - normalizeAllowance(a, now).used);
}

/** Count items that actually completed. Never goes past the limit. */
export function consumeAllowance(a: Allowance | null | undefined, items: number, now: Date, limit = FREE_DAILY_ACTIONS): Allowance {
  const base = normalizeAllowance(a, now);
  const n = Math.max(0, Math.floor(items));
  return { day: base.day, used: Math.min(limit, base.used + n) };
}

export function parseAllowance(raw: string | null | undefined): Allowance | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Allowance>;
    if (typeof v?.day === 'string' && typeof v?.used === 'number') return { day: v.day, used: v.used };
  } catch {}
  return null;
}

export type GateDecision = {
  /** Items that may run now: all of them for Pro, the free remainder otherwise. */
  freeNow: number;
  /** Items that need Pro. */
  blocked: number;
  /** True when at least one item needs the paywall. */
  needsPaywall: boolean;
  /** True when the run would draw from the free allowance (so completed items must be counted). */
  countsAgainstAllowance: boolean;
};

/** The single gate. Every Pro action asks this first. */
export function decideGate(input: { isPro: boolean; feature: ProFeature; count: number; remaining: number }): GateDecision {
  const count = Math.max(0, Math.floor(input.count));
  if (input.isPro) return { freeNow: count, blocked: 0, needsPaywall: false, countsAgainstAllowance: false };
  if (!ALLOWANCE_FEATURES.includes(input.feature)) {
    return { freeNow: 0, blocked: count, needsPaywall: true, countsAgainstAllowance: false };
  }
  const freeNow = Math.min(count, Math.max(0, Math.floor(input.remaining)));
  const blocked = count - freeNow;
  return { freeNow, blocked, needsPaywall: blocked > 0, countsAgainstAllowance: true };
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** Subtle remaining-count line, e.g. "3 free items left today". */
export function remainingLine(remaining: number): string {
  if (remaining <= 0) return 'No free items left today';
  return `${plural(remaining, 'free item', 'free items')} left today`;
}

export type GateVerb = 'clean' | 'merge' | 'add';

/** Copy for a batch that crosses the limit, e.g. "You have 3 free items left today. Upgrade to clean all 12." */
export function crossLimitMessage(remaining: number, total: number, verb: GateVerb = 'clean'): string {
  const lead = remaining > 0 ? `You have ${plural(remaining, 'free item', 'free items')} left today.` : `You have used today’s ${FREE_DAILY_ACTIONS} free items.`;
  return `${lead} Upgrade to ${verb} all ${total.toLocaleString('en-US')}.`;
}

/** Take the first n items across groups, keeping group order. Groups that end up empty are dropped unless keepEmpty says so. */
export function takeAcrossGroups<G extends { items: unknown[] }>(groups: G[], n: number, keepEmpty: (g: G) => boolean = () => false): G[] {
  let left = Math.max(0, Math.floor(n));
  const out: G[] = [];
  for (const g of groups) {
    if (keepEmpty(g)) {
      out.push(g);
      continue;
    }
    if (left <= 0) continue;
    const items = g.items.slice(0, left);
    left -= items.length;
    if (items.length) out.push({ ...g, items });
  }
  return out;
}
