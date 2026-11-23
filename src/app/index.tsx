import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { FitText } from '../components/FitText';
import { ScanPulse } from '../components/ScanPulse';
import { Segmented } from '../components/Segmented';
import { CountUp } from '../components/CountUp';
import { PressableScale } from '../components/PressableScale';
import { demoShot } from '../lib/demo';
import { formatBytes, formatFreeAmount, formatMarketedTotal, tileNote } from '../lib/format';
import { KINDS, Kind } from '../lib/kinds';
import { openCustomerCenter } from '../lib/purchases';
import { categoryBarPercent } from '../lib/scan-progress';
import { dupExtraCount, dupReclaimable, hasReviewableItems, readyToReviewBytes, sum } from '../lib/scan-logic';
import { scanStartAction } from '../lib/photo-access';
import { useStore } from '../lib/store';
import { colors, fonts, radius } from '../theme';

const SCAN_BARS = [
  { key: 'photos' as const, label: 'Duplicates and similar' },
  { key: 'screenshots' as const, label: 'Screenshots' },
  { key: 'videos' as const, label: 'Videos and recordings' },
];


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
    scanning, progress, scanCats, originBusy, originPct, result, scan, cancelScan, refreshDisk, scanError, isPro,
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
  const reading = !previewScanning && progress?.phase === 'reading';
  const readDone = progress?.readDone ?? 0;
  const readTotal = progress?.readTotal ?? 0;
  const readPct = readTotal > 0 ? Math.min(100, Math.round((readDone / readTotal) * 100)) : 0;
  // Preview numbers are one ratio: 2480 / 4000 = 62. Live scans use progress.done / progress.total.
  const doneCount = previewScanning ? 2480 : progress?.done ?? 0;
  const totalCount = previewScanning ? 4000 : progress?.total ?? 0;
  const pct = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;
  const phaseLabel = previewScanning
    ? 'Measuring file sizes'
    : progress?.label || (progress?.phase === 'analyzing' ? 'Measuring file sizes' : 'Reading your library');
  const barSource = previewScanning
    ? {
        photos: { status: 'running' as const, done: 2400, total: 4182 },
        screenshots: { status: 'done' as const, done: 140, total: 140 },
        videos: { status: 'running' as const, done: 80, total: 236 },
      }
    : scanCats;
  const denied = access === 'denied';

  const beginScan = () => {
    const action = scanStartAction(access, canAskAgain);
    if (action === 'open-settings') {
      openSettings();
      return;
    }
    if (showScanning) return;
    void scan();
  };

  const openSmartReview = () => {
    if (!shown) {
      beginScan();
      return;
    }
    const extras = dupExtraCount(shown.duplicates) + dupExtraCount(shown.similar);
    if (!extras) {
      Alert.alert('Nothing to clean yet', 'Open a category to review screenshots, videos or blurry photos, or tap Rescan.');
      return;
    }
    // Review screen first. The system delete prompt only runs after Delete N items.
    router.push({ pathname: '/review/[kind]', params: { kind: 'smart' } });
  };

  const photosSpin = showScanning && (previewScanning || scanCats.photos.status !== 'done');
  const shotsSpin = showScanning && (previewScanning || scanCats.screenshots.status !== 'done');
  const videoSpin = showScanning && (previewScanning || scanCats.videos.status !== 'done');
  const showLargeVideos = (shown?.largeVideos.length ?? 0) > 0;
  const showLive = (shown?.livePhotos.length ?? 0) > 0;
  const rm = !!reduceMotion;

  const reviewBytes = shown ? readyToReviewBytes(shown) : 0;
  const reviewValue = !shown ? 'Scan to see' : reviewBytes > 0 ? formatBytes(reviewBytes) : hasReviewableItems(shown) ? 'In groups' : 'All clear';
  const photoBar = categoryBarPercent(barSource.photos);
  const shotBar = categoryBarPercent(barSource.screenshots);
  const videoBar = categoryBarPercent(barSource.videos);
  const enter = (i: number) => (rm ? undefined : FadeInDown.delay(60 * i).springify().damping(18));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }} testID="home-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: insets.bottom + 40, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={styles.brandLockup}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} contentFit="contain" />
            <View style={styles.brandText}>
              <FitText style={styles.brand} minScale={0.7}>Ai Klenzer</FitText>
              <FitText style={styles.brandSub} lines={2} minScale={0.8}>Your library, tidied on this iPhone</FitText>
            </View>
          </View>
          {isPro ? (
            // Already on Pro: the pill confirms it and opens subscription management, never the plans.
            <PressableScale onPress={() => void openCustomerCenter()} accessibilityLabel="Ai Klenzer Pro is active" accessibilityHint="Opens subscription management" style={styles.pro} testID="pro-active">
              <Ionicons name="checkmark-circle" size={14} color={colors.lime} />
              <FitText style={styles.proText} minScale={0.8}>Pro</FitText>
            </PressableScale>
          ) : (
            <PressableScale onPress={() => router.push('/paywall')} accessibilityLabel="Ai Klenzer Pro" style={styles.pro} testID="open-paywall">
              <Ionicons name="star" size={12} color={colors.lime} />
              <FitText style={styles.proText} minScale={0.8}>Pro</FitText>
            </PressableScale>
          )}
          <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" accessibilityHint="Opens settings" style={styles.iconBtn} testID="open-settings">
            <Ionicons name="options-outline" size={20} color={colors.ink} />
          </PressableScale>
        </View>

        {showScanning && (
            <Animated.View entering={rm ? undefined : FadeInDown} style={styles.scanCard} testID="scan-card">
              <View style={{ alignItems: 'center', marginBottom: 6 }}>
                <ScanPulse size={72} />
              </View>
              <FitText
                style={styles.scanPhase}
                lines={2}
                minScale={0.8}
                accessibilityLiveRegion="polite">
                {phaseLabel}
              </FitText>
              <View
                style={styles.scanTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: reading ? readPct : pct }}
                accessibilityLabel={reading ? phaseLabel : `${phaseLabel}, ${pct} percent complete`}>
                <View style={[styles.scanFill, { width: `${reading ? readPct : pct}%` }]} />
              </View>
              {reading ? (
                <Text style={styles.scanPct}>{readTotal > 0 ? `${readPct}% read` : 'Starting the scan'}</Text>
              ) : (
                <>
                  <Text style={styles.scanPct}>{pct}% complete</Text>
                  {totalCount > 0 ? (
                    <Text style={styles.scanCount}>
                      {doneCount.toLocaleString()} of {totalCount.toLocaleString()}
                    </Text>
                  ) : null}
                </>
              )}
              <View style={{ marginTop: 14, gap: 8 }}>
                {SCAN_BARS.map((row) => {
                  const catPct = categoryBarPercent(barSource[row.key]);
                  return (
                    <View key={row.key}>
                      <View style={styles.catLine}>
                        <Text style={styles.catLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{row.label}</Text>
                        <Text style={styles.catPct}>{catPct}%</Text>
                      </View>
                      <View style={styles.catTrack}>
                        <View style={[styles.catFill, { width: `${catPct}%` }]} />
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
        )}

        {!!scanError && !scanning && (
          <Notice title="Scan didn’t finish" body={scanError}>
            <Button variant="light" label="Try again" onPress={() => void scan()} />
          </Notice>
        )}

        {denied && (
          <Notice title="Photo access is off" body="Ai Klenzer needs to read your photo library to find clutter. Photos never leave your device.">
            <Button variant="light" label={canAskAgain ? 'Allow access' : 'Open Settings'} onPress={canAskAgain ? () => void scan() : openSettings} />
          </Notice>
        )}
        {access === 'limited' && (
          <Notice title="Limited photo access" body="Ai Klenzer can only see the photos you selected, so results may be incomplete.">
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
            <FitText style={styles.storageBig} minScale={0.55}>{formatFreeAmount(disk.free)}</FitText>
            <FitText style={styles.storageOf} minScale={0.75}>{`free of ${formatMarketedTotal(disk.total)}`}</FitText>
          </View>
          <View style={styles.gbar}>
            <View style={[styles.gfill, { width: `${Math.max(2, usedPct * 100)}%` }]} />
          </View>
          <View style={styles.heroStats}>
            <Stat label="Used" value={`${Math.round(usedPct * 100)}%`} />
            <View style={styles.heroDivider} />
            <Stat label="Ready to review" value={reviewValue} />
          </View>
          {!showScanning && (
            <>
              <PressableScale
                onPress={shown ? openSmartReview : beginScan}
                accessibilityLabel={shown ? 'Smart Clean' : 'Scan library'}
                accessibilityHint={shown ? 'Opens the photos that would be deleted so you can review them first' : 'Starts a scan of this iPhone'}
                style={styles.smart}
                testID="smart-clean">
                <Ionicons name={shown ? 'flash' : 'search'} size={18} color={colors.navy} />
                <FitText style={styles.smartText} minScale={0.7}>{shown ? 'Smart Clean' : 'Scan library'}</FitText>
              </PressableScale>
              {shown ? (
                <PressableScale
                  onPress={beginScan}
                  accessibilityLabel="Rescan"
                  accessibilityHint="Scans the library again and keeps the results on this iPhone"
                  style={styles.rescan}
                  testID="rescan">
                  <FitText style={styles.rescanText} minScale={0.75}>Rescan</FitText>
                </PressableScale>
              ) : null}
            </>
          )}
        </Animated.View>

        <View style={{ marginTop: 22, gap: 14 }} testID="home-sections">
          <View style={styles.sectionHead}>
            <FitText style={styles.sectionTitle} minScale={0.7}>Clean up</FitText>
            <FitText style={styles.sectionHint} lines={2} minScale={0.75}>Tap a group to review</FitText>
          </View>
          <Segmented options={SECTIONS} value={section} onChange={setSection} reduceMotion={rm} testID="home-switch" />

          {section === 'photos' && (
            <View style={styles.grid} testID="home-grid-photos" key="photos">
              {/* Similar holds exact copies and look-alikes together. */}
              <CatCard i={1} kind="similar" title="Similar" count={shown ? dupExtraCount(shown.similar) + dupExtraCount(shown.duplicates) : 0} bytes={shown ? dupReclaimable(shown.similar) + dupReclaimable(shown.duplicates) : 0} spinning={photosSpin} reduceMotion={rm} pct={photoBar} />
              <CatCard i={3} kind="blurry" title="Blurry" count={shown?.blurry.length ?? 0} bytes={shown ? sum(shown.blurry) : 0} spinning={photosSpin} reduceMotion={rm} pct={photoBar} />
              <CatCard i={4} kind="screenshots" title="Screenshots" count={shown?.screenshots.length ?? 0} bytes={shown ? sum(shown.screenshots) : 0} spinning={shotsSpin} reduceMotion={rm} pct={shotBar} />
              {showLive && (
                <CatCard i={5} kind="live" title="Live Photos" count={shown?.livePhotos.length ?? 0} bytes={shown ? sum(shown.livePhotos) : 0} spinning={photosSpin} reduceMotion={rm} pct={photoBar} />
              )}
              <CatCard i={6} kind="forwarded" title="Chat images" count={shown?.forwarded?.length ?? 0} bytes={shown ? sum(shown.forwarded ?? []) : 0} spinning={originBusy} reduceMotion={rm} pct={originPct} />
              <CatCard i={7} kind="aiImages" title="AI Images" count={shown?.aiImages?.length ?? 0} bytes={shown ? sum(shown.aiImages ?? []) : 0} spinning={originBusy} reduceMotion={rm} pct={originPct} />
            </View>
          )}

          {section === 'videos' && (
            <View style={styles.grid} testID="home-grid-videos" key="videos">
              <CatCard i={1} kind="videoDuplicates" title="Duplicate" count={shown ? dupExtraCount(shown.duplicateVideos) : 0} bytes={shown ? dupReclaimable(shown.duplicateVideos) : 0} spinning={videoSpin} reduceMotion={rm} pct={videoBar} />
              <CatCard i={2} kind="shortVideos" title="Short Recordings" count={shown?.shortVideos?.length ?? 0} bytes={shown ? sum(shown.shortVideos ?? []) : 0} spinning={videoSpin} reduceMotion={rm} pct={videoBar} />
              <CatCard i={3} kind="screenRecordings" title="Screen Recordings" count={shown?.screenRecordings?.length ?? 0} bytes={shown ? sum(shown.screenRecordings ?? []) : 0} spinning={videoSpin} reduceMotion={rm} pct={videoBar} />
              {showLargeVideos && (
                <CatCard i={4} kind="videos" title="Large videos" count={shown?.largeVideos.length ?? 0} bytes={shown ? sum(shown.largeVideos) : 0} spinning={videoSpin} reduceMotion={rm} pct={videoBar} />
              )}
            </View>
          )}

          {section === 'contacts' && <ContactsCard reduceMotion={rm} onPress={() => router.push('/contacts')} />}

          {section === 'photos' && (
            <>
              <View style={[styles.sectionHead, { marginTop: 8 }]}>
                <FitText style={styles.sectionTitle} minScale={0.7}>Tools</FitText>
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
    <View style={styles.stat}>
      <FitText style={styles.statLabel} lines={2} minScale={0.75}>{label}</FitText>
      <FitText style={styles.statValue} minScale={0.65}>{value}</FitText>
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
            <Ionicons name={icon} size={17} color={meta.tone} />
          </View>
          {spinning ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <View style={styles.tileGo}>
              <Ionicons name="arrow-forward" size={11} color={colors.ink2} />
            </View>
          )}
        </View>
        <FitText style={styles.tileTitle} lines={2} minScale={0.75}>{title}</FitText>
        <View style={styles.tileNums}>
          <CountUp value={count} format={(n) => Math.round(n).toLocaleString()} style={styles.tileCount} duration={reduceMotion ? 0 : 700} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} />
          <FitText style={styles.tileBytes} lines={2} minScale={0.75}>{tileNote(bytes, count, spinning, pct)}</FitText>
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
        <FitText style={styles.contactTitle} lines={2} minScale={0.75}>Merge duplicate contacts</FitText>
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
        <FitText style={styles.featureTitle} lines={2} minScale={0.8}>{title}</FitText>
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
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  brandLockup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { flex: 1, minWidth: 0 },
  logo: { width: 36, height: 36 },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: -0.6 },
  scanCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.blueSoft, padding: 16, marginBottom: 16 },
  scanPhase: { fontFamily: fonts.bold, fontSize: 16, color: colors.blue, textAlign: 'center' },
  scanTrack: { height: 12, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden', marginTop: 12 },
  scanFill: { height: '100%', borderRadius: 6, backgroundColor: colors.blue },
  scanPct: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 8 },
  scanCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2, textAlign: 'center', marginTop: 2 },
  catLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  catLabel: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 12, color: colors.ink2 },
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
  nums: { marginTop: 8, gap: 2 },
  storageBig: { fontFamily: fonts.display, fontSize: 40, color: '#FFFFFF', letterSpacing: -1.2, width: '100%' },
  storageOf: { fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.6)', width: '100%' },
  gbar: { marginTop: 14, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  gfill: { height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 18 },
  heroDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: 14 },
  stat: { flex: 1, minWidth: 0 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.55)', width: '100%' },
  statValue: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF', marginTop: 2, width: '100%' },
  smart: { height: 52, borderRadius: 16, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  smartText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 16.5, color: colors.navy, textAlign: 'center' },
  rescan: { marginTop: 10, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  rescanText: { fontFamily: fonts.semi, fontSize: 15, color: colors.lime, textAlign: 'center' },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  sectionTitle: { flexShrink: 1, fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  sectionHint: { flexShrink: 1, maxWidth: '58%', fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3, textAlign: 'right' },
  // Three cards in a row. A fixed gap with flex-start keeps a short last row aligned to the left.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: 8, rowGap: 8 },
  tileWrap: { width: '31.4%' },
  tile: { backgroundColor: colors.card, borderRadius: 16, borderBottomLeftRadius: 6, padding: 10, minHeight: 122, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileGo: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink2, marginTop: 10, width: '100%' },
  tileNums: { marginTop: 2, gap: 1 },
  tileCount: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.5, width: '100%' },
  tileBytes: { fontFamily: fonts.semi, fontSize: 11, color: colors.ink3, width: '100%' },
  tileAccent: { position: 'absolute', left: 10, bottom: 0, width: 28, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  contactCard: { backgroundColor: colors.card, borderRadius: 20, borderBottomLeftRadius: 6, padding: 18, gap: 8, borderWidth: 1, borderColor: colors.line },
  contactTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginTop: 6 },
  contactBody: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2, lineHeight: 20 },
  contactPill: { alignSelf: 'flex-start', backgroundColor: colors.navy, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  contactPillText: { fontFamily: fonts.semi, fontSize: 12.5, color: '#FFFFFF' },
  tools: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  toolsDivider: { height: 1, backgroundColor: colors.line, marginLeft: 66 },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontFamily: fonts.semi, fontSize: 15.5, color: colors.ink, width: '100%' },
  featureHint: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 1, flexShrink: 1 },
  notice: { backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 16, gap: 10, marginBottom: 12 },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  noticeBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
});
