/** On-device contact reads and merges through expo-contacts. Nothing leaves the phone. */
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import type { ContactRecord, MergePlan } from './contacts-logic';

export type ContactsAccess = 'granted' | 'limited' | 'denied' | 'undetermined';

const toAccess = (p: { status: string; accessPrivileges?: string }): ContactsAccess =>
  p.status === 'granted' ? (p.accessPrivileges === 'limited' ? 'limited' : 'granted') : p.status === 'denied' ? 'denied' : 'undetermined';

export async function contactsAccess(ask: boolean): Promise<{ access: ContactsAccess; canAskAgain: boolean }> {
  const p = ask ? await requestPermissionsAsync() : await getPermissionsAsync();
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

const FIELDS = [ContactField.FULL_NAME, ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.PHONES, ContactField.EMAILS] as const;

export async function loadContacts(): Promise<ContactRecord[]> {
  const rows = await Contact.getAllDetails(FIELDS);
  return rows.map((r) => {
    const name = (r.fullName ?? [r.givenName, r.familyName].filter(Boolean).join(' ')).trim();
    return {
      id: r.id,
      name,
      phones: (r.phones ?? []).map((p) => p.number ?? '').filter(Boolean),
      emails: (r.emails ?? []).map((e) => e.address ?? '').filter(Boolean),
    };
  });
}

/**
 * Apply one merge: add the missing phones and emails to the kept contact first, then delete the others.
 * Resolves with how many contacts were removed. If adding details fails, nothing is deleted.
 */
export async function applyMerge(plan: MergePlan): Promise<number> {
  const keep = new Contact(plan.keepId);
  for (const number of plan.addPhones) await keep.addPhone({ label: 'other', number });
  for (const address of plan.addEmails) await keep.addEmail({ label: 'other', address });
  let removed = 0;
  for (const id of plan.removeIds) {
    try {
      await new Contact(id).delete();
      removed++;
    } catch {}
  }
  return removed;
}
