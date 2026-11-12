import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { FreeLeftNote } from '../components/FreeLeftNote';
import { PressableScale } from '../components/PressableScale';
import { ScreenHeader } from '../components/ScreenHeader';
import { applyMerge, contactsAccess, loadContacts, type ContactsAccess } from '../lib/contacts';
import { findDuplicateGroups, mergeItemCount, planMerge, type ContactRecord, type DuplicateContactGroup } from '../lib/contacts-logic';
import { DEMO, demoContacts } from '../lib/demo';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

const REASON: Record<'name' | 'phone' | 'email', string> = { name: 'Same name', phone: 'Same number', email: 'Same email' };

export default function MergeContacts() {
  const insets = useSafeAreaInsets();
  const { runGated } = useStore();
  const [access, setAccess] = useState<ContactsAccess | null>(DEMO ? 'granted' : null);
  const [canAsk, setCanAsk] = useState(true);
  const [contacts, setContacts] = useState<ContactRecord[] | null>(DEMO ? demoContacts() : null);
  const [error, setError] = useState<string | null>(null);
  /** Contacts the user left out of a group, keyed by group key. */
  const [excluded, setExcluded] = useState<Record<string, string[]>>({});
  const [preview, setPreview] = useState<DuplicateContactGroup | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (ask: boolean) => {
    if (DEMO) return;
    try {
      const a = await contactsAccess(ask);
      setAccess(a.access);
      setCanAsk(a.canAskAgain);
      if (a.access === 'granted' || a.access === 'limited') {
        setContacts(await loadContacts());
        setError(null);
      }
    } catch {
      setError('Contacts could not be read just now. Please try again.');
    }
  }, []);

  useEffect(() => {
    // Reads permission and contacts from the OS; state is set after those async calls resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(false);
  }, [refresh]);

  const groups = useMemo(() => (contacts ? findDuplicateGroups(contacts) : []), [contacts]);
  const members = (g: DuplicateContactGroup) => g.contacts.filter((c) => !(excluded[g.key] ?? []).includes(c.id));
  const plans = useMemo(
    () => groups.map((g) => ({ g, m: g.contacts.filter((c) => !(excluded[g.key] ?? []).includes(c.id)) })).filter((x) => x.m.length > 1).map((x) => planMerge(x.m)),
    [groups, excluded],
  );
  const removable = mergeItemCount(plans);

  const toggleMember = (g: DuplicateContactGroup, id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setExcluded((ex) => {
      const cur = new Set(ex[g.key] ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...ex, [g.key]: [...cur] };
    });
  };

  /** Merging is a Pro action. Each contact removed counts as one free item. */
  const merge = (targets: DuplicateContactGroup[]) => {
    const work = targets.map((g) => planMerge(members(g))).flatMap((p) => p.removeIds.map((rid) => ({ plan: p, rid })));
    if (!work.length) return;
    const groupsCount = new Set(work.map((w) => w.plan.keepId)).size;
    Alert.alert(
      groupsCount === 1 ? 'Merge these contacts?' : `Merge ${groupsCount} groups?`,
      `${work.length === 1 ? '1 duplicate contact' : `${work.length} duplicate contacts`} will be removed after their numbers and emails are copied onto the contact that stays. This cannot be undone in Klenzer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          style: 'destructive',
          onPress: () =>
            runGated(
              'merge',
              work,
              async (allowed) => {
                // Allowed items are counted per removed contact. Rebuild each group's plan from the removals that fit.
                const byKeep = new Map<string, { plan: (typeof work)[number]['plan']; rids: string[] }>();
                for (const w of allowed) {
                  const cur = byKeep.get(w.plan.keepId) ?? { plan: w.plan, rids: [] };
                  cur.rids.push(w.rid);
                  byKeep.set(w.plan.keepId, cur);
                }
                setBusy(true);
                let removed = 0;
                try {
                  for (const { plan, rids } of byKeep.values()) {
                    if (DEMO) {
                      removed += rids.length;
                      continue;
                    }
                    removed += await applyMerge({ ...plan, removeIds: rids });
                  }
                } finally {
                  setBusy(false);
                  setPreview(null);
                }
                if (DEMO) {
                  const gone = new Set(allowed.map((w) => w.rid));
                  setContacts((cs) => (cs ?? []).filter((c) => !gone.has(c.id)));
                } else {
                  await refresh(false);
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                return removed;
              },
              'merge',
            ),
        },
      ],
    );
  };

  if (access === null) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Merge Contacts" />
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.blue} />
      </View>
    );
  }

  if (access === 'denied' || access === 'undetermined') {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Merge Contacts" />
        <View style={styles.empty}>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={30} color={colors.violet} />
          </View>
          <Text style={styles.emptyTitle}>Find duplicate contacts</Text>
          <Text style={styles.emptyBody}>Klenzer looks for contacts with the same name, number or email and merges them on your phone. Contacts never leave your phone.</Text>
          <Button
            label={access === 'denied' && !canAsk ? 'Open Settings' : 'Allow contacts access'}
            onPress={() => (access === 'denied' && !canAsk ? Linking.openSettings() : void refresh(true))}
            testID="contacts-allow"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="contacts-screen">
      <ScreenHeader title="Merge Contacts" />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {contacts === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.blue} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          contentContainerStyle={{ padding: 20, paddingBottom: 170, gap: 12 }}
          ListHeaderComponent={
            <Text style={styles.help}>
              {groups.length
                ? `${groups.length === 1 ? '1 group' : `${groups.length} groups`} of possible duplicates in ${contacts.length.toLocaleString()} contacts. Tap a group to preview the merge.`
                : `No duplicates found in ${contacts.length.toLocaleString()} contacts.`}
            </Text>
          }
          renderItem={({ item: g }) => {
            const m = members(g);
            const plan = m.length > 1 ? planMerge(m) : null;
            return (
              <PressableScale onPress={() => setPreview(g)} style={styles.group} accessibilityLabel={`Group of ${g.contacts.length} contacts, ${plan?.name ?? ''}`}>
                <View style={styles.groupTop}>
                  <Text style={styles.groupName} numberOfLines={1}>{plan?.name || 'No name'}</Text>
                  <Text style={styles.groupCount}>{g.contacts.length}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
                </View>
                <Text style={styles.groupWhy}>{g.reasons.map((r) => REASON[r]).join(' · ')}</Text>
              </PressableScale>
            );
          }}
        />
      )}

      {groups.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button label={removable ? `Merge all · ${removable} ${removable === 1 ? 'duplicate' : 'duplicates'}` : 'Nothing selected to merge'} disabled={!removable || busy} busy={busy} onPress={() => merge(groups)} testID="contacts-merge-all" />
          <FreeLeftNote />
        </View>
      )}

      <Modal visible={!!preview} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPreview(null)}>
        {preview && (
          <MergePreview
            group={preview}
            excluded={excluded[preview.key] ?? []}
            onToggle={(id) => toggleMember(preview, id)}
            onClose={() => setPreview(null)}
            onMerge={() => merge([preview])}
            busy={busy}
          />
        )}
      </Modal>
    </View>
  );
}

function MergePreview({ group, excluded, onToggle, onClose, onMerge, busy }: { group: DuplicateContactGroup; excluded: string[]; onToggle: (id: string) => void; onClose: () => void; onMerge: () => void; busy: boolean }) {
  const insets = useSafeAreaInsets();
  const m = group.contacts.filter((c) => !excluded.includes(c.id));
  const plan = m.length > 1 ? planMerge(m) : null;
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 12 }]} testID="contacts-preview">
      <View style={styles.sheetTop}>
        <Text style={styles.sheetTitle}>Merge preview</Text>
        <PressableScale onPress={onClose} accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={styles.label}>Contacts in this group</Text>
        {group.contacts.map((c) => {
          const on = !excluded.includes(c.id);
          return (
            <PressableScale key={c.id} onPress={() => onToggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.member, !on && { opacity: 0.5 }]}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.blue : colors.ink3} />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{c.name || 'No name'}{plan?.keepId === c.id ? '  · stays' : ''}</Text>
                <Text style={styles.memberSub} numberOfLines={2}>{[...c.phones, ...c.emails].join(' · ') || 'No details'}</Text>
              </View>
            </PressableScale>
          );
        })}

        <Text style={[styles.label, { marginTop: 8 }]}>After merging</Text>
        {plan ? (
          <View style={styles.result}>
            <Text style={styles.resultName}>{plan.name || 'No name'}</Text>
            {plan.phones.map((p) => (
              <View key={p} style={styles.line}>
                <Ionicons name="call-outline" size={16} color={colors.ink2} />
                <Text style={styles.lineText}>{p}</Text>
              </View>
            ))}
            {plan.emails.map((e) => (
              <View key={e} style={styles.line}>
                <Ionicons name="mail-outline" size={16} color={colors.ink2} />
                <Text style={styles.lineText}>{e}</Text>
              </View>
            ))}
            <Text style={styles.resultNote}>
              {plan.removeIds.length === 1 ? '1 duplicate is removed.' : `${plan.removeIds.length} duplicates are removed.`} Other details on the removed contacts, such as addresses or notes, are not copied.
            </Text>
          </View>
        ) : (
          <Text style={styles.memberSub}>Select at least two contacts to merge.</Text>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        <Button label="Merge" disabled={!plan || busy} busy={busy} onPress={onMerge} testID="contacts-merge" />
        <FreeLeftNote />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  help: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2, marginBottom: 4 },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger, paddingHorizontal: 20 },
  group: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 6, ...shadow },
  groupTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  groupCount: { fontFamily: fonts.bold, fontSize: 13, color: colors.violet, backgroundColor: colors.violetSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' },
  groupWhy: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, gap: 8, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2, textAlign: 'center' },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink3, letterSpacing: 0.3 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 14 },
  memberName: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
  memberSub: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 },
  result: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 8, borderWidth: 2, borderColor: colors.blue },
  resultName: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  resultNote: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3, marginTop: 4 },
});
