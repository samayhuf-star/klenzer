import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ScanProgress } from '../components/ScanProgress';
import { CountUp } from '../components/CountUp';
import { PressableScale } from '../components/PressableScale';
import { formatBytes, formatFreeAmount, formatMarketedTotal, SCAN_CLEANUP_LINE, scanLookingLine } from '../lib/format';
import { KINDS, Kind } from '../lib/kinds';
import { dupExtraCount, dupExtras, dupReclaimable, Item, sum } from '../lib/scanner';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

type Tab = 'clean' | 'compress';

export default function Home() {
  const insets = useSafeAreaInsets();
  const {
    disk, access, canAskAgain, requestAccess, openSettings, manageLimited,
    scanning, progress, scanCats, result, scan, startClean, refreshDisk, scanError,
  } = useStore();
  const [tab, setTab] = useState<Tab>('clean');
  const reduceMotion = useReducedMotion();
  const prevCats = useRef(scanCats);
  const wasScanning = useRef(scanning);

  useFocusEffect(
    useCallback(() => {
      refreshDisk();
      const t = setInterval(refreshDisk, 5000);
      return () => clearInterval(t);
    }, [refreshDisk]),
  );

  useEffect(() => {
    (['photos', 'screenshots', 'videos'] as const).forEach((key) => {
      if (prevCats.current[key].status !== 'done' && scanCats[key].status === 'done') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });
    if (wasScanning.current && !scanning && !scanError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    prevCats.current = scanCats;
    wasScanning.current = scanning;
  }, [scanCats, scanning, scanError]);

  const usedPct = disk.total ? Math.min(1, disk.used / disk.total) : 0;
  const pct = scanning
    ? Math.max(0, Math.min(100, progress?.percent ?? (progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 1)))
    : 0;
  const denied = access === 'denied';

  const smartClean = () => {
    if (denied || access === 'unknown') {
      if (canAskAgain) void requestAccess();
      else openSettings();
      return;
    }
    if (scanning) return;
    if (!result) {
      void scan();
      return;
    }
    const plan = [
      ...(result.duplicates.length ? [{ kind: 'duplicates' as const, items: result.duplicates.flatMap(dupExtras) }] : []),
      ...(result.similar.length ? [{ kind: 'similar' as const, items: result.similar.flatMap(dupExtras) }] : []),
    ];
    if (!plan.length) {
      Alert.alert('Nothing to clean yet', 'Open a category to review screenshots, videos or blurry photos, or scan again.');
      return;
    }
    startClean(plan);
  };

  const comingSoon = (label: string) => Alert.alert(label, 'Coming soon.');

  const photosSpin = scanning && scanCats.photos.status !== 'done';
  const shotsSpin = scanning && scanCats.screenshots.status !== 'done';
  const videoSpin = scanning && scanCats.videos.status !== 'done';
  const showLargeVideos = (result?.largeVideos.length ?? 0) > 0 || (videoSpin && (result?.largeVideos.length ?? 0) > 0);
  const showLive = (result?.livePhotos.length ?? 0) > 0 || (photosSpin && (result?.livePhotos.length ?? 0) > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="home-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={styles.iconBtn} testID="open-settings">
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </PressableScale>
          <Text style={styles.brand}>Klenzer</Text>
          <PressableScale onPress={() => router.push('/paywall')} accessibilityLabel="Klenzer Pro" style={styles.pro} testID="open-paywall">
            <Ionicons name="diamond" size={13} color={colors.gold} />
            <Text style={styles.proText}>PRO</Text>
          </PressableScale>
        </View>

        {scanning && (
          <ScanProgress
            percent={pct}
            line1={scanLookingLine(progress?.libraryTotal ?? progress?.total ?? 0, pct)}
            line2={SCAN_CLEANUP_LINE}
            reduceMotion={!!reduceMotion}
          />
        )}

        {!!scanError && !scanning && (
          <Notice title="Scan didn’t finish" body={scanError}>
            <Button variant="light" label="Try again" onPress={() => void scan()} />
          </Notice>
        )}

        {denied && (
          <Notice title="Photo access is off" body="Klenzer needs to read your photo library to find clutter. Photos never leave your device.">
            <Button variant="light" label={canAskAgain ? 'Allow access' : 'Open Settings'} onPress={canAskAgain ? requestAccess : openSettings} />
          </Notice>
        )}
        {access === 'limited' && (
          <Notice title="Limited photo access" body="Klenzer can only see the photos you selected, so results may be incomplete.">
            <Button variant="light" label="Choose more photos" onPress={manageLimited} />
          </Notice>
        )}

        {tab !== 'compress' && (
          <View style={[styles.card, styles.storage]}>
            <Text style={styles.storageLabel}>Storage</Text>
            <View style={styles.nums}>
              <Text style={styles.storageBig}>{formatFreeAmount(disk.free)}</Text>
              <Text style={styles.storageOf}>free of {formatMarketedTotal(disk.total)}</Text>
            </View>
            <View style={styles.gbar}>
              <LinearGradient
                colors={['#F6D365', '#FDA085', colors.blue]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${Math.max(2, usedPct * 100)}%`, height: '100%', borderRadius: 8 }}
              />
            </View>
            <PressableScale onPress={smartClean} accessibilityLabel="Smart Clean" style={styles.smart} testID="smart-clean">
              <Text style={styles.smartText}>Smart Clean</Text>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </PressableScale>
          </View>
        )}

                {tab === 'clean' && (
          <View style={[styles.grid, { marginTop: 14 }]} testID="home-grid">
            <CatCard
              kind="photos"
              title="Photos"
              count={result?.photos?.length ?? 0}
              bytes={result ? sum(result.photos ?? []) : 0}
              thumbs={result?.photos?.slice(0, 3) ?? []}
              spinning={photosSpin}
              reduceMotion={!!reduceMotion}
            />
            <CatCard
              kind="videoDuplicates"
              title="Videos"
              count={result ? dupExtraCount(result.duplicateVideos) : 0}
              bytes={result ? dupReclaimable(result.duplicateVideos) : 0}
              thumbs={result?.duplicateVideos.flatMap((g) => g.items).slice(0, 3) ?? []}
              spinning={videoSpin}
              reduceMotion={!!reduceMotion}
            />
            <CatCard
              kind="similar"
              title="Similar"
              count={result ? dupExtraCount(result.similar) : 0}
              bytes={result ? dupReclaimable(result.similar) : 0}
              thumbs={result?.similar.flatMap((g) => g.items).slice(0, 3) ?? []}
              spinning={photosSpin}
              reduceMotion={!!reduceMotion}
            />
            <CatCard
              kind="duplicates"
              title="Duplicates"
              count={result ? dupExtraCount(result.duplicates) : 0}
              bytes={result ? dupReclaimable(result.duplicates) : 0}
              thumbs={result?.duplicates.flatMap((g) => g.items).slice(0, 3) ?? []}
              spinning={photosSpin}
              reduceMotion={!!reduceMotion}
            />
            <CatCard
              kind="blurry"
              title="Blurry"
              count={result?.blurry.length ?? 0}
              bytes={result ? sum(result.blurry) : 0}
              thumbs={result?.blurry.slice(0, 3) ?? []}
              spinning={photosSpin}
              reduceMotion={!!reduceMotion}
            />
            <CatCard
              kind="screenshots"
              title="Screenshots"
              count={result?.screenshots.length ?? 0}
              bytes={result ? sum(result.screenshots) : 0}
              thumbs={result?.screenshots.slice(0, 3) ?? []}
              spinning={shotsSpin}
              reduceMotion={!!reduceMotion}
            />
            {showLargeVideos && (
              <CatCard
                kind="videos"
                title="Large videos"
                count={result?.largeVideos.length ?? 0}
                bytes={result ? sum(result.largeVideos) : 0}
                thumbs={result?.largeVideos.slice(0, 3) ?? []}
                spinning={videoSpin}
                reduceMotion={!!reduceMotion}
              />
            )}
            {showLive && (
              <CatCard
                kind="live"
                title="Live Photos"
                count={result?.livePhotos.length ?? 0}
                bytes={result ? sum(result.livePhotos) : 0}
                thumbs={result?.livePhotos.slice(0, 3) ?? []}
                spinning={photosSpin}
                reduceMotion={!!reduceMotion}
              />
            )}
            <ContactsCard reduceMotion={!!reduceMotion} onPress={() => comingSoon('Contacts')} />
          </View>
        )}

        {tab === 'compress' && (
          <PressableScale onPress={() => comingSoon('Compress')} style={[styles.card, styles.soonCard, { marginTop: 8 }]}>
            <View style={styles.compressIcon}>
              <Ionicons name="contract" size={18} color="#E85D9C" />
            </View>
            <Text style={styles.soonTitle}>Compress</Text>
            <Text style={styles.soonBody}>Want to save up extra space? Video compression is coming soon.</Text>
            <View style={styles.soonPill}><Text style={styles.soonPillText}>COMING SOON</Text></View>
          </PressableScale>
        )}
      </ScrollView>

      <View style={[styles.tabs, { bottom: Math.max(insets.bottom, 12) + 6 }]}>
        <PressableScale onPress={() => setTab('clean')} style={styles.tab} haptic={false}>
          <Ionicons name="sparkles" size={22} color={tab === 'clean' ? colors.blue : colors.ink3} />
          <Text style={[styles.tabLabel, tab === 'clean' && { color: colors.blue }]}>Clean</Text>
        </PressableScale>
        <PressableScale onPress={() => setTab('compress')} style={styles.tab} haptic={false}>
          <Ionicons name="archive-outline" size={22} color={tab === 'compress' ? colors.blue : colors.ink3} />
          <Text style={[styles.tabLabel, tab === 'compress' && { color: colors.blue }]}>Compress</Text>
        </PressableScale>
        <PressableScale onPress={() => router.push('/settings')} style={styles.tab} haptic={false}>
          <Ionicons name="settings-outline" size={22} color={colors.ink3} />
          <Text style={styles.tabLabel}>Settings</Text>
        </PressableScale>
      </View>
    </View>
  );
}


function CatCard({
  kind, title, count, bytes, thumbs, spinning, wide, reduceMotion,
}: {
  kind: Kind;
  title: string;
  count: number;
  bytes: number;
  thumbs: Item[];
  spinning: boolean;
  wide?: boolean;
  reduceMotion: boolean;
}) {
  const open = () => {
    if (!count) return;
    router.push({ pathname: '/review/[kind]', params: { kind } });
  };
  const realThumbs = thumbs.filter((item) => !!item?.uri).slice(0, 3);
  const meta = KINDS[kind];
  const icon = meta.icon as keyof typeof Ionicons.glyphMap;
  const showSpin = spinning && count === 0;
  const body = (
    <PressableScale onPress={open} accessibilityLabel={`${title}, ${count} items`} style={[styles.card, styles.tile]}>
      <View style={styles.tileTop}>
        <Text style={styles.tileTitle}>
          {title} <Text style={styles.tileCount}>({count.toLocaleString()})</Text>
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
      </View>
      <CountUp value={bytes} format={(n) => (n > 0 ? formatBytes(n) : count ? `${count}` : '0 MB')} style={styles.tileBytes} duration={700} />
      {showSpin ? <ActivityIndicator style={{ marginTop: 16, alignSelf: 'flex-start' }} color={colors.blue} /> : <View style={{ height: 22, marginTop: 16 }} />}
      <View style={styles.stack}>
        {realThumbs.length ? (
          <>
            {realThumbs.map((item, i) => (
              <Image key={item.id} source={{ uri: item.uri }} recyclingKey={item.id} style={[styles.stackThumb, styles[`stack${i}` as 'stack0' | 'stack1' | 'stack2']]} contentFit="cover" />
            ))}
            <View style={[styles.badge, { backgroundColor: meta.soft }]}>
              <Ionicons name={icon} size={12} color={meta.tone} />
            </View>
          </>
        ) : (
          <View style={[styles.placeholder, { backgroundColor: meta.soft }]}>
            <Ionicons name={icon} size={22} color={meta.tone} />
          </View>
        )}
      </View>
    </PressableScale>
  );
  const wrapStyle = wide ? ({ width: '100%' } as const) : ({ width: '48.5%', flexGrow: 1 } as const);
  if (reduceMotion) return <View style={wrapStyle}>{body}</View>;
  return (
    <Animated.View entering={FadeIn.duration(280)} style={wrapStyle}>
      {body}
    </Animated.View>
  );
}

function ContactsCard({ reduceMotion, onPress }: { reduceMotion: boolean; onPress: () => void }) {
  const body = (
    <PressableScale onPress={onPress} accessibilityLabel="Contacts, coming soon" style={[styles.card, styles.tile]}>
      <View style={styles.tileTop}>
        <Text style={styles.tileTitle}>Contacts</Text>
      </View>
      <Text style={styles.tileBytes}>Coming soon</Text>
      <View style={{ height: 22, marginTop: 16 }} />
      <View style={styles.stack}>
        <View style={[styles.placeholder, { backgroundColor: colors.violetSoft }]}>
          <Ionicons name="people" size={22} color={colors.violet} />
        </View>
      </View>
    </PressableScale>
  );
  const wrapStyle = { width: '48.5%', flexGrow: 1 } as const;
  if (reduceMotion) return <View style={wrapStyle}>{body}</View>;
  return (
    <Animated.View entering={FadeIn.duration(280)} style={wrapStyle}>
      {body}
    </Animated.View>
  );
}

function Notice({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  pro: { height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.goldSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  proText: { fontFamily: fonts.bold, fontSize: 13, color: '#6B5310', letterSpacing: 0.4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, ...shadow },
  storage: { padding: 20, paddingBottom: 18 },
  storageLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink2 },
  nums: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  storageBig: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -1 },
  storageOf: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink3 },
  gbar: { marginTop: 14, marginBottom: 18, height: 8, borderRadius: 8, backgroundColor: colors.track, overflow: 'hidden' },
  smart: { height: 52, borderRadius: 999, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: colors.blue, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  smartText: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '100%', padding: 14, minHeight: 128, overflow: 'hidden' },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  tileTitle: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.ink, flex: 1 },
  tileCount: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.ink3 },
  tileBytes: { marginTop: 4, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  stack: { position: 'absolute', right: 10, bottom: 12, width: 64, height: 64 },
  stackThumb: { position: 'absolute', width: 50, height: 58, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  stack0: { right: 10, top: 0, transform: [{ rotate: '-8deg' }] },
  stack1: { right: 0, top: 4, transform: [{ rotate: '8deg' }] },
  stack2: { right: 5, top: 2, zIndex: 2 },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', zIndex: 4 },
  placeholder: { position: 'absolute', right: 4, bottom: 0, width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  compressIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE8F2', alignItems: 'center', justifyContent: 'center' },
  soonCard: { padding: 20, gap: 8 },
  soonTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  soonBody: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2, lineHeight: 20 },
  soonPill: { alignSelf: 'flex-start', backgroundColor: '#FDE8F2', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  soonPillText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, color: '#9A4D7A' },
  notice: { backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 16, gap: 10, marginBottom: 12 },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  noticeBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  tabs: { position: 'absolute', left: 16, right: 16, height: 62, backgroundColor: colors.card, borderRadius: 999, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, ...shadow },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontFamily: fonts.semi, fontSize: 10.5, color: colors.ink3 },
});
