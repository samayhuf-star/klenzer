import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PressableScale } from '../components/PressableScale';
import { formatBytes } from '../lib/format';
import { Kind } from '../lib/kinds';
import { dupExtraCount, dupExtras, dupReclaimable, Item, sum } from '../lib/scanner';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

type Segment = 'photos' | 'videos' | 'contacts';

export default function Home() {
  const insets = useSafeAreaInsets();
  const {
    disk, access, canAskAgain, requestAccess, openSettings, manageLimited,
    scanning, progress, scanCats, result, scan, startClean, refreshDisk,
  } = useStore();
  const [segment, setSegment] = useState<Segment>('photos');

  useFocusEffect(
    useCallback(() => {
      refreshDisk();
      const t = setInterval(refreshDisk, 5000);
      return () => clearInterval(t);
    }, [refreshDisk]),
  );

  const usedPct = disk.total ? Math.min(1, disk.used / disk.total) : 0;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : scanning ? 4 : 0;
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </PressableScale>
          <Text style={styles.brand}>Klenzer</Text>
          <PressableScale onPress={() => router.push('/paywall')} accessibilityLabel="Klenzer Pro" style={styles.pro}>
            <Ionicons name="diamond" size={13} color={colors.gold} />
            <Text style={styles.proText}>PRO</Text>
          </PressableScale>
        </View>

        {scanning && (
          <View style={styles.analyze}>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${Math.max(6, pct)}%` }]} />
            </View>
            <View style={styles.analyzeRow}>
              <Ionicons name="search" size={15} color={colors.ink3} />
              <Text style={styles.analyzeText}>
                {progress?.phase === 'reading' ? 'Analyzing files on your device…' : 'Measuring and matching photos…'}
              </Text>
            </View>
          </View>
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

        <View style={[styles.card, styles.storage]}>
          <Text style={styles.storageLabel}>Storage</Text>
          <View style={styles.nums}>
            <Text style={styles.storageBig}>{formatBytes(disk.used)}</Text>
            <Text style={styles.storageOf}>of {formatBytes(disk.total, 0)}</Text>
          </View>
          <View style={styles.gbar}>
            <LinearGradient
              colors={['#F6D365', '#FDA085', colors.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: `${Math.max(2, usedPct * 100)}%`, height: '100%', borderRadius: 8 }}
            />
          </View>
          <PressableScale onPress={smartClean} accessibilityLabel="Smart Clean" style={styles.smart}>
            <Text style={styles.smartText}>Smart Clean</Text>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </PressableScale>
        </View>

        <View style={styles.seg}>
          {(['photos', 'videos', 'contacts'] as Segment[]).map((s) => (
            <PressableScale key={s} onPress={() => setSegment(s)} style={[styles.segBtn, segment === s && styles.segOn]} haptic={false}>
              <Text style={[styles.segLabel, segment === s && styles.segLabelOn]}>{s === 'photos' ? 'Photos' : s === 'videos' ? 'Videos' : 'Contacts'}</Text>
            </PressableScale>
          ))}
        </View>

        {segment === 'photos' && (
          <View style={styles.grid}>
            <CatCard
              kind="similar"
              title="Similar"
              count={result ? dupExtraCount(result.similar) : 0}
              bytes={result ? dupReclaimable(result.similar) : 0}
              thumbs={result?.similar.flatMap((g) => g.items).slice(0, 3) ?? []}
              spinning={photosSpin}
            />
            <CatCard
              kind="duplicates"
              title="Duplicate"
              count={result ? dupExtraCount(result.duplicates) : 0}
              bytes={result ? dupReclaimable(result.duplicates) : 0}
              thumbs={result?.duplicates.flatMap((g) => g.items).slice(0, 3) ?? []}
              spinning={photosSpin}
            />
            <CatCard
              kind="blurry"
              title="Blurry"
              count={result?.blurry.length ?? 0}
              bytes={result ? sum(result.blurry) : 0}
              thumbs={result?.blurry.slice(0, 3) ?? []}
              spinning={photosSpin}
            />
            <CatCard
              kind="screenshots"
              title="Screenshots"
              count={result?.screenshots.length ?? 0}
              bytes={result ? sum(result.screenshots) : 0}
              thumbs={result?.screenshots.slice(0, 3) ?? []}
              spinning={shotsSpin}
            />
          </View>
        )}

        {segment === 'videos' && (
          <View style={{ gap: 10 }}>
            <CatCard
              kind="videos"
              title="Large videos"
              count={result?.largeVideos.length ?? 0}
              bytes={result ? sum(result.largeVideos) : 0}
              thumbs={result?.largeVideos.slice(0, 3) ?? []}
              spinning={videoSpin}
              wide
            />
          </View>
        )}

        {segment === 'contacts' && (
          <PressableScale onPress={() => comingSoon('Contacts')} style={[styles.card, styles.soonCard]}>
            <Text style={styles.soonTitle}>Contacts</Text>
            <Text style={styles.soonBody}>Merging duplicate contacts is coming soon.</Text>
            <View style={styles.soonPill}><Text style={styles.soonPillText}>COMING SOON</Text></View>
          </PressableScale>
        )}

        <PressableScale onPress={() => comingSoon('Compress')} style={[styles.card, styles.compress]}>
          <View style={styles.compressIcon}>
            <Ionicons name="contract" size={18} color="#E85D9C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.compressHint}>Want to save up extra space?</Text>
            <Text style={styles.compressTitle}>Compress</Text>
          </View>
          <View style={styles.soonPill}><Text style={styles.soonPillText}>COMING SOON</Text></View>
        </PressableScale>
      </ScrollView>

      <View style={[styles.tabs, { bottom: Math.max(insets.bottom, 12) + 6 }]}>
        <View style={styles.tab}>
          <Ionicons name="sparkles" size={22} color={colors.blue} />
          <Text style={[styles.tabLabel, { color: colors.blue }]}>Clean</Text>
        </View>
        <PressableScale onPress={() => comingSoon('Compress')} style={styles.tab} haptic={false}>
          <Ionicons name="archive-outline" size={22} color={colors.ink3} />
          <Text style={styles.tabLabel}>Compress</Text>
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
  kind, title, count, bytes, thumbs, spinning, wide,
}: {
  kind: Kind;
  title: string;
  count: number;
  bytes: number;
  thumbs: Item[];
  spinning: boolean;
  wide?: boolean;
}) {
  const open = () => {
    if (!count) return;
    router.push({ pathname: '/review/[kind]', params: { kind } });
  };
  return (
    <PressableScale onPress={open} accessibilityLabel={`${title}, ${count} items`} style={[styles.card, styles.tile, wide && styles.tileWide]}>
      <View style={styles.tileTop}>
        <Text style={styles.tileTitle}>
          {title} <Text style={styles.tileCount}>({count.toLocaleString()})</Text>
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
      </View>
      <Text style={styles.tileBytes}>{bytes > 0 ? formatBytes(bytes) : count ? `${count}` : '0 MB'}</Text>
      {spinning ? <ActivityIndicator style={{ marginTop: 16, alignSelf: 'flex-start' }} color={colors.blue} /> : <View style={{ height: 22, marginTop: 16 }} />}
      <View style={styles.stack}>
        {(thumbs.length ? thumbs.slice(0, 3) : [null, null, null]).map((item, i) =>
          item ? (
            <Image key={item.id} source={{ uri: item.uri }} recyclingKey={item.id} style={[styles.stackThumb, styles[`stack${i}` as 'stack0' | 'stack1' | 'stack2']]} contentFit="cover" />
          ) : (
            <View key={`ph-${i}`} style={[styles.stackThumb, styles[`stack${i}` as 'stack0' | 'stack1' | 'stack2'], { backgroundColor: ['#C2E9FB', '#FBC2EB', '#D4FC79'][i] }]} />
          ),
        )}
      </View>
    </PressableScale>
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
  analyze: { marginBottom: 12 },
  track: { height: 4, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.blue, borderRadius: 4 },
  analyzeRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  analyzeText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink3 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, ...shadow },
  storage: { padding: 20, paddingBottom: 18 },
  storageLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink2 },
  nums: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  storageBig: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -1 },
  storageOf: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink3 },
  gbar: { marginTop: 14, marginBottom: 18, height: 8, borderRadius: 8, backgroundColor: colors.track, overflow: 'hidden' },
  smart: { height: 52, borderRadius: 999, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: colors.blue, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  smartText: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  seg: { marginTop: 14, marginBottom: 12, backgroundColor: '#E6E4F0', borderRadius: 999, flexDirection: 'row', padding: 4 },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 999 },
  segOn: { backgroundColor: colors.card, ...shadow },
  segLabel: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink3 },
  segLabelOn: { color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48.5%', flexGrow: 1, padding: 14, minHeight: 128, overflow: 'hidden' },
  tileWide: { width: '100%' },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  tileTitle: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.ink, flex: 1 },
  tileCount: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.ink3 },
  tileBytes: { marginTop: 4, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  stack: { position: 'absolute', right: 10, bottom: 12, width: 64, height: 64 },
  stackThumb: { position: 'absolute', width: 50, height: 58, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  stack0: { right: 10, top: 0, transform: [{ rotate: '-8deg' }] },
  stack1: { right: 0, top: 4, transform: [{ rotate: '8deg' }] },
  stack2: { right: 5, top: 2, zIndex: 2 },
  compress: { marginTop: 10, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  compressIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDE8F2', alignItems: 'center', justifyContent: 'center' },
  compressHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink3, marginBottom: 3 },
  compressTitle: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.ink },
  soonCard: { padding: 20, gap: 8 },
  soonTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  soonBody: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2, lineHeight: 20 },
  soonPill: { backgroundColor: '#FDE8F2', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  soonPillText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5, color: '#9A4D7A' },
  notice: { backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 16, gap: 10, marginBottom: 12 },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  noticeBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  tabs: { position: 'absolute', left: 16, right: 16, height: 62, backgroundColor: colors.card, borderRadius: 999, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, ...shadow },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontFamily: fonts.semi, fontSize: 10.5, color: colors.ink3 },
});
