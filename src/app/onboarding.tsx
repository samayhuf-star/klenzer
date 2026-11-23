import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { requestPlansAfterOnboarding } from '../lib/after-onboarding';
import { formatFreeAmount, formatMarketedTotal } from '../lib/format';
import { canScan } from '../lib/photo-access';
import { dupExtraCount } from '../lib/scanner';
import { useStore } from '../lib/store';
import { colors, fonts } from '../theme';

const STEPS = 5;
const DEVICE = Platform.OS === 'ios' ? 'iPhone' : 'phone';
type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Five steps. Photo access is asked on step 2, and the scan starts the moment it is granted,
 * so it runs behind steps 3 to 5 and Home opens with results already filling in.
 */
export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { finishOnboarding, requestAccess, scan, disk, access, scanning, progress, result } = useStore();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // The photo prompt is part of onboarding. A grant is the one launch that may scan.
      const granted = await requestAccess();
      if (canScan(granted)) void scan();
    } finally {
      setBusy(false);
      next();
    }
  };

  const finish = (plans: boolean) => {
    if (plans) requestPlansAfterOnboarding();
    finishOnboarding();
  };

  const usedPct = disk.total > 0 ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0;
  const pct = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)));
  const hasAccess = canScan(access);
  // Counts are the real scan so far. Before anything is known they read as a status, never as a number.
  const count = (n: number | undefined) => (n ? n.toLocaleString() : scanning ? 'Scanning' : hasAccess ? '0' : 'Needs access');
  const similar = result ? dupExtraCount(result.similar) + dupExtraCount(result.duplicates) : undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={FadeIn.duration(220)} style={styles.stepWrap}>
          {step === 0 && (
            <>
              <View style={styles.brandRow}>
                <Image source={require('../../assets/logo.png')} style={styles.logo} contentFit="contain" />
                <Text style={styles.brand}>Ai Klenzer</Text>
              </View>
              <Text style={styles.title}>{usedPct > 0 ? `Your ${DEVICE} is ${usedPct}% full` : `Free up space on your ${DEVICE}`}</Text>
              <Text style={styles.text}>Let’s find what is taking the space. Everything is checked on this {DEVICE} and nothing is uploaded.</Text>
              <View style={styles.storage}>
                <Text style={styles.storageLabel}>STORAGE</Text>
                <View style={styles.storageRow}>
                  <Text style={styles.storageFree}>{formatFreeAmount(disk.free)}</Text>
                  <Text style={styles.storageOf}>free of {formatMarketedTotal(disk.total)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${usedPct}%` }]} />
                </View>
              </View>
              <View style={styles.chips}>
                <Chip label="Used" value={`${usedPct}%`} />
                <Chip label="Free" value={formatFreeAmount(disk.free)} />
                <Chip label="Total" value={formatMarketedTotal(disk.total)} />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.title}>Allow photo access to start</Text>
              <Text style={styles.text}>Ai Klenzer needs to see your library to find clutter. Scanning begins the moment you allow it, while you finish these steps.</Text>
              <View style={styles.card}>
                <Row icon="lock-closed-outline" tone={colors.blue} soft={colors.blueSoft} title={`Stays on this ${DEVICE}`} sub="Photos are never uploaded, shared or tracked." />
                <Row icon="checkmark" tone="#0B8F6E" soft={colors.mintSoft} title="You decide what goes" sub={`Nothing is deleted without your tap and your ${DEVICE}’s own confirmation.`} />
                <Row icon="images-outline" tone={colors.violet} soft={colors.violetSoft} title="Full access works best" sub="Limited access hides albums such as WhatsApp." />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.title}>Clear look-alike and duplicate photos</Text>
              <Text style={styles.text}>Bursts, retakes and exact copies are grouped. The best one is kept and the rest are ready to clear.</Text>
              <View style={styles.card}>
                <View style={styles.photos}>
                  <LinearGradient colors={['#93C5FD', colors.blue]} style={styles.photo} />
                  <LinearGradient colors={['#BFDBFE', '#60A5FA']} style={styles.photo} />
                  <LinearGradient colors={[colors.blueSoft, '#93C5FD']} style={styles.photo} />
                </View>
                <View style={styles.photoNote}>
                  <Text style={styles.best}>BEST · kept</Text>
                  <Text style={styles.sub}>Extras are selected for you</Text>
                </View>
              </View>
              <View style={styles.card}>
                <Row icon="copy-outline" tone={colors.violet} soft={colors.violetSoft} title="Similar" sub={count(similar)} />
                <Row icon="eye-off-outline" tone="#B45309" soft={colors.amberSoft} title="Blurry" sub={count(result?.blurry.length)} />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.title}>Sort chat images, AI images and screenshots</Text>
              <Text style={styles.text}>Pictures saved from WhatsApp and other chats are sorted by type, so forwards and memes are quick to clear.</Text>
              <View style={styles.card}>
                <Row icon="chatbubbles-outline" tone="#0B8F6E" soft={colors.mintSoft} title="Chat images" sub="Repeats, memes and greetings, documents, other photos" />
                <Row icon="sparkles-outline" tone={colors.violet} soft={colors.violetSoft} title="AI Images" sub="Pictures whose file carries an AI label" />
                <Row icon="phone-portrait-outline" tone="#C2410C" soft={colors.coralSoft} title="Screenshots" sub="Old screenshots, largest first" />
                <Row icon="people-outline" tone="#1D6A96" soft={colors.skySoft} title="Contacts" sub="Merge duplicate contacts" />
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.title}>{hasAccess ? 'Here is what Ai Klenzer found so far' : 'Here is what you get'}</Text>
              {hasAccess && (
                <View style={[styles.card, styles.found]}>
                  <Found label="Similar" value={count(similar)} />
                  <Found label="Screenshots" value={count(result?.screenshots.length)} />
                  <Found label="Chat images" value={count(result?.forwarded?.length)} />
                </View>
              )}
              <Text style={styles.section}>What you get</Text>
              <View style={styles.card}>
                <Row icon="checkmark" tone={colors.blue} soft={colors.blueSoft} title="Unlimited cleaning" sub="Photos, videos, chat images and contacts" />
                <Row icon="flash-outline" tone={colors.blue} soft={colors.blueSoft} title="Smart Clean" sub="Clears extra copies in one tap" />
                <Row icon="finger-print-outline" tone={colors.blue} soft={colors.blueSoft} title="Secret Album" sub="Private photos behind Face ID or a PIN" />
                <Row icon="search-outline" tone={colors.blue} soft={colors.blueSoft} title="Free to scan and review" sub="A plan is only needed to clean" />
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={styles.foot}>
        {step >= 2 && scanning && (
          <View style={styles.live} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} accessibilityLabel={`Scanning in the background, ${pct} percent`}>
            <Ionicons name="sync" size={16} color={colors.lime} />
            <View style={styles.liveMid}>
              <Text style={styles.liveText}>{step === 4 ? 'Still scanning. Results keep filling in.' : 'Scanning in the background'}</Text>
              <View style={styles.liveTrack}>
                <View style={[styles.liveFill, { width: `${pct}%` }]} />
              </View>
            </View>
            <Text style={styles.livePct}>{pct}%</Text>
          </View>
        )}
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: STEPS }, (_, k) => (
            <View key={k} style={[styles.dot, k === step && styles.dotOn]} />
          ))}
        </View>
        {step === 1 ? (
          <>
            <Button label="Allow photo access" busy={busy} testID="onboarding-continue" onPress={() => void allow()} />
            <Button label="Not now" variant="ghost" testID="onboarding-skip-access" onPress={next} />
          </>
        ) : step === STEPS - 1 ? (
          <>
            <Button label="See plans" testID="onboarding-plans" onPress={() => finish(true)} />
            <Button label="Go to my results" variant="ghost" testID="onboarding-start" onPress={() => finish(false)} />
          </>
        ) : (
          <Button label="Continue" testID="onboarding-continue" onPress={next} />
        )}
      </View>
    </View>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

function Found({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.foundCell}>
      <Text style={styles.foundValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, tone, soft, title, sub }: { icon: IconName; tone: string; soft: string; title: string; sub: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: 24, paddingBottom: 12 },
  stepWrap: { gap: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 12 },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.ink, letterSpacing: -0.6 },
  text: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink2 },
  section: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  storage: { padding: 20, borderRadius: 28, backgroundColor: colors.navy, gap: 12 },
  storageLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: colors.ink3 },
  storageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  storageFree: { fontFamily: fonts.display, fontSize: 44, color: '#FFFFFF' },
  storageOf: { fontFamily: fonts.body, fontSize: 15, color: '#B6BED3' },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: '#26304A', overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.lime },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 2 },
  chipLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3 },
  chipValue: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  card: { padding: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 14 },
  found: { flexDirection: 'row', gap: 8 },
  foundCell: { flex: 1, gap: 2 },
  foundValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3 },
  photos: { flexDirection: 'row', gap: 8 },
  photo: { flex: 1, height: 120, borderRadius: 14 },
  photoNote: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  best: { fontFamily: fonts.bold, fontSize: 13, color: '#0B8F6E' },
  foot: { paddingHorizontal: 24, gap: 10 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.navy },
  liveMid: { flex: 1, gap: 6 },
  liveText: { fontFamily: fonts.semi, fontSize: 13, color: '#FFFFFF' },
  liveTrack: { height: 6, borderRadius: 3, backgroundColor: '#26304A', overflow: 'hidden' },
  liveFill: { height: 6, borderRadius: 3, backgroundColor: colors.lime },
  livePct: { fontFamily: fonts.bold, fontSize: 13, color: colors.lime },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginVertical: 4 },
  dot: { height: 8, width: 8, borderRadius: 4, backgroundColor: colors.blue, opacity: 0.3 },
  dotOn: { width: 26, opacity: 1 },
});
