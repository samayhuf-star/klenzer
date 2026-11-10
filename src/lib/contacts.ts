import * as Contacts from 'expo-contacts/legacy';
import { Directory, File, Paths } from 'expo-file-system';

export type ContactsAccess = 'granted' | 'limited' | 'denied' | 'undetermined';

export type ContactLite = {
  id: string;
  name: string;
  phones: string[];
  emails: string[];
  company: string;
  /** How much detail this card holds; the richest card in a set is the one we keep. */
  weight: number;
};

/** One set of cards that look like the same person. items[0] is the card we keep. */
export type ContactGroup = {
  key: string;
  items: ContactLite[];
  /** 'strong' = shares a phone number or email. 'name' = only the name matches, so it is never pre-selected. */
  match: 'strong' | 'name';
};

type Perm = Awaited<ReturnType<typeof Contacts.getPermissionsAsync>>;
const toAccess = (p: Perm): ContactsAccess =>
  p.status === 'granted' ? (p.accessPrivileges === 'limited' ? 'limited' : 'granted') : p.status === 'denied' ? 'denied' : 'undetermined';

export async function contactsAccess(): Promise<{ access: ContactsAccess; canAskAgain: boolean }> {
  const p = await Contacts.getPermissionsAsync();
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

export async function requestContacts(): Promise<{ access: ContactsAccess; canAskAgain: boolean }> {
  const p = await Contacts.requestPermissionsAsync();
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

const FIELDS = [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Company];
const PAGE = 1000;

const phoneKey = (raw: string) => {
  const d = raw.replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-10) : '';
};
const nameKey = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim();

export async function loadContacts(): Promise<ContactLite[]> {
  const out: ContactLite[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await Contacts.getContactsAsync({ pageSize: PAGE, pageOffset: offset, fields: FIELDS });
    for (const c of page.data) {
      const phones = (c.phoneNumbers ?? []).map((p) => p.number ?? p.digits ?? '').filter(Boolean);
      const emails = (c.emails ?? []).map((e) => e.email ?? '').filter(Boolean);
      const name = (c.name ?? '').trim();
      const company = (c.company ?? '').trim();
      out.push({ id: c.id, name, phones, emails, company, weight: phones.length * 2 + emails.length * 2 + (company ? 1 : 0) + (name ? 1 : 0) });
    }
    if (!page.hasNextPage || page.data.length === 0) break;
  }
  return out;
}

/** Group cards that share a phone number, an email, or (weakly) a full name. */
export function findDuplicateContacts(list: ContactLite[]): ContactGroup[] {
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  const keysOf = list.map((c) => {
    const keys = new Set<string>();
    for (const p of c.phones) {
      const k = phoneKey(p);
      if (k) keys.add(`p:${k}`);
    }
    for (const e of c.emails) keys.add(`e:${e.toLowerCase().trim()}`);
    const n = nameKey(c.name);
    // A lone first name ("Mom", "Rahul") is far too common to treat as a duplicate.
    if (n.includes(' ')) keys.add(`n:${n}`);
    return keys;
  });
  keysOf.forEach((keys, i) => {
    for (const k of keys) {
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else parent[find(i)] = find(j);
    }
  });

  const buckets = new Map<number, number[]>();
  list.forEach((_, i) => {
    const r = find(i);
    buckets.set(r, [...(buckets.get(r) ?? []), i]);
  });

  const groups: ContactGroup[] = [];
  for (const idxs of buckets.values()) {
    if (idxs.length < 2) continue;
    const counts = new Map<string, number>();
    for (const i of idxs) for (const k of keysOf[i]) if (!k.startsWith('n:')) counts.set(k, (counts.get(k) ?? 0) + 1);
    const strong = [...counts.values()].some((n) => n > 1);
    const items = idxs.map((i) => list[i]).sort((a, b) => b.weight - a.weight);
    groups.push({ key: items.map((i) => i.id).join('|'), items, match: strong ? 'strong' : 'name' });
  }
  return groups.sort((a, b) => (a.match === b.match ? b.items.length - a.items.length : a.match === 'strong' ? -1 : 1));
}

export const extraCount = (groups: ContactGroup[]) => groups.reduce((n, g) => n + g.items.length - 1, 0);

/** Write every card we are about to touch to a .vcf file inside the app, so nothing is ever lost. */
export async function backupContacts(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const tmp = await Contacts.writeContactToFileAsync({ id: ids });
  if (!tmp) return null;
  const dir = new Directory(Paths.document, 'contact-backups');
  if (!dir.exists) dir.create();
  const dest = new File(dir, `contacts-${new Date().toISOString().replace(/[:.]/g, '-')}.vcf`);
  await new File(tmp).copy(dest);
  return dest.uri;
}

/**
 * Merge each chosen set into its richest card: numbers and emails the other cards had are added to it,
 * then the extra cards are removed. Returns how many cards were removed.
 */
export async function mergeGroups(groups: ContactGroup[], onProgress: (done: number, total: number) => void): Promise<number> {
  let removed = 0;
  let done = 0;
  for (const g of groups) {
    const [keep, ...extras] = g.items;
    try {
      const have = new Set(keep.phones.map(phoneKey).filter(Boolean));
      const haveMail = new Set(keep.emails.map((e) => e.toLowerCase().trim()));
      const newPhones: { label: string; number: string }[] = [];
      const newMails: { label: string; email: string }[] = [];
      for (const x of extras) {
        for (const p of x.phones) {
          const k = phoneKey(p);
          if (k && !have.has(k)) {
            have.add(k);
            newPhones.push({ label: 'mobile', number: p });
          }
        }
        for (const e of x.emails) {
          const k = e.toLowerCase().trim();
          if (!haveMail.has(k)) {
            haveMail.add(k);
            newMails.push({ label: 'other', email: e });
          }
        }
      }
      if (newPhones.length || newMails.length) {
        const full = await Contacts.getContactByIdAsync(keep.id, [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails]);
        await Contacts.updateContactAsync({
          id: keep.id,
          phoneNumbers: [...(full?.phoneNumbers ?? []), ...newPhones],
          emails: [...(full?.emails ?? []), ...newMails],
        });
      }
      for (const x of extras) {
        await Contacts.removeContactAsync(x.id);
        removed++;
      }
    } catch {
      // Leave this set untouched and carry on with the rest.
    }
    onProgress(++done, groups.length);
  }
  return removed;
}
