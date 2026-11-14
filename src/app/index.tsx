import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ScanBar } from '../components/ScanBar';
import { ScanPulse } from '../components/ScanPulse';
import { Segmented } from '../components/Segmented';
import { CountUp } from '../components/CountUp';
import { PressableScale } from '../components/PressableScale';
import { demoShot } from '../lib/demo';
import { formatBytes, formatFreeAmount, formatMarketedTotal, tileNote } from '../lib/format';
import { KINDS, Kind } from '../lib/kinds';
import { dupExtraCount, dupExtras, dupReclaimable, sum } from '../lib/scanner';
import { scanStartAction } from '../lib/photo-access';
import { useStore } from '../lib/store';
import { colors, fonts, radius } from '../theme';

const SCAN_BARS = [
  { key: 'photos' as const, label: 'Duplicates and similar' },
  { key: 'screenshots' as const, label: 'Screenshots' },
  { key: 'videos' as const, label: 'Videos and recordings' },
];

function categoryPercent(cat: { status: string; done: number; total: number }, overall: number): number {
  if (cat.status === 'done') return 100;
  if (cat.total > 0) return Math.min(99, Math.max(4, Math.round((cat.done / cat.total) * 100)));
  if (cat.status === 'running') return Math.min(99, Math.max(4, overall || 4));
  return 0;
}

type Section = 'photos' | 'videos' | 'contacts';

const SECTIONS: { value: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'photos', label: 'Photos', icon: 'image-outline' },
  { value: 'videos', label: 'Videos', icon: 'film-outline' },
  { value: 'contacts', label: 'Contacts', icon: 'people-outline' },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const {
    disk, access, canAskAgain, openSettings, manageLimited,
    scanning, progress, scanCats, result, scan, cancelScan, startClean, refreshDisk, scanError,
  } = useStore();
  const [section, setSection] = useState<Section>('photos');
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

  const shot = demoShot();
  const previewScanning = shot === 'scanning';
  const showScanning = scanning || previewScanning;
  // Dev screenshot routes only. Production builds never set DEMO, so demoShot() is null.
  const shown = shot === 'start' || previewScanning ? null : result;
  const usedPct = disk.total ? Math.min(1, disk.used / disk.total) : 0;
  const pct = previewScanning
    ? 62
    : showScanning
      ? Math.max(0, Math.min(100, progress?.percent ?? (progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 1)))
      : 0;
  const phaseLabel = previewScanning
    ? 'Measuring file sizes'
    : progress?.phase === 'analyzing'
      ? 'Measuring file sizes'
      : progress?.label || 'Reading your library';
  const doneCount = previewScanning ? 2480 : progress?.done ?? 0;
  const totalCount = previewScanning ? 4432 : progress?.total ?? 0;
  const barSource = previewScanning
    ? {
        photos: { status: 'running' as const, done: 2400, total: 4182 },
        screenshots: { status: 'done' as const, done: 140, total: 140 },
        videos: { status: 'running' as const, done: 80, total: 236 },
      }
    : scanCats;
  const denied = access === 'denied';

  const smartClean = () => {
    // No access yet: the same tap asks for full Photos access and then scans. It never stops at the prompt.
    const action = scanStartAction(access, canAskAgain);
    if (action === 'open-settings') {
      openSettings();
      return;
    }
    if (showScanning) return;
    if (action === 'request-then-scan' || !shown) {
      void scan();
      return;
    }
    const plan = [
      ...(shown.duplicates.length ? [{ kind: 'duplicates' as const, items: shown.duplicates.flatMap(dupExtras) }] : []),
      ...(shown.similar.length ? [{ kind: 'similar' as const, items: shown.similar.flatMap(dupExtras) }] : []),
    ];
    if (!plan.length) {
      Alert.alert('Nothing to clean yet', 'Open a category to review screenshots, videos or blurry photos, or scan again.');
      return;
    }
    startClean(plan);
  };

  const photosSpin = showScanning && (previewScanning || scanCats.photos.status !== 'done');
  const shotsSpin = showScanning && (previewScanning || scanCats.screenshots.status !== 'done');
  const videoSpin = showScanning && (previewScanning || scanCats.videos.status !== 'done');
  const showLargeVideos = (shown?.largeVideos.length ?? 0) > 0;
  const showLive = (shown?.livePhotos.length ?? 0) > 0;
  const rm = !!reduceMotion;

  const reviewBytes = shown
    ? dupReclaimable(shown.similar) + dupReclaimable(shown.duplicates) + sum(shown.blurry) + sum(shown.screenshots) + dupReclaimable(shown.duplicateVideos)
    : 0;
  const enter = (i: number) => (rm ? undefined : FadeInDown.delay(60 * i).springify().damping(18));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="home-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 40, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={styles.brandLockup}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Ai Klenzer</Text>
              <Text style={styles.brandSub} numberOfLines={1}>Your library, tidied on this iPhone</Text>
            </View>
          </View>
          <PressableScale onPress={() => router.push('/paywall')} accessibilityLabel="Ai Klenzer Pro" style={styles.pro} testID="open-paywall">
            <Ionicons name="star" size={12} color={colors.lime} />
            <Text style={styles.proText}>Pro</Text>
          </PressableScale>
          <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" accessibilityHint="Opens settings" style={styles.iconBtn} testID="open-settings">
            <Ionicons name="options-outline" size={20} color={colors.ink} />
          </PressableScale>
        </View>

        {showScanning && (
          <>
            <ScanBar percent={pct} reduceMotion={rm} />
            <Animated.View entering={rm ? undefined : FadeInDown} style={styles.scanCard}>
              <View style={{ alignItems: 'center', marginBottom: 6 }}>
                <ScanPulse size={72} />
              </View>
              <Text
                style={styles.scanPhase}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${phaseLabel}, ${pct} percent complete`}>
                {phaseLabel}
              </Text>
              <View
                style={styles.scanTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: pct }}
                accessibilityLabel="Scan progress">
                <View style={[styles.scanFill, { width: `${Math.max(4, pct)}%` }]} />
              </View>
              <Text style={styles.scanPct}>{pct}% complete</Text>
              <Text style={styles.scanCount}>
                {doneCount.toLocaleString()} of {totalCount.toLocaleString()} items
              </Text>
              <View style={{ marginTop: 14, gap: 8 }}>
                {SCAN_BARS.map((row) => {
                  const cat = barSource[row.key];
                  const catPct = categoryPercent(cat, pct);
                  return (
                    <View key={row.key}>
                      <View style={styles.catLine}>
                        <Text style={styles.catLabel}>{row.label}</Text>
                        <Text style={styles.catPct}>{catPct}%</Text>
                      </View>
                      <View style={styles.catTrack}>
                        <View style={[styles.catFill, { width: `${Math.max(catPct, 4)}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.leave} accessibilityLiveRegion="polite">
                You can leave the app running. We will notify you when the scan is complete.
              </Text>
              <Button
                variant="ghost"
                label="Cancel scan"
                onPress={cancelScan}
                style={{ marginTop: 12 }}
                accessibilityHint="Stops the current library scan"
              />
            </Animated.View>
          </>
        )}

        {!!scanError && !scanning && (
          <Notice title="Scan didn’t finish" body={scanError}>
            <Button variant="light" label="Try again" onPress={() => void scan()} />
          </Notice>
        )}

        {denied && (
          <Notice title="Photo access is off" body="Klenzer needs to read your photo library to find clutter. Photos never leave your device.">
            <Button variant="light" label={canAskAgain ? 'Allow access' : 'Open Settings'} onPress={canAskAgain ? () => void scan() : openSettings} />
          </Notice>
        )}
        {access === 'limited' && (
          <Notice title="Limited photo access" body="Klenzer can only see the photos you selected, so results may be incomplete.">
            <Button variant="light" label="Choose more photos" onPress={manageLimited} />
          </Notice>
        )}

        <Animated.View entering={enter(0)} style={styles.hero} testID="home-hero">
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>STORAGE</Text>
            <View style={styles.heroChip}>
              <Ionicons name="lock-closed" size={11} color={colors.lime} />
              <Text style={styles.heroChipText}>On-device</Text>
            </View>
          </View>
          <View style={styles.nums}>
            <Text style={styles.storageBig}>{formatFreeAmount(disk.free)}</Text>
            <Text style={styles.storageOf}>free of {formatMarketedTotal(disk.total)}</Text>
          </View>
          <View style={styles.gbar}>
            <View style={[styles.gfill, { width: `${Math.max(2, usedPct * 100)}%` }]} />
          </View>
          <View style={styles.heroStats}>
            <Stat label="Used" value={`${Math.round(usedPct * 100)}%`} />
            <View style={styles.heroDivider} />
            <Stat label="Ready to review" value={reviewBytes > 0 ? formatBytes(reviewBytes) : shown ? 'All clear' : 'Scan to see'} />
          </View>
          {!showScanning && (
            <PressableScale
              onPress={smartClean}
              accessibilityLabel="Smart Clean"
              accessibilityHint="Finds duplicates, screenshots, large videos and recordings on this device"
              style={styles.smart}
              testID="smart-clean">
              <Ionicons name="flash" size={18} color={colors.navy} />
              <Text style={styles.smartText}>Smart Clean</Text>
            </PressableScale>
          )}
        </Animated.View>

        <View style={{ marginTop: 22, gap: 14 }} testID="home-sections">
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Clean up</Text>
            <Text style={styles.sectionHint}>Tap a group to review</Text>
          </View>
          <Segmented options={SECTIONS} value={section} onChange={setSection} reduceMotion={rm} testID="home-switch" />

          {section === 'photos' && (
            <View style={styles.grid} testID="home-grid-photos" key="photos">
              <CatCard i={1} kind="similar" title="Similar" count={shown ? dupExtraCount(shown.similar) : 0} bytes={shown ? dupReclaimable(shown.similar) : 0} spinning={photosSpin} reduceMotion={rm} pct={pct} />
              <CatCard i={2} kind="duplicates" title="Duplicate" count={shown ? dupExtraCount(shown.duplicates) : 0} bytes={shown ? dupReclaimable(shown.duplicates) : 0} spinning={photosSpin} reduceMotion={rm} pct={pct} />
              <CatCard i={3} kind="blurry" title="Blurry" count={shown?.blurry.length ?? 0} bytes={shown ? sum(shown.blurry) : 0} spinning={photosSpin} reduceMotion={rm} pct={pct} />
              <CatCard i={4} kind="screenshots" title="Screenshots" count={shown?.screenshots.length ?? 0} bytes={shown ? sum(shown.screenshots) : 0} spinning={shotsSpin} reduceMotion={rm} pct={pct} />
              {showLive && (
                <CatCard i={5} kind="live" title="Live Photos" count={shown?.livePhotos.length ?? 0} bytes={shown ? sum(shown.livePhotos) : 0} spinning={photosSpin} reduceMotion={rm} pct={pct} />
              )}
            </View>
          )}

          {section === 'videos' && (
            <View style={styles.grid} testID="home-grid-videos" key="videos">
              <CatCard i={1} kind="videoDuplicates" title="Duplicate" count={shown ? dupExtraCount(shown.duplicateVideos) : 0} bytes={shown ? dupReclaimable(shown.duplicateVideos) : 0} spinning={videoSpin} reduceMotion={rm} pct={pct} />
              <CatCard i={2} kind="shortVideos" title="Short Recordings" count={shown?.shortVideos?.length ?? 0} bytes={shown ? sum(shown.shortVideos ?? []) : 0} spinning={videoSpin} reduceMotion={rm} pct={pct} />
              <CatCard i={3} kind="screenRecordings" title="Screen Recordings" count={shown?.screenRecordings?.length ?? 0} bytes={shown ? sum(shown.screenRecordings ?? []) : 0} spinning={videoSpin} reduceMotion={rm} pct={pct} />
              {showLargeVideos && (
                <CatCard i={4} kind="videos" title="Large videos" count={shown?.largeVideos.length ?? 0} bytes={shown ? sum(shown.largeVideos) : 0} spinning={videoSpin} reduceMotion={rm} pct={pct} />
              )}
            </View>
          )}

          {section === 'contacts' && <ContactsCard reduceMotion={rm} onPress={() => router.push('/contacts')} />}

          {section === 'photos' && (
            <>
              <View style={[styles.sectionHead, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>Tools</Text>
              </View>
              <View style={styles.tools}>
                <FeatureRow
                  icon="swap-horizontal"
                  tone={colors.blue}
                  soft={colors.blueSoft}
                  title="Swipe to Organize"
                  hint="Month by month. Left to delete, right to keep."
                  onPress={() => router.push('/swipe')}
                  testID="open-swipe"
                />
                <View style={styles.toolsDivider} />
                <FeatureRow
                  icon="finger-print"
                  tone={colors.violet}
                  soft={colors.violetSoft}
                  title="Secret Album"
                  hint="Encrypted photos behind Face ID or a PIN."
                  onPress={() => router.push('/secret-album')}
                  testID="open-secret-album"
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function CatCard({
  i, kind, title, count, bytes, spinning, reduceMotion, pct = 0,
}: {
  pct?: number;
  i: number;
  kind: Kind;
  title: string;
  count: number;
  bytes: number;
  spinning: boolean;
  reduceMotion: boolean;
}) {
  const open = () => {
    if (!count) return;
    router.push({ pathname: '/review/[kind]', params: { kind } });
  };
  const meta = KINDS[kind];
  const icon = meta.icon as keyof typeof Ionicons.glyphMap;
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(50 * i).springify().damping(18)} style={styles.tileWrap}>
      <PressableScale onPress={open} accessibilityLabel={`${title}, ${count} items`} style={styles.tile}>
        <View style={styles.tileTop}>
          <View style={[styles.tileIcon, { backgroundColor: meta.soft }]}>
            <Ionicons name={icon} size={20} color={meta.tone} />
          </View>
          {spinning ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <View style={styles.tileGo}>
              <Ionicons name="arrow-forward" size={13} color={colors.ink2} />
            </View>
          )}
        </View>
        <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.tileNums}>
          <CountUp value={count} format={(n) => Math.round(n).toLocaleString()} style={styles.tileCount} duration={reduceMotion ? 0 : 700} />
          <Text style={styles.tileBytes}>{tileNote(bytes, count, spinning, pct)}</Text>
        </View>
        <View style={[styles.tileAccent, { backgroundColor: meta.tone }]} />
      </PressableScale>
    </Animated.View>
  );
}

function ContactsCard({ reduceMotion, onPress }: { reduceMotion: boolean; onPress: () => void }) {
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(18)}>
      <PressableScale onPress={onPress} accessibilityLabel="Merge duplicate contacts" style={styles.contactCard} testID="open-contacts">
        <View style={styles.tileTop}>
          <View style={[styles.tileIcon, { backgroundColor: colors.violetSoft }]}>
            <Ionicons name="people" size={20} color={colors.violet} />
          </View>
          <View style={styles.tileGo}>
            <Ionicons name="arrow-forward" size={13} color={colors.ink2} />
          </View>
        </View>
        <Text style={styles.contactTitle}>Merge duplicate contacts</Text>
        <Text style={styles.contactBody}>Find contacts with the same name, number or email, preview the result, then merge. Contacts never leave your phone.</Text>
        <View style={styles.contactPill}>
          <Text style={styles.contactPillText}>Find duplicates</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function FeatureRow({
  icon, tone, soft, title, hint, onPress, testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  soft: string;
  title: string;
  hint: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title} style={styles.featureRow} testID={testID}>
      <View style={[styles.featureIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={19} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
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
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  brandLockup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36 },
  brand: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.6 },
  scanCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.blueSoft, padding: 16, marginBottom: 16 },
  scanPhase: { fontFamily: fonts.bold, fontSize: 16, color: colors.blue, textAlign: 'center' },
  scanTrack: { height: 12, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden', marginTop: 12 },
  scanFill: { height: '100%', borderRadius: 6, backgroundColor: colors.blue },
  scanPct: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 8 },
  scanCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2, textAlign: 'center', marginTop: 2 },
  catLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  catLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink2 },
  catPct: { fontFamily: fonts.bold, fontSize: 12, color: colors.blue },
  catTrack: { height: 6, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 6, backgroundColor: colors.blue },
  leave: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2, textAlign: 'center', marginTop: 14, lineHeight: 18 },
  brandSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3, marginTop: 1 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  pro: { height: 34, paddingHorizontal: 13, borderRadius: 999, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', gap: 5 },
  proText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#FFFFFF' },
  hero: { backgroundColor: colors.navy, borderRadius: radius.xl, borderTopRightRadius: 10, padding: 20, paddingBottom: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1.6, color: 'rgba(255,255,255,0.6)' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 24, borderRadius: 8, backgroundColor: 'rgba(147,197,253,0.18)' },
  heroChipText: { fontFamily: fonts.semi, fontSize: 11.5, color: colors.lime },
  nums: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  storageBig: { fontFamily: fonts.display, fontSize: 42, color: '#FFFFFF', letterSpacing: -1.2 },
  storageOf: { fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  gbar: { marginTop: 14, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  gfill: { height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 18 },
  heroDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: 14 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  statValue: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', marginTop: 2 },
  smart: { height: 52, borderRadius: 16, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  smartText: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.navy },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.4 },
  sectionHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tileWrap: { width: '48.4%' },
  tile: { backgroundColor: colors.card, borderRadius: 20, borderBottomLeftRadius: 6, padding: 14, minHeight: 142, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileGo: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2, marginTop: 14 },
  tileNums: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  tileCount: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.6 },
  tileBytes: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink3 },
  tileAccent: { position: 'absolute', left: 14, bottom: 0, width: 28, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  contactCard: { backgroundColor: colors.card, borderRadius: 20, borderBottomLeftRadius: 6, padding: 18, gap: 8, borderWidth: 1, borderColor: colors.line },
  contactTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginTop: 6 },
  contactBody: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2, lineHeight: 20 },
  contactPill: { alignSelf: 'flex-start', backgroundColor: colors.navy, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  contactPillText: { fontFamily: fonts.semi, fontSize: 12.5, color: '#FFFFFF' },
  tools: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  toolsDivider: { height: 1, backgroundColor: colors.line, marginLeft: 66 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontFamily: fonts.semi, fontSize: 15.5, color: colors.ink },
  featureHint: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 1 },
  notice: { backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 16, gap: 10, marginBottom: 12 },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  noticeBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
});
