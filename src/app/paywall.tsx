import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PressableScale } from '../components/PressableScale';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '../lib/config';
import { formatBytes } from '../lib/format';
import { buy, defaultPlanKind, getStoreDebug, loadPlans, onStoreDebugChange, Plan, PLANS_UNAVAILABLE_MESSAGE, restore, storeDebugLine, type PlansLoad } from '../lib/purchases';
import { scanReclaimableBytes } from '../lib/reclaim';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

const IS_IOS = Platform.OS === 'ios';
const STORE = IS_IOS ? 'App Store' : 'Google Play';
const ACCOUNT = IS_IOS ? 'Apple ID' : 'Google account';
const RENEW_NOTE = IS_IOS
  ? 'Renews automatically until you cancel in Settings, under your Apple ID subscriptions.'
  : 'Renews automatically until you cancel in your Google Play subscriptions.';

const PERKS = ['Clear duplicates, screenshots and big videos in one tap', 'Scanning always stays free', 'Your photos never leave your phone'];

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { result, completeUnlock } = useStore();
  const reclaim = scanReclaimableBytes(result);
  const [offers, setOffers] = useState<PlansLoad | null>(null);
  const [sel, setSel] = useState<Plan['kind']>('yearly');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [debug, setDebug] = useState(() => storeDebugLine(getStoreDebug()));

  // Store diagnostics stay visible at the bottom so a tester can screenshot why plans did or did not load.
  useEffect(() => onStoreDebugChange((d) => setDebug(storeDebugLine(d))), []);

  useEffect(() => {
    let alive = true;
    loadPlans().then((o) => {
      if (!alive) return;
      setOffers(o);
      const kind = defaultPlanKind(o.plans.map((p) => p.kind));
      if (kind) setSel(kind);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const plans = offers?.plans ?? [];
  const chosen = plans.find((p) => p.kind === sel) ?? plans[0];
  const loading = offers === null;

  const close = () => {
    router.back();
  };

  const purchase = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    const r = await buy(chosen);
    setBusy(false);
    if (r === 'purchased') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      completeUnlock();
    } else if (r === 'pending') {
      Alert.alert('Purchase pending', 'This purchase is waiting for approval. Klenzer will unlock once it is confirmed.');
    } else if (r === 'error') {
      Alert.alert('Purchase didn’t go through', 'You haven’t been charged. Please try again in a moment.');
    }
  };

  const doRestore = async () => {
    if (busy) return;
    setBusy(true);
    const r = await restore();
    setBusy(false);
    if (r === 'restored') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      completeUnlock();
    } else if (r === 'none') {
      Alert.alert('Nothing to restore', `We couldn’t find a previous Klenzer purchase on this ${ACCOUNT}.`);
    } else if (r === 'error') {
      Alert.alert('Restore didn’t finish', `We couldn’t reach the ${STORE} just now. Please try again in a moment.`);
    }
    // 'cancelled': the user closed the sign-in prompt, so stay silent.
  };

  const headline = reclaim > 0 ? `Free ${formatBytes(reclaim)} now` : 'Unlock Klenzer';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="paywall-screen">
      <LinearGradient colors={['#0B1020', '#12307A']} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <PressableScale onPress={close} accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={22} color="#fff" />
        </PressableScale>
        <Text style={styles.title}>{headline}</Text>
        <Text style={styles.sub}>
          {reclaim > 0 ? 'That is what Klenzer found on your phone. Unlock once and clear it in a tap.' : 'Scanning is free. Unlock Klenzer to clear what it finds.'}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(350)} style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p} style={styles.perk}>
              <Ionicons name="checkmark-circle" size={20} color={colors.mint} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </Animated.View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 28 }} color={colors.blue} />
        ) : plans.length === 0 ? (
          <View style={styles.unavailable} testID="plans-unavailable">
            <Text style={styles.unavailableTitle}>Plans didn’t load</Text>
            <Text style={styles.unavailableBody}>{PLANS_UNAVAILABLE_MESSAGE}</Text>
            <Button variant="light" label="Retry" onPress={() => {
                setOffers(null);
                setAttempt((n) => n + 1);
              }}
              testID="plans-retry" />
          </View>
        ) : (
          <>
            {plans.map((p) => (
              <PlanCard key={p.kind} plan={p} selected={chosen?.kind === p.kind} onPress={() => setSel(p.kind)} />
            ))}
            <Button
              label={busy ? 'Please wait' : reclaim > 0 ? `Unlock & free ${formatBytes(reclaim)}` : 'Unlock Klenzer'}
              icon={<Ionicons name="sparkles" size={20} color="#fff" />}
              onPress={purchase}
              busy={busy}
              style={{ marginTop: 6 }}
              testID="unlock"
            />
            <Text style={styles.fine}>
              {chosen?.kind === 'yearly'
                ? `${chosen.price} per year. ${RENEW_NOTE}`
                : chosen?.kind === 'monthly'
                  ? `${chosen.price} per month. ${RENEW_NOTE}`
                  : `${chosen?.price} one time. No subscription, no renewal.`}
            </Text>
          </>
        )}

        <View style={styles.links}>
          <Text style={styles.link} onPress={doRestore} accessibilityRole="button">
            Restore purchase
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} accessibilityRole="link">
            Terms
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} accessibilityRole="link">
            Privacy
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(SUPPORT_URL)} accessibilityRole="link">
            Support
          </Text>
        </View>

        <Text selectable style={styles.debug} testID="paywall-debug">
          {debug}
        </Text>
      </ScrollView>
    </View>
  );
}

function PlanCard({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${plan.title} plan, ${plan.price}`}
      accessibilityState={{ checked: selected }}
      testID={`plan-${plan.kind}`}
      style={[styles.plan, selected && styles.planOn]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <Ionicons name="checkmark" size={15} color="#fff" />}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <Text style={styles.planHint}>{plan.hint}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {!!plan.badge && (
          <View style={styles.best}>
            <Text style={styles.bestText}>{plan.badge}</Text>
          </View>
        )}
        <Text style={styles.planPrice}>{plan.price}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 22, paddingBottom: 28, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  offerTag: { alignSelf: 'flex-start', backgroundColor: colors.amber, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  offerTagText: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1.2, color: '#3A2300' },
  title: { fontFamily: fonts.display, fontSize: 38, color: '#fff', letterSpacing: -1, marginTop: 6 },
  sub: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 22, color: '#C8D3F2', marginTop: 8 },
  perks: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 12, ...shadow },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: radius.md, padding: 18, borderWidth: 2, borderColor: 'transparent', ...shadow },
  planOn: { borderColor: colors.blue },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  planTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  planHint: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, marginTop: 2 },
  planPrice: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  best: { backgroundColor: colors.mintSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  bestText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.8, color: '#0A8F6C' },
  fine: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3, textAlign: 'center' },
  debug: { fontSize: 10, lineHeight: 13, color: '#8E8E93', textAlign: 'center', marginTop: 10 },
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 },
  link: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.blue, paddingVertical: 6 },
  dot: { color: colors.ink3 },
  unavailable: { backgroundColor: colors.card, borderRadius: radius.md, padding: 18, gap: 10, ...shadow },
  unavailableTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  unavailableBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
});
