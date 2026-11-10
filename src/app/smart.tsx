import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CountUp } from '../components/CountUp';
import { Ring } from '../components/Ring';
import { TopBar } from '../components/TopBar';
import { formatBytes } from '../lib/format';
import { Kind, KINDS } from '../lib/kinds';
import { dupExtraCount, dupExtras, dupReclaimable, Item, sum } from '../lib/scanner';
import { CleanPlan, useStore } from '../lib/store';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, radius, shadow } from '../theme';

type Row = { kind: Kind; items: Item[]; count: number; bytes: number; hint: string; on: boolean };

/** One-tap cleaning: safe categories start ticked, anything a person might want to look at first starts off. */
export default function Smart() {
  const insets = useSafeAreaInsets();
  const { result, tempSize, clean } = useStore();
  const { requireUnlock } = useUnlock();

  const rows = useMemo<Row[]>(() => {
    if (!result) return [];
    const out: Row[] = [
      { kind: 'duplicates', items: result.duplicates.flatMap(dupExtras), count: dupExtraCount(result.duplicates), bytes: dupReclaimable(result.duplicates), hint: 'The best copy of each set is always kept', on: true },
      { kind: 'screenshots', items: result.screenshots, count: result.screenshots.length, bytes: sum(result.screenshots), hint: 'Review them first if you keep receipts or tickets', on: false },
      { kind: 'videos', items: result.largeVideos, count: result.largeVideos.length, bytes: sum(result.largeVideos), hint: 'Videos over 100 MB', on: false },
    ];
    if (Platform.OS === 'ios') out.push({ kind: 'live', items: result.livePhotos, count: result.livePhotos.length, bytes: sum(result.livePhotos), hint: 'Removes the photo and its motion clip', on: false });
    out.push({ kind: 'temp', items: [], count: tempSize > 0 ? 1 : 0, bytes: tempSize, hint: 'Klenzer’s own temporary files', on: true });
    return out.filter((r) => r.count > 0);
  }, [result, tempSize]);

  const [off, setOff] = useState<Set<Kind>>(new Set());
  const [on, setOn] = useState<Set<Kind>>(new Set());
  const isOn = (r: Row) => (r.on ? !off.has(r.kind) : on.has(r.kind));
  const toggle = (r: Row) => {
    Haptics.selectionAsync().catch(() => {});
    const set = r.on ? off : on;
    const n = new Set(set);
    if (n.has(r.kind)) n.delete(r.kind);
    else n.add(r.kind);
    (r.on ? setOff : setOn)(n);
  };

  const picked = rows.filter(isOn);
  const bytes = picked.reduce((n, r) => n + r.bytes, 0);
  const all = rows.reduce((n, r) => n + r.bytes, 0);
  const plan: CleanPlan = picked.map((r) => ({ kind: r.kind, items: r.items }));

  const go = () =>
    requireUnlock(() => {
      router.replace('/cleaning');
      clean(plan);
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Smart Clean" />
      {!result || rows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle" size={72} color={colors.mint} />
          <Text style={styles.emptyTitle}>{result ? 'Nothing to clean' : 'Scan first'}</Text>
          <Text style={styles.emptySub}>{result ? 'Your library is already tidy.' : 'Run a scan from the home screen, then come back here.'}</Text>
          <Button variant="light" label="Back" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 140, gap: 12 }}>
            <View style={[styles.card, { alignItems: 'center', gap: 14, paddingVertical: 24 }]}>
              <Ring size={170} stroke={15} progress={all ? bytes / all : 0}>
                <CountUp value={bytes} format={(n) => formatBytes(n)} style={styles.big} />
                <Text style={styles.sub}>selected</Text>
              </Ring>
              <Text style={styles.note}>Tick what to clear. Anything you leave off stays exactly as it is.</Text>
            </View>
            {rows.map((r) => {
              const k = KINDS[r.kind];
              const checked = isOn(r);
              return (
                <Pressable key={r.kind} onPress={() => toggle(r)} accessibilityRole="checkbox" accessibilityState={{ checked }} style={[styles.card, styles.row, checked && { borderColor: colors.blue }]}>
                  <View style={[styles.icon, { backgroundColor: k.soft }]}>
                    <Ionicons name={k.icon as never} size={22} color={k.tone} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{k.title}</Text>
                    <Text style={styles.rowHint}>{r.hint}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.rowBytes}>{r.bytes > 0 ? formatBytes(r.bytes) : `${r.count}`}</Text>
                    <View style={[styles.check, checked && { backgroundColor: colors.blue, borderColor: colors.blue }]}>{checked && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
            <Button disabled={!picked.length} icon={<Ionicons name="sparkles" size={20} color="#fff" />} label={picked.length ? `Fix now · ${formatBytes(bytes)}` : 'Choose what to clean'} onPress={go} />
            <Text style={styles.barNote}>{Platform.OS === 'ios' ? 'Your iPhone asks you to confirm. Photos go to Recently Deleted first.' : 'Android asks you to confirm before anything is deleted.'}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 15, color: colors.ink2, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1.5, borderColor: 'transparent', ...shadow },
  big: { fontFamily: fonts.display, fontSize: 32, color: colors.ink, letterSpacing: -1 },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink3 },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.semi, fontSize: 16, color: colors.ink },
  rowHint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 2, lineHeight: 17 },
  rowBytes: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: 'rgba(246,248,252,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 8 },
  barNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center' },
});
