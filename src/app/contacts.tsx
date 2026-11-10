import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Gate } from '../components/Gate';
import { TopBar } from '../components/TopBar';
import { backupContacts, ContactGroup, contactsAccess, extraCount, findDuplicateContacts, loadContacts, mergeGroups, requestContacts } from '../lib/contacts';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, radius, shadow } from '../theme';

type Phase = 'checking' | 'ask' | 'denied' | 'loading' | 'ready' | 'working' | 'empty';

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const { requireUnlock } = useUnlock();
  const [phase, setPhase] = useState<Phase>('checking');
  const [canAsk, setCanAsk] = useState(true);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [prog, setProg] = useState({ done: 0, total: 0 });

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const all = await loadContacts();
      const g = findDuplicateContacts(all);
      setTotal(all.length);
      setGroups(g);
      setSel(new Set(g.filter((x) => x.match === 'strong').map((x) => x.key)));
      setPhase(g.length ? 'ready' : 'empty');
    } catch {
      setPhase('denied');
    }
  }, []);

  useEffect(() => {
    contactsAccess()
      .then(({ access, canAskAgain }) => {
        setCanAsk(canAskAgain);
        if (access === 'granted' || access === 'limited') load();
        else setPhase(access === 'denied' && !canAskAgain ? 'denied' : 'ask');
      })
      .catch(() => setPhase('ask'));
  }, [load]);

  const ask = async () => {
    const { access, canAskAgain } = await requestContacts();
    setCanAsk(canAskAgain);
    if (access === 'granted' || access === 'limited') load();
    else setPhase('denied');
  };

  const chosen = useMemo(() => groups.filter((g) => sel.has(g.key)), [groups, sel]);
  const removing = extraCount(chosen);

  const toggle = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSel((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const run = () => {
    setPhase('working');
    setProg({ done: 0, total: chosen.length });
    (async () => {
      let backup: string | null = null;
      try {
        backup = await backupContacts(chosen.flatMap((g) => g.items.map((i) => i.id)));
      } catch {}
      if (!backup) {
        // Never change anyone's address book without a safety copy.
        setPhase('ready');
        Alert.alert('Couldn’t make a backup', 'Nothing was changed. Try again in a moment.');
        return;
      }
      const removed = await mergeGroups(chosen, (done, t) => setProg({ done, total: t }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await load();
      Alert.alert(`${removed} duplicate${removed === 1 ? '' : 's'} merged`, 'A backup of the affected contacts is saved inside Klenzer. Save a copy to Files or iCloud Drive to keep it somewhere safe.', [
        { text: 'Done', style: 'cancel' },
        { text: 'Save a copy', onPress: () => Sharing.shareAsync(backup!, { mimeType: 'text/vcard', UTI: 'public.vcard' }).catch(() => {}) },
      ]);
    })();
  };

  const body = () => {
    if (phase === 'checking') return null;
    if (phase === 'ask')
      return <Gate icon="people" title="Tidy your contacts" body="Klenzer looks for contact cards that share a phone number or email and merges them into one. Your contacts are read on this device only, and a backup is saved before anything changes." label="Allow contacts access" onPress={ask} />;
    if (phase === 'denied')
      return <Gate icon="lock-closed" title="Contacts access is off" body="Turn on Contacts for Klenzer in Settings to find duplicates." label={canAsk ? 'Allow contacts access' : 'Open Settings'} onPress={canAsk ? ask : () => Linking.openSettings()} />;
    if (phase === 'loading' || phase === 'working')
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.centerTitle}>{phase === 'loading' ? 'Reading your contacts…' : 'Backing up and merging…'}</Text>
          {phase === 'working' && <Text style={styles.centerSub}>{prog.done} of {prog.total} sets</Text>}
        </View>
      );
    if (phase === 'empty')
      return (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={72} color={colors.mint} />
          <Text style={styles.centerTitle}>No duplicates found</Text>
          <Text style={styles.centerSub}>Checked {total.toLocaleString()} contacts.</Text>
        </View>
      );
    return (
      <>
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 170 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <Text style={styles.help}>
              {total.toLocaleString()} contacts checked. Each set keeps its fullest card and adds any extra numbers or emails from the others. Sets that only share a name are left unticked for you to check.
            </Text>
          }
          renderItem={({ item: g }) => {
            const on = sel.has(g.key);
            return (
              <Pressable onPress={() => toggle(g.key)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.card, on && styles.cardOn]}>
                <View style={styles.cardHead}>
                  <Text style={styles.tag}>{g.match === 'strong' ? 'Same number or email' : 'Same name only'} · {g.items.length} cards</Text>
                  <View style={[styles.check, on && { backgroundColor: colors.blue, borderColor: colors.blue }]}>{on && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                </View>
                {g.items.map((c, k) => (
                  <View key={c.id} style={styles.person}>
                    <View style={[styles.avatar, { backgroundColor: k === 0 ? colors.mintSoft : colors.line }]}>
                      <Ionicons name={k === 0 ? 'person' : 'person-outline'} size={18} color={k === 0 ? '#0BAE86' : colors.ink3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pName} numberOfLines={1}>{c.name || c.phones[0] || c.emails[0] || 'No name'}</Text>
                      <Text style={styles.pSub} numberOfLines={1}>{[...c.phones, ...c.emails].join(' · ') || 'No number or email'}</Text>
                    </View>
                    {k === 0 && <Text style={styles.keep}>Keep</Text>}
                  </View>
                ))}
              </Pressable>
            );
          }}
        />
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            disabled={!chosen.length}
            icon={<Ionicons name="git-merge" size={19} color="#fff" />}
            label={chosen.length ? `Merge ${removing} duplicate${removing === 1 ? '' : 's'}` : 'Select sets to merge'}
            onPress={() => requireUnlock(run)}
          />
          <Text style={styles.barNote}>A backup file is saved first. Merged cards are removed from your address book.</Text>
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Contacts" />
      {body()}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 30 },
  centerTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'center' },
  centerSub: { fontFamily: fonts.body, fontSize: 14, color: colors.ink3, textAlign: 'center' },
  help: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2, paddingBottom: 14 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 10, borderWidth: 1.5, borderColor: 'transparent', ...shadow },
  cardOn: { borderColor: colors.blue },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink3 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pName: { fontFamily: fonts.semi, fontSize: 15.5, color: colors.ink },
  pSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 1 },
  keep: { fontFamily: fonts.bold, fontSize: 11, color: colors.navy, backgroundColor: colors.mint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: 'rgba(246,248,252,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 8 },
  barNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center' },
});
