import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesOffering } from 'react-native-purchases';
import { Button } from '../components/Button';
import { PressableScale } from '../components/PressableScale';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '../lib/config';
import { formatBytes } from '../lib/format';
import { buy, loadOfferings, logPaywallOfferingsDiagnostic, Plan, plansFor, purchasesAvailable, restore } from '../lib/purchases';
import { reclaimableBytes } from '../lib/reclaim';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

type Offers = { main: PurchasesOffering | null; secondChance: PurchasesOffering | null };

const PERKS = ['Clear duplicates, screenshots and big videos in one tap', 'Scanning always stays free', 'Your photos never leave your phone'];

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const { result, tempSize, completeUnlock } = useStore();
  const reclaim = reclaimableBytes(result, tempSize);
  const [offers, setOffers] = useState<Offers | null>(null);
  const [second, setSecond] = useState(false);
  const [sel, setSel] = useState<Plan['kind']>('lifetime');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadOfferings().then((o) => {
      if (!alive) return;
      setOffers(o);
      if (plansFor(o.main).length === 0) logPaywallOfferingsDiagnostic(o.raw);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const offering = second && offers?.secondChance ? offers.secondChance : (offers?.main ?? null);
  const plans = plansFor(offering);
  const chosen = plans.find((p) => p.kind === sel) ?? plans[0];
  const loading = offers === null;

  // The first time the user closes the paywall, show the optional "second chance" offering (if one is set up in RevenueCat).
  const close = () => {
    if (!second && offers?.secondChance) {
      setSecond(true);
      setSel('lifetime');
      return;
    }
    router.back();
  };

  const purchase = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    const r = await buy(chosen.pkg);
    setBusy(false);
    if (r === 'purchased') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      completeUnlock();
    } else if (r === 'error') {
      Alert.alert('Purchase didn’t go through', 'You haven’t been charged. Please try again in a moment.');
    }
  };

  const doRestore = async () => {
    setBusy(true);
    const ok = await restore();
    setBusy(false);
    if (ok) completeUnlock();
    else Alert.alert('Nothing to restore', 'We couldn’t find a previous Klenzer purchase on this Apple ID or Google account.');
  };

  const headline = reclaim > 0 ? `Free ${formatBytes(reclaim)} now` : 'Unlock Klenzer';
  const monthlyShown = chosen?.kind === 'monthly';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={['#0B1020', '#12307A']} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <PressableScale onPress={close} accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={22} color="#fff" />
        </PressableScale>
        {second && offers?.secondChance && (
          <View style={styles.offerTag}>
            <Text style={styles.offerTagText}>ONE-TIME OFFER</Text>
          </View>
        )}
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
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>{purchasesAvailable() ? 'Couldn’t load prices' : 'Purchases aren’t available yet'}</Text>
            <Text style={styles.unavailableBody}>
              {purchasesAvailable() ? 'Check your connection and try again.' : 'This build has no store connection. Install a release or development build to buy.'}
            </Text>
            <Button variant="light" label="Try again" onPress={() => setAttempt((n) => n + 1)} />
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
            />
            <Text style={styles.fine}>
              {monthlyShown
                ? `${chosen?.price} per month. Renews automatically until you cancel in your App Store or Google Play subscriptions.`
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
      </ScrollView>
    </View>
  );
}

function PlanCard({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  const life = plan.kind === 'lifetime';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${life ? 'Lifetime' : 'Monthly'} plan, ${plan.price}`}
      accessibilityState={{ checked: selected }}
      style={[styles.plan, selected && styles.planOn]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <Ionicons name="checkmark" size={15} color="#fff" />}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.planTitle}>{life ? 'Lifetime' : 'Monthly'}</Text>
        <Text style={styles.planHint}>{life ? 'Pay once, clean forever' : 'Cancel any time'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {life && (
          <View style={styles.best}>
            <Text style={styles.bestText}>BEST VALUE</Text>
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
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 },
  link: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.blue, paddingVertical: 6 },
  dot: { color: colors.ink3 },
  unavailable: { backgroundColor: colors.card, borderRadius: radius.md, padding: 18, gap: 10, ...shadow },
  unavailableTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  unavailableBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
});
