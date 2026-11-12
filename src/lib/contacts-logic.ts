/** Duplicate-contact detection and merge planning. Pure logic only, so unit tests run in Node. */

export type ContactRecord = { id: string; name: string; phones: string[]; emails: string[] };

export type DuplicateContactGroup = { key: string; contacts: ContactRecord[]; reasons: ('name' | 'phone' | 'email')[] };

export type MergePlan = {
  /** The contact that is updated and kept. */
  keepId: string;
  name: string;
  /** Every distinct phone across the group, first-seen formatting kept. */
  phones: string[];
  emails: string[];
  /** Phones and emails the kept contact does not have yet. */
  addPhones: string[];
  addEmails: string[];
  /** Contacts removed after the kept one is updated. */
  removeIds: string[];
};

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir']);

/** Lowercase, strip accents and punctuation, drop honorifics, sort tokens so "Sharma Priya" matches "Priya Sharma". */
export function normalizeName(name: string | null | undefined): string {
  const tokens = (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t));
  return tokens.sort().join(' ');
}

/**
 * Digits only, compared on the last 10 digits so "+91 98100 12345", "098100 12345" and "98100-12345" match.
 * Numbers shorter than 7 digits (short codes) are ignored.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 7) return null;
  return digits.length > 10 ? digits.slice(-10) : digits.replace(/^0+(?=\d{7,})/, '');
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase();
  return e.includes('@') ? e : null;
}

/** Group contacts that share a normalized name, a normalized phone, or an email. Transitive: A~B and B~C puts all three together. */
export function findDuplicateGroups(contacts: ContactRecord[]): DuplicateContactGroup[] {
  const parent = contacts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const reasons = new Map<number, Set<'name' | 'phone' | 'email'>>();
  const union = (a: number, b: number, why: 'name' | 'phone' | 'email') => {
    const ra = find(a);
    const rb = find(b);
    const merged = new Set([...(reasons.get(ra) ?? []), ...(reasons.get(rb) ?? []), why]);
    if (ra !== rb) parent[rb] = ra;
    reasons.set(find(a), merged);
  };
  const seen = new Map<string, number>();
  const link = (key: string, i: number, why: 'name' | 'phone' | 'email') => {
    const j = seen.get(key);
    if (j == null) seen.set(key, i);
    else union(j, i, why);
  };
  contacts.forEach((c, i) => {
    const n = normalizeName(c.name);
    if (n) link(`n:${n}`, i, 'name');
    for (const p of c.phones) {
      const k = normalizePhone(p);
      if (k) link(`p:${k}`, i, 'phone');
    }
    for (const e of c.emails) {
      const k = normalizeEmail(e);
      if (k) link(`e:${k}`, i, 'email');
    }
  });
  const byRoot = new Map<number, ContactRecord[]>();
  contacts.forEach((c, i) => {
    const r = find(i);
    byRoot.set(r, [...(byRoot.get(r) ?? []), c]);
  });
  const out: DuplicateContactGroup[] = [];
  for (const [root, members] of byRoot) {
    if (members.length < 2) continue;
    const order: ('name' | 'phone' | 'email')[] = ['name', 'phone', 'email'];
    const why = reasons.get(root) ?? new Set();
    out.push({ key: members.map((m) => m.id).sort().join('|'), contacts: members, reasons: order.filter((r) => why.has(r)) });
  }
  return out.sort((a, b) => b.contacts.length - a.contacts.length || a.key.localeCompare(b.key));
}

/** Prefer the fullest, properly cased name: more words, then mixed case, then longer. */
export function nameScore(name: string): number {
  const clean = (name ?? '').trim();
  if (!clean) return -1;
  const words = clean.split(/\s+/).length;
  const cased = /\p{Lu}/u.test(clean) && /\p{Ll}/u.test(clean) ? 1 : 0;
  return words * 1000 + cased * 100 + Math.min(99, clean.length);
}

/** Keep the contact with the best name (ties go to the one with more details), and union every phone and email onto it. */
export function planMerge(group: ContactRecord[]): MergePlan {
  if (group.length < 2) throw new Error('A merge needs at least two contacts');
  const detail = (c: ContactRecord) => c.phones.length + c.emails.length;
  const keep = [...group].sort((a, b) => nameScore(b.name) - nameScore(a.name) || detail(b) - detail(a))[0];
  const ordered = [keep, ...group.filter((c) => c.id !== keep.id)];

  const phones: string[] = [];
  const phoneKeys = new Set<string>();
  const emails: string[] = [];
  const emailKeys = new Set<string>();
  for (const c of ordered) {
    for (const p of c.phones) {
      const k = normalizePhone(p) ?? p.replace(/\s/g, '');
      if (!k || phoneKeys.has(k)) continue;
      phoneKeys.add(k);
      phones.push(p.trim());
    }
    for (const e of c.emails) {
      const k = normalizeEmail(e);
      if (!k || emailKeys.has(k)) continue;
      emailKeys.add(k);
      emails.push(e.trim());
    }
  }
  const keepPhoneKeys = new Set(keep.phones.map((p) => normalizePhone(p) ?? p.replace(/\s/g, '')));
  const keepEmailKeys = new Set(keep.emails.map((e) => normalizeEmail(e)));
  return {
    keepId: keep.id,
    name: keep.name.trim(),
    phones,
    emails,
    addPhones: phones.filter((p) => !keepPhoneKeys.has(normalizePhone(p) ?? p.replace(/\s/g, ''))),
    addEmails: emails.filter((e) => !keepEmailKeys.has(normalizeEmail(e))),
    removeIds: ordered.slice(1).map((c) => c.id),
  };
}

/** Each contact removed by a merge counts as one item against the free daily allowance. */
export const mergeItemCount = (plans: MergePlan[]) => plans.reduce((n, p) => n + p.removeIds.length, 0);
