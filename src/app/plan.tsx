import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PressableScale } from '../components/PressableScale';
import { buy, currentPlanState, loadPlans, manageSubscriptions, openCustomerCenter, type Plan, type PlanState } from '../lib/purchases';
import { useStore } from '../lib/store';
import { colors, fonts, radius, shadow } from '../theme';

const TITLES: Record<Plan['kind'], string> = { yearly: 'Annual', monthly: 'Monthly', weekly: 'Weekly', lifetime: 'Lifetime' };

/**
 * Settings, "Your plan". Subscribers can switch to any other plan here.
 * Lifetime is offered only here, and only to people who already pay for a subscription.
 */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { isPro } = useStore();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [state, setState] = useState<PlanState | null>(null);
  const [busy, setBusy] = useState<Plan['kind'] | null>(null);

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    Promise.all([loadPlans(), currentPlanState()]).then(([p, s]) => {
      if (!alive) return;
      setPlans(p.plans);
      setState(s);
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  const loading = plans === null || state === null;
  const subscribed = !!state?.subscription;
  const others = (plans ?? []).filter((p) => p.type === 'subs' && p.kind !== state?.subscription);
  const lifetime = (plans ?? []).find((p) => p.kind === 'lifetime');
  // The lifetime offer needs a live subscription. Free users and lifetime owners never see it.
  const showLifetime = !!lifetime && subscribed && !state?.lifetime;

  const choose = async (plan: Plan) => {
    if (busy) return;
    setBusy(plan.kind);
    const r = await buy(plan, plan.kind === 'lifetime' ? null : state?.subscriptionProductId);
    setBusy(null);
    if (r === 'purchased') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      reload();
      if (plan.kind === 'lifetime') {
        Alert.alert(
          'You now own Ai Klenzer for life',
          'Your subscription is not cancelled automatically. Cancel it in your subscription settings so you are not charged again.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Manage subscription', onPress: () => void manageSubscriptions() },
          ],
        );
      } else {
        Alert.alert('Plan updated', `You are now on the ${TITLES[plan.kind]} plan. The store shows the exact change date.`);
      }
    } else if (r === 'pending') {
      Alert.alert('Purchase pending', 'This change is waiting for approval. It will apply once it is confirmed.');
    } else if (r === 'error') {
      Alert.alert('That didn’t go through', 'You haven’t been charged. Please try again in a moment.');
    }
  };

  const current = state?.lifetime ? 'Lifetime' : state?.subscription ? TITLES[state.subscription] : isPro ? 'Pro' : 'No plan';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </PressableScale>
        <Text style={styles.title}>Your plan</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={styles.current}>
          <Text style={styles.kicker}>CURRENT PLAN</Text>
          <Text style={styles.currentName} testID="current-plan">{current}</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={colors.blue} />
        ) : (
          <>
            {!subscribed && !state?.lifetime ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Choose a plan</Text>
                <Text style={styles.cardBody}>Start your free trial to clean, merge contacts and use Secret Album.</Text>
                <Button label="See plans" onPress={() => router.replace('/paywall')} />
              </View>
            ) : null}

            {subscribed && others.length ? <Text style={styles.section}>Switch plan</Text> : null}
            {subscribed
              ? others.map((p) => (
                  <View key={p.kind} style={styles.planRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{TITLES[p.kind]}</Text>
                      <Text style={styles.planHint}>{p.price} per {p.kind === 'yearly' ? 'year' : p.kind === 'monthly' ? 'month' : 'week'}</Text>
                    </View>
                    <Button variant="ghost" label="Switch" busy={busy === p.kind} onPress={() => choose(p)} style={{ minWidth: 110 }} testID={`switch-${p.kind}`} />
                  </View>
                ))
              : null}

            {showLifetime && lifetime ? (
              <View style={styles.lifetime} testID="lifetime-offer">
                <Text style={styles.lifetimeKicker}>FOR SUBSCRIBERS</Text>
                <Text style={styles.lifetimeTitle}>Own it for life</Text>
                <Text style={styles.lifetimeBody}>Pay once, clean forever. {lifetime.price} one time, no renewals, no trial.</Text>
                <Button label={`Get Lifetime, ${lifetime.price}`} busy={busy === 'lifetime'} onPress={() => choose(lifetime)} testID="buy-lifetime" />
                <Text style={styles.lifetimeFine}>Your subscription keeps renewing until you cancel it in {Platform.OS === 'ios' ? 'your Apple ID' : 'Google Play'} subscriptions.</Text>
              </View>
            ) : null}

            {state?.lifetime ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>You own Lifetime</Text>
                <Text style={styles.cardBody}>Thank you. Everything stays unlocked on this Apple ID or Google account.</Text>
              </View>
            ) : null}

            {subscribed ? <Button variant="light" label="Manage or cancel subscription" onPress={() => void openCustomerCenter()} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  current: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 20 },
  kicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.lime },
  currentName: { fontFamily: fonts.display, fontSize: 34, color: '#fff', marginTop: 4 },
  section: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1, color: colors.ink3, marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, gap: 10, ...shadow },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  cardBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 16, ...shadow },
  planTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  planHint: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink3, marginTop: 2 },
  lifetime: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, gap: 10, borderWidth: 2, borderColor: colors.gold, ...shadow },
  lifetimeKicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.gold },
  lifetimeTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  lifetimeBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink2 },
  lifetimeFine: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3, textAlign: 'center' },
});
