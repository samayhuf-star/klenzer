import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Gate } from '../components/Gate';
import { TopBar } from '../components/TopBar';
import { deleteEvents, EventItem, eventsAccess, loadPastEvents, requestEvents } from '../lib/events';
import { formatDate } from '../lib/format';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, radius, shadow } from '../theme';

type Phase = 'checking' | 'ask' | 'denied' | 'loading' | 'ready' | 'working';
const RANGES = [
  { label: '1 month+', days: 30 },
  { label: '6 months+', days: 182 },
  { label: '1 year+', days: 365 },
] as const;

export default function Events() {
  const insets = useSafeAreaInsets();
  const { requireUnlock } = useUnlock();
  const [phase, setPhase] = useState<Phase>('checking');
  const [canAsk, setCanAsk] = useState(true);
  const [range, setRange] = useState(1);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [prog, setProg] = useState({ done: 0, total: 0 });

  const load = useCallback(async (days: number) => {
    setPhase('loading');
    try {
      const r = await loadPastEvents(days);
      setEvents(r.events);
      setSkipped(r.skippedRepeating);
      setSel(new Set());
      setPhase('ready');
    } catch {
      setPhase('denied');
    }
  }, []);

  useEffect(() => {
    eventsAccess()
      .then(({ access, canAskAgain }) => {
        setCanAsk(canAskAgain);
        if (access === 'granted') load(RANGES[1].days);
        else setPhase(access === 'denied' && !canAskAgain ? 'denied' : 'ask');
      })
      .catch(() => setPhase('ask'));
  }, [load]);

  const ask = async () => {
    const { access, canAskAgain } = await requestEvents();
    setCanAsk(canAskAgain);
    if (access === 'granted') load(RANGES[range].days);
    else setPhase('denied');
  };

  const chosen = useMemo(() => events.filter((e) => sel.has(e.id)), [events, sel]);
  const all = events.length > 0 && chosen.length === events.length;

  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const run = () =>
    Alert.alert(`Delete ${chosen.length} event${chosen.length === 1 ? '' : 's'}?`, 'Deleted events are removed from every device synced to that calendar and can’t be restored by Klenzer.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPhase('working');
          setProg({ done: 0, total: chosen.length });
          const n = await deleteEvents(chosen, (done, total) => setProg({ done, total }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          await load(RANGES[range].days);
          Alert.alert(`${n} event${n === 1 ? '' : 's'} deleted`);
        },
      },
    ]);

  const body = () => {
    if (phase === 'checking') return null;
    if (phase === 'ask')
      return <Gate icon="calendar" title="Clear old calendar events" body="Klenzer lists events that finished a while ago so you can delete the ones you no longer need. Your calendar is read on this device only." label="Allow calendar access" onPress={ask} />;
    if (phase === 'denied')
      return <Gate icon="lock-closed" title="Calendar access is off" body="Turn on Calendars (full access) for Klenzer in Settings to see past events." label={canAsk ? 'Allow calendar access' : 'Open Settings'} onPress={canAsk ? ask : () => Linking.openSettings()} />;
    if (phase === 'loading' || phase === 'working')
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.centerTitle}>{phase === 'loading' ? 'Reading your calendar…' : 'Deleting events…'}</Text>
          {phase === 'working' && <Text style={styles.centerSub}>{prog.done} of {prog.total}</Text>}
        </View>
      );
    return (
      <>
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 170 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ gap: 12, paddingBottom: 14 }}>
              <View style={styles.chips}>
                {RANGES.map((r, i) => (
                  <Pressable key={r.label} onPress={() => { setRange(i); load(r.days); }} style={[styles.chip, range === i && styles.chipOn]}>
                    <Text style={[styles.chipText, range === i && { color: '#fff' }]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.help}>
                Events that ended {RANGES[range].label.replace('+', '')} ago or more. {skipped > 0 ? `${skipped} repeating event${skipped === 1 ? ' is' : 's are'} left alone, because deleting one would remove the whole series. ` : ''}Nothing is selected by default.
              </Text>
              {events.length > 0 && (
                <Pressable onPress={() => setSel(all ? new Set() : new Set(events.map((e) => e.id)))} style={styles.selAll}>
                  <Text style={styles.selAllText}>{all ? 'Deselect all' : `Select all ${events.length.toLocaleString()}`}</Text>
                </Pressable>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.center, { paddingTop: 60 }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.mint} />
              <Text style={styles.centerTitle}>Nothing old to clear</Text>
            </View>
          }
          renderItem={({ item: e }) => {
            const on = sel.has(e.id);
            return (
              <Pressable onPress={() => toggle(e.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.row, on && styles.rowOn]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{e.title}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{formatDate(e.start)} · {e.calendar}</Text>
                </View>
                <View style={[styles.check, on && { backgroundColor: colors.blue, borderColor: colors.blue }]}>{on && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
              </Pressable>
            );
          }}
        />
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            variant="danger"
            disabled={!chosen.length}
            icon={<Ionicons name="trash" size={19} color="#fff" />}
            label={chosen.length ? `Delete ${chosen.length.toLocaleString()} event${chosen.length === 1 ? '' : 's'}` : 'Select events to delete'}
            onPress={() => requireUnlock(run)}
          />
          <Text style={styles.barNote}>Deleted events can’t be restored.</Text>
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Calendar events" />
      {body()}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 30 },
  centerTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'center' },
  centerSub: { fontFamily: fonts.body, fontSize: 14, color: colors.ink3, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.blueSoft },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontFamily: fonts.semi, fontSize: 14, color: colors.blue },
  help: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  selAll: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.blueSoft },
  selAllText: { fontFamily: fonts.semi, fontSize: 14, color: colors.blue },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: 'transparent', ...shadow },
  rowOn: { borderColor: colors.blue },
  title: { fontFamily: fonts.semi, fontSize: 15.5, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: 'rgba(246,248,252,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 8 },
  barNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center' },
});
