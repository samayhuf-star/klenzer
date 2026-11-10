import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CountUp } from '../components/CountUp';
import { PressableScale } from '../components/PressableScale';
import { FloatingNav } from '../components/FloatingNav';
import { ProPill, ProTag } from '../components/ProPill';
import { StorageBar } from '../components/StorageBar';
import { KINDS } from '../lib/kinds';
import { formatBytes } from '../lib/format';
import { dupExtraCount, dupReclaimable, sum } from '../lib/scanner';
import { useStore } from '../lib/store';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, radius, shadow } from '../theme';

type Tab = 'photos' | 'videos' | 'tools';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { disk, access, canAskAgain, requestAccess, openSettings, manageLimited, scanning, progress, result, scan, cancelScan, lifetimeFreed, lifetimeItems, refreshDisk, tempSize, clean, pending, dismissPending, openPhotos, reminders, setReminders } = useStore();
  const [nudgeHidden, setNudgeHidden] = useState(true);
  useEffect(() => { AsyncStorage.getItem('klenzer.nudge.v1').then((v) => setNudgeHidden(v === '1')).catch(() => {}); }, []);
  const hideNudge = () => { setNudgeHidden(true); AsyncStorage.setItem('klenzer.nudge.v1', '1').catch(() => {}); };
  const { requireUnlock } = useUnlock();
  const [tab, setTab] = useState<Tab>('photos');
  // Free space changes all the time (downloads, iCloud, the system), so keep it live while Home is on screen.
  useFocusEffect(
    useCallback(() => {
      refreshDisk();
      const t = setInterval(refreshDisk, 5000);
      return () => clearInterval(t);
    }, [refreshDisk]),
  );
  const usedPct = disk.total ? disk.used / disk.total : 0;
  const denied = access === 'denied';

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const phase = progress?.phase === 'measuring' ? 'Measuring file sizes' : 'Reading your library';

  const tiles = result
    ? {
        photos: [
          { kind: 'duplicates', label: 'Duplicates', icon: 'copy', tone: colors.blue, soft: colors.blueSoft, count: dupExtraCount(result.duplicates), bytes: dupReclaimable(result.duplicates) },
          { kind: 'screenshots', label: 'Screenshots', icon: 'phone-portrait', tone: colors.violet, soft: colors.violetSoft, count: result.screenshots.length, bytes: sum(result.screenshots) },
          ...(Platform.OS === 'ios' ? [{ kind: 'live', label: KINDS.live.title, icon: KINDS.live.icon, tone: KINDS.live.tone, soft: KINDS.live.soft, count: result.livePhotos.length, bytes: sum(result.livePhotos) }] : []),
          { kind: 'temp', label: KINDS.temp.title, icon: KINDS.temp.icon, tone: KINDS.temp.tone, soft: KINDS.temp.soft, count: tempSize > 0 ? 1 : 0, bytes: tempSize },
        ],
        videos: [{ kind: 'videos', label: 'Large videos', icon: 'videocam', tone: colors.amber, soft: colors.amberSoft, count: result.largeVideos.length, bytes: sum(result.largeVideos) }],
      }
    : null;
  const placeholders = (n: number) => Array.from({ length: n }, (_, i) => i);
  const openTile = (kind: string) =>
    kind === 'temp'
      ? requireUnlock(() => {
          router.push('/cleaning');
          clean([{ kind: 'temp', items: [] }]);
        })
      : router.push({ pathname: '/review/[kind]', params: { kind } });
  const heroAction = () => (result ? router.push('/smart') : scan());

  const tabs: { id: Tab; label: string }[] = [{ id: 'photos', label: 'Photos' }, { id: 'videos', label: 'Videos' }, { id: 'tools', label: 'Tools' }];
  const list = tab === 'photos' ? tiles?.photos : tab === 'videos' ? tiles?.videos : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={styles.gear}>
            <Ionicons name="settings-outline" size={21} color={colors.ink} />
          </PressableScale>
          <Text style={styles.title}>Klenzer</Text>
          <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
            <ProPill />
          </View>
        </View>

        <View style={styles.status}>
          <Ionicons name={scanning ? 'search' : 'checkmark-circle'} size={17} color={scanning ? colors.ink3 : '#0BAE86'} />
          <Text style={styles.statusText}>{scanning ? `${phase}… ${pct}%` : result ? 'Scan complete. Review what we found.' : 'Ready to scan. Nothing leaves your device.'}</Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${scanning ? Math.max(4, pct) : result ? 100 : 0}%` }]} />
        </View>

        <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.eyebrow}>Storage</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4, marginBottom: 12 }}>
            <CountUp value={disk.used} format={(n) => formatBytes(n)} style={styles.big} />
            <Text style={styles.of}> of {formatBytes(disk.total, 0)}</Text>
          </View>
          <StorageBar progress={usedPct} />
          <Button
            label={scanning ? 'Scanning…' : result ? 'Smart Clean' : 'Scan my library'}
            icon={<Ionicons name="sparkles" size={19} color="#fff" />}
            onPress={heroAction}
            disabled={scanning}
            style={{ marginTop: 18 }}
          />
          {scanning && <Button variant="ghost" label="Cancel" onPress={cancelScan} style={{ marginTop: 10 }} />}
        </Animated.View>

        {denied && (
          <Notice icon="lock-closed" tone="amber" title="Photo access is off" body="Klenzer needs to read your photo library to find clutter. Photos never leave your device.">
            <Button variant="light" label={canAskAgain ? 'Allow access' : 'Open Settings'} onPress={canAskAgain ? requestAccess : openSettings} />
          </Notice>
        )}
        {access === 'limited' && (
          <Notice icon="images" tone="blue" title="Limited photo access" body="Klenzer can only see the photos you selected, so results may be incomplete.">
            <Button variant="light" label="Choose more photos" onPress={manageLimited} />
          </Notice>
        )}
        {pending && Platform.OS === 'ios' && (
          <Notice icon="trash-bin" tone="amber" title={`${formatBytes(pending.bytes)} still in Recently Deleted`} body="iPhone only frees this space once Recently Deleted is emptied, and apps can’t do that for you. Tap below, unlock with Face ID, then Select › Delete All.">
            <Button variant="light" label="Open Recently Deleted" onPress={openPhotos} />
            <Button variant="ghost" label="I’ve emptied it" onPress={dismissPending} />
          </Notice>
        )}

        <View style={styles.seg}>
          {tabs.map((t) => (
            <PressableScale key={t.id} onPress={() => setTab(t.id)} accessibilityLabel={t.label} style={[styles.segItem, tab === t.id && styles.segOn]}>
              <Text style={[styles.segText, tab === t.id && { color: colors.ink, fontFamily: fonts.bold }]}>{t.label}</Text>
            </PressableScale>
          ))}
        </View>

        {tab !== 'tools' ? (
          <View key={tab} style={styles.grid}>
            {(list ?? placeholders(tab === 'photos' ? 4 : 1)).map((t, i) => {
              const it = typeof t === 'number' ? null : t;
              return (
                <Animated.View key={it ? it.kind : String(t)} entering={FadeInDown.delay(80 * i).springify().damping(16)} style={styles.tileWrap}>
                  <Tile
                    label={it?.label ?? '…'}
                    icon={it?.icon ?? 'ellipse'}
                    tone={it?.tone ?? colors.ink3}
                    soft={it?.soft ?? colors.line}
                    bytes={it?.bytes ?? 0}
                    count={it?.count ?? 0}
                    busy={scanning}
                    ready={!!it}
                    onPress={() => it && openTile(it.kind)}
                  />
                </Animated.View>
              );
            })}
            {tab === 'videos' && !result && !scanning && <Text style={styles.foot}>Scan to find videos over 100 MB.</Text>}
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 14 }}>
            <Tool icon="people" tone={colors.blue} soft={colors.blueSoft} title="Contacts" hint="Merge duplicate contacts, with a backup first" route="/contacts" delay={0} />
            <Tool icon="calendar" tone={colors.violet} soft={colors.violetSoft} title="Calendar events" hint="Clear events that ended long ago" route="/events" delay={80} />
            <Tool icon="key" tone={colors.amber} soft={colors.amberSoft} title="Secret Space" hint="Hide private photos and videos behind Face ID" route="/vault" delay={160} />
          </View>
        )}

        {result && !scanning && tab !== 'tools' && (
          <Text style={styles.foot}>
            Scanned {result.photoCount.toLocaleString()} photos and {result.videoCount.toLocaleString()} videos. Photos stored only in iCloud aren’t measured.
          </Text>
        )}
        {result && !scanning && tab === 'photos' && <Button variant="light" label="Scan again" onPress={scan} style={{ marginTop: 14 }} />}

        {!reminders && !nudgeHidden && (
          <View style={[styles.card, { gap: 10, marginTop: 18 }]}>
            <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: colors.ink2 }}>Get a reminder every 3 days showing how full your storage is. Turn it off any time in Settings.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button variant="ghost" label="Not now" onPress={hideNudge} style={{ flex: 1 }} />
              <Button label="Remind me" onPress={async () => { await setReminders(true); hideNudge(); }} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {(lifetimeFreed > 0 || lifetimeItems > 0) && (
          <View style={styles.lifetime}>
            <Ionicons name="leaf" size={18} color={colors.mint} />
            <Text style={styles.lifetimeText}>
              You’ve freed <CountUp value={lifetimeFreed} format={(n) => formatBytes(n)} style={styles.lifetimeStrong} />
              {lifetimeItems > 0 ? ` · ${lifetimeItems.toLocaleString()} ${lifetimeItems === 1 ? 'item' : 'items'} removed` : ''}
            </Text>
          </View>
        )}
      </ScrollView>
      <FloatingNav tab={tab === 'tools' ? 'tools' : 'clean'} onTab={(t) => setTab(t === 'tools' ? 'tools' : 'photos')} />
    </View>
  );
}

function Tile(p: { label: string; icon: string; tone: string; soft: string; bytes: number; count: number; busy: boolean; ready: boolean; onPress: () => void }) {
  const empty = p.ready && !p.busy && p.count === 0;
  return (
    <PressableScale onPress={p.onPress} disabled={!p.ready || p.busy || empty} accessibilityLabel={`${p.label}, ${p.count} items`} style={styles.tile}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.tileLabel} numberOfLines={1}>{p.label}</Text>
        {p.ready && !empty && <Ionicons name="chevron-forward" size={14} color={colors.ink3} />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
        <View>
          {p.busy ? <ActivityIndicator color={colors.blue} style={{ alignSelf: 'flex-start' }} /> : (
            <Text style={styles.tileBytes}>{!p.ready ? '—' : empty ? 'Clear' : p.bytes > 0 ? formatBytes(p.bytes) : `${p.count}`}</Text>
          )}
          {p.ready && !p.busy && !empty && p.count > 0 && <Text style={styles.tileCount}>{p.label === 'Temporary files' ? 'tap to clear' : `${p.count.toLocaleString()} items`}</Text>}
        </View>
        <View style={[styles.tileIcon, { backgroundColor: empty ? colors.mintSoft : p.soft }]}>
          <Ionicons name={(empty ? 'checkmark' : p.icon) as never} size={22} color={empty ? '#0BAE86' : p.tone} />
        </View>
      </View>
    </PressableScale>
  );
}

function Tool(p: { icon: string; tone: string; soft: string; title: string; hint: string; route: '/contacts' | '/events' | '/vault'; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(p.delay).springify().damping(16)}>
    <PressableScale onPress={() => router.push(p.route)} accessibilityLabel={p.title} style={[styles.card, styles.cat, { borderLeftWidth: 4, borderLeftColor: p.tone }]}>
      <View style={[styles.catIcon, { backgroundColor: p.soft }]}>
        <Ionicons name={p.icon as never} size={24} color={p.tone} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.catTitle}>{p.title}</Text>
          <ProTag />
        </View>
        <Text style={styles.catHint}>{p.hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
    </PressableScale>
    </Animated.View>
  );
}

function Notice({ icon, tone, title, body, children }: { icon: string; tone: 'amber' | 'blue'; title: string; body: string; children: ReactNode }) {
  const bg = tone === 'amber' ? colors.amberSoft : colors.blueSoft;
  const fg = tone === 'amber' ? '#B26A00' : colors.blue;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Ionicons name={icon as never} size={20} color={fg} />
        <Text style={[styles.noticeTitle, { color: fg }]}>{title}</Text>
      </View>
      <Text style={styles.noticeBody}>{body}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.ink },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 8 },
  statusText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(43,69,245,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.blue },
  of: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink3 },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(11,16,32,0.06)', borderRadius: 14, padding: 3, marginTop: 18 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  segOn: { backgroundColor: '#fff', ...shadow },
  segText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  tileWrap: { width: '47.8%' },
  tile: { backgroundColor: colors.card, borderRadius: 20, padding: 14, minHeight: 104, ...shadow },
  tileLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2, flexShrink: 1 },
  tileBytes: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  tileCount: { fontFamily: fonts.body, fontSize: 11.5, color: colors.ink3, marginTop: 2 },
  tileIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, ...shadow },
  hero: { alignItems: 'center', gap: 18, paddingVertical: 24 },
  eyebrow: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink2 },
  big: { fontFamily: fonts.bold, fontSize: 32, color: colors.ink, letterSpacing: -1 },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink3, marginTop: 2 },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2, textAlign: 'center' },
  notice: { borderRadius: radius.md, padding: 16, gap: 10, marginTop: 16 },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 16 },
  noticeBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, marginBottom: 14 },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: colors.blue },
  section: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  catIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catTitle: { fontFamily: fonts.semi, fontSize: 16.5, color: colors.ink },
  catHint: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2, lineHeight: 18 },
  catBytes: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  catCount: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  foot: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3, textAlign: 'center', marginTop: 4 },
  lifetime: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 26 },
  lifetimeText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2, textAlign: 'center', flexShrink: 1 },
  lifetimeStrong: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
