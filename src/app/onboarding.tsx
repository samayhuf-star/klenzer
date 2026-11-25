import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PressableScale } from '../components/PressableScale';
import { Sparkle } from '../components/Sparkle';
import {
  EMPTY_PROFILE,
  isAnswered,
  pick,
  planHeadline,
  planLines,
  QUESTIONS,
  REMINDER_CHOICES,
  toggleOption,
  type Profile,
  type Question,
} from '../lib/onboarding-profile';
import { formatBytes } from '../lib/format';
import { canScan } from '../lib/photo-access';
import { scanReclaimableBytes } from '../lib/reclaim';
import { saveReminderHour } from '../lib/reminders';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

/**
 * Welcome, photo access, seven questions, reminders, then the personal plan. 11 screens in all.
 * Access comes first so the scan runs in the background while the questions are answered,
 * and the last screen shows a measured number instead of a guess.
 */
type Step = { kind: 'welcome' } | { kind: 'access' } | { kind: 'question'; q: Question } | { kind: 'reminders' } | { kind: 'plan' };

const STEPS: Step[] = [
  { kind: 'welcome' },
  { kind: 'access' },
  ...QUESTIONS.map((q): Step => ({ kind: 'question', q })),
  { kind: 'reminders' },
  { kind: 'plan' },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { finishOnboarding, requestAccess, scan, setReminders } = useStore();
  // True once a background scan has been started from this screen. Going back never starts a second one.
  const [scanStarted, setScanStarted] = useState(false);
  const scanStartedRef = useRef(false);
  const [i, setI] = useState(0);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [busy, setBusy] = useState(false);
  const step = STEPS[i];

  const progress = useSharedValue(1 / STEPS.length);
  useEffect(() => {
    progress.value = withTiming((i + 1) / STEPS.length, { duration: 320 });
  }, [i, progress]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const next = () => setI((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setI((n) => Math.max(0, n - 1));

  const canContinue = step.kind !== 'question' || isAnswered(profile, step.q.id);

  const onContinue = async () => {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});
    if (step.kind === 'reminders') {
      setBusy(true);
      try {
        if (profile.reminderHour == null) await setReminders(false);
        else {
          await saveReminderHour(profile.reminderHour);
          await setReminders(true);
        }
      } catch {}
      setBusy(false);
    }
    if (step.kind === 'access') {
      setBusy(true);
      try {
        const a = await requestAccess();
        // Do not await the scan: it keeps running while the questions are answered.
        if (canScan(a) && !scanStartedRef.current) {
          scanStartedRef.current = true;
          setScanStarted(true);
          void scan({ quietPrompts: true });
        }
      } catch {}
      setBusy(false);
    }
    if (step.kind === 'plan') {
      finishOnboarding(profile);
      return;
    }
    next();
  };

  const label =
    step.kind === 'welcome'
      ? 'Get started'
      : step.kind === 'reminders'
        ? 'Continue'
        : step.kind === 'access'
          ? 'Allow photo access'
          : step.kind === 'plan'
            ? 'See my plan'
            : 'Continue';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]} testID="onboarding">
      <View style={styles.topBar}>
        {i > 0 ? (
          <PressableScale onPress={back} accessibilityLabel="Back" style={styles.back} testID="onboarding-back">
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </PressableScale>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.track} accessibilityLabel={`Step ${i + 1} of ${STEPS.length}`}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
        <View style={styles.back} />
      </View>

      <Animated.View key={i} entering={FadeIn.duration(260)} style={{ flex: 1 }}>
        {step.kind === 'welcome' && <Welcome />}
        {step.kind === 'question' && <QuestionStep q={step.q} profile={profile} onChange={setProfile} />}
        {step.kind === 'reminders' && <RemindersStep profile={profile} onChange={setProfile} />}
        {step.kind === 'access' && <AccessStep />}
        {step.kind === 'plan' && <PlanStep profile={profile} scanStarted={scanStarted} />}
      </Animated.View>

      <View style={styles.cta}>
        <Button label={label} onPress={onContinue} busy={busy} disabled={!canContinue} testID="onboarding-continue" />
        {step.kind === 'access' ? (
          <Text style={styles.skip} onPress={next} accessibilityRole="button">
            Not now
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Hero({ icon, c }: { icon: string; c: readonly [string, string] }) {
  return (
    <View style={styles.artWrap}>
      <LinearGradient colors={[c[0], c[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.art}>
        <Ionicons name={icon as never} size={84} color="#fff" />
      </LinearGradient>
      <Sparkle size={30} color={c[0]} delay={0} style={{ top: -10, right: -6 }} />
      <Sparkle size={20} color={c[1]} delay={500} style={{ bottom: 6, left: -14 }} />
    </View>
  );
}

function Welcome() {
  return (
    <View style={styles.center}>
      <Hero icon="sparkles-outline" c={[colors.mint, colors.blue]} />
      <Text style={styles.title}>Make room on your phone</Text>
      <Text style={styles.body}>Answer a few quick questions and Klenzer builds a cleanup plan around you. It takes about a minute.</Text>
      <View style={styles.trust}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.ink2} />
        <Text style={styles.trustText}>Your photos and answers stay on your phone.</Text>
      </View>
    </View>
  );
}

function QuestionStep({ q, profile, onChange }: { q: Question; profile: Profile; onChange: (p: Profile) => void }) {
  const chosen = pick(profile, q.id);
  return (
    <ScrollView contentContainerStyle={styles.qWrap} showsVerticalScrollIndicator={false}>
      <Text style={styles.qTitle}>{q.title}</Text>
      <Text style={styles.qSub}>{q.subtitle}</Text>
      <View style={{ gap: 12, marginTop: 22 }}>
        {q.options.map((o, k) => {
          const on = chosen.includes(o.id);
          return (
            <Animated.View key={o.id} entering={FadeInDown.delay(60 * k).duration(260)}>
              <PressableScale
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onChange(toggleOption(profile, q, o.id));
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={o.label}
                testID={`option-${q.id}-${o.id}`}
                style={[styles.option, on && styles.optionOn]}>
                <View style={[styles.optIcon, on && { backgroundColor: colors.blue }]}>
                  <Ionicons name={o.icon as never} size={22} color={on ? '#fff' : colors.blue} />
                </View>
                <Text style={styles.optLabel}>{o.label}</Text>
                <View style={[styles.check, on && styles.checkOn]}>{on && <Ionicons name="checkmark" size={15} color="#fff" />}</View>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function RemindersStep({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.qWrap} showsVerticalScrollIndicator={false}>
      <Text style={styles.qTitle}>When should we nudge you?</Text>
      <Text style={styles.qSub}>A gentle reminder every few days keeps clutter from piling up. You can change this in Settings.</Text>
      <View style={{ gap: 12, marginTop: 22 }}>
        {REMINDER_CHOICES.map((c, k) => {
          const on = profile.reminderHour === c.hour;
          return (
            <Animated.View key={c.id} entering={FadeInDown.delay(60 * k).duration(260)}>
              <PressableScale
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onChange({ ...profile, reminderHour: c.hour });
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={c.label}
                testID={`reminder-${c.id}`}
                style={[styles.option, on && styles.optionOn]}>
                <View style={[styles.optIcon, on && { backgroundColor: colors.blue }]}>
                  <Ionicons name={c.hour == null ? 'notifications-off-outline' : 'notifications-outline'} size={22} color={on ? '#fff' : colors.blue} />
                </View>
                <Text style={styles.optLabel}>{c.label}</Text>
                <View style={[styles.check, on && styles.checkOn]}>{on && <Ionicons name="checkmark" size={15} color="#fff" />}</View>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function AccessStep() {
  return (
    <View style={styles.center}>
      <Hero icon="images-outline" c={[colors.blue, colors.violet]} />
      <Text style={styles.title}>Let Klenzer start looking</Text>
      <Text style={styles.body}>
        Klenzer scans while you answer a few questions, so your plan shows the real space you can free. It all happens on your phone. Nothing is uploaded, and nothing is deleted without your tap and your phone’s own confirmation.
      </Text>
    </View>
  );
}

function PlanStep({ profile, scanStarted }: { profile: Profile; scanStarted: boolean }) {
  const { result, scanning, progress } = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(t);
  }, []);
  const progress01 = useSharedValue(0);
  useEffect(() => {
    progress01.value = withTiming(1, { duration: 1900 });
  }, [progress01]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress01.value * 100}%` }));
  const bytes = scanReclaimableBytes(result);
  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const head = planHeadline(profile, { started: scanStarted, scanning, bytes, percent }, formatBytes(bytes));

  if (!ready) {
    return (
      <View style={styles.center}>
        <Hero icon="construct-outline" c={[colors.violet, '#FF6BA8']} />
        <Text style={styles.title}>Building your plan</Text>
        <Text style={styles.body}>{scanStarted ? 'Putting your scan results together with your answers.' : 'Matching Klenzer to your answers.'}</Text>
        <View style={styles.buildTrack}>
          <Animated.View style={[styles.buildFill, barStyle]} />
        </View>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.qWrap} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.planCard} testID="plan-card">
        <Text style={styles.planKicker}>{head.kicker}</Text>
        <Text style={styles.planBig}>{head.big}</Text>
        <Text style={styles.planSub}>{head.sub}</Text>
      </Animated.View>
      <View style={{ gap: 12, marginTop: 20 }}>
        {planLines(profile).map((line, k) => (
          <Animated.View key={line} entering={FadeInDown.delay(120 * (k + 1)).duration(260)} style={styles.planLine}>
            <Ionicons name="checkmark-circle" size={22} color={colors.mint} />
            <Text style={styles.planLineText}>{line}</Text>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, height: 44 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.blue },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  artWrap: { width: 190, height: 190, marginBottom: 40 },
  art: { flex: 1, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -0.8, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.ink2, textAlign: 'center', marginTop: 14, maxWidth: 340 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 },
  trustText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink2 },
  qWrap: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20 },
  qTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
  qSub: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink2, marginTop: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: radius.md, padding: 16, borderWidth: 2, borderColor: 'transparent', ...shadow },
  optionOn: { borderColor: colors.blue },
  optIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  optLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 16.5, color: colors.ink },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  buildTrack: { width: 240, height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden', marginTop: 28 },
  buildFill: { height: 8, borderRadius: 4, backgroundColor: colors.blue },
  planCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 22 },
  planKicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.lime },
  planBig: { fontFamily: fonts.display, fontSize: 44, color: '#fff', letterSpacing: -1, marginTop: 6 },
  planSub: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: '#C8D3F2', marginTop: 6 },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 16, ...shadow },
  planLineText: { flex: 1, fontFamily: fonts.medium, fontSize: 15.5, color: colors.ink },
  cta: { paddingHorizontal: 24, gap: 6 },
  skip: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink3, textAlign: 'center', paddingVertical: 10 },
});
