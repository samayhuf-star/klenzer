import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ReactNode, useEffect } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRIVACY_URL } from '../lib/config';
import { formatBytes } from '../lib/format';
import { dupExtraCount, dupReclaimable, sum } from '../lib/scanner';
import { useStore } from '../lib/store';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, radius, shadow } from '../theme';
import { Button } from './Button';
import { CountUp } from './CountUp';
import { StorageBar } from './StorageBar';
import { PressableScale } from './PressableScale';

const PERKS = ['Smart Clean: duplicates, screenshots, large videos', 'Merge contacts and clear old calendar events', 'Secret Space for private photos and videos'];
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** Payment sheet shown when someone taps Fix now or any delete button before unlocking. Scanning never reaches it. */
export function PaywallSheet() {
  const insets = useSafeAreaInsets();
  const { paywallOpen, price, monthlyPrice, plan, setPlan, busy, error, buy, restore, closePaywall } = useUnlock();
  const { result, tempSize, disk } = useStore();

  const found = result
    ? dupReclaimable(result.duplicates) + sum(result.screenshots) + sum(result.largeVideos) + (Platform.OS === 'ios' ? sum(result.livePhotos) : 0) + tempSize
    : 0;
  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google account';

  const dupCount = result ? dupExtraCount(result.duplicates) : 0;
  const shotCount = result ? result.screenshots.length : 0;
  const vidCount = result ? result.largeVideos.length : 0;
  const usedPct = disk.total ? Math.round((disk.used / disk.total) * 100) : 0;

  return (
    <Modal visible={paywallOpen} animationType="slide" onRequestClose={closePaywall} statusBarTranslucent>
      <View style={styles.screen}>
        <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
          <PressableScale onPress={restore} disabled={busy !== null} accessibilityLabel="Restore purchase">
            <Text style={styles.link}>{busy === 'restore' ? 'Restoring…' : 'Restore purchase'}</Text>
          </PressableScale>
          <PressableScale onPress={closePaywall} disabled={busy === 'buy'} accessibilityLabel="Close" style={styles.close}>
            <Ionicons name="close" size={22} color={colors.ink2} />
          </PressableScale>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          <Animated.Text entering={FadeInDown.duration(450)} style={styles.title}>Clean your Storage</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(80)} style={styles.sub}>
            {found > 0 ? `Your scan found ${formatBytes(found)} you can clear.` : 'Get rid of what you don’t need.'}
          </Animated.Text>

          <Animated.View entering={FadeIn.delay(150)} style={styles.tiles}>
            <HeroTile icon="copy" tone={colors.blue} label="Duplicates" count={dupCount} />
            <HeroTile icon="phone-portrait" tone={colors.violet} label="Screenshots" count={shotCount} />
            <HeroTile icon="videocam" tone={colors.amber} label="Videos" count={vidCount} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250)} style={{ marginTop: 22 }}>
            <StorageBar progress={usedPct / 100} height={14} />
            <Text style={styles.usedText}>
              <CountUp value={usedPct} format={(n) => `${Math.round(n)}%`} style={styles.usedNum} /> of your storage is used
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(320)} style={styles.perks}>
            {[...PERKS, monthlyPrice ? 'No ads, ever' : 'Pay once. No subscription, no ads, ever'].map((p) => (
              <View key={p} style={styles.perk}>
                <Ionicons name="checkmark-circle" size={18} color="#0F8F6E" />
                <Text style={styles.perkText}>{p}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400)}>
            {monthlyPrice ? (
              <View style={{ gap: 10, marginBottom: 16 }}>
                <PlanCard selected={plan === 'monthly'} onPress={() => setPlan('monthly')} name="Monthly" price={`${monthlyPrice} / month`} note="Cancel anytime" />
                <PlanCard selected={plan === 'lifetime'} onPress={() => setPlan('lifetime')} name="Lifetime" price={price} note="Pay once, keep it forever" badge="Best value" />
              </View>
            ) : (
              <View style={[styles.plan, { marginBottom: 16 }]}>
                <View>
                  <Text style={styles.planName}>Lifetime unlock</Text>
                  <Text style={styles.planNote}>Pay once, keep it forever</Text>
                </View>
                <Text style={styles.planPrice}>{price}</Text>
              </View>
            )}
            <PulseCta>
              <Button label={monthlyPrice && plan === 'monthly' ? `Subscribe for ${monthlyPrice}/month` : `Unlock for ${price}`} onPress={buy} busy={busy === 'buy'} disabled={busy !== null} />
            </PulseCta>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Animated.View>

          <View style={styles.links}>
            <PressableScale onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {})} accessibilityLabel="Privacy policy">
              <Text style={styles.link}>Privacy</Text>
            </PressableScale>
            {Platform.OS === 'ios' && monthlyPrice && (
              <>
                <Text style={styles.dot}>·</Text>
                <PressableScale onPress={() => WebBrowser.openBrowserAsync(TERMS_URL).catch(() => {})} accessibilityLabel="Terms of Use">
                  <Text style={styles.link}>Terms of Use</Text>
                </PressableScale>
              </>
            )}
            <Text style={styles.dot}>·</Text>
            <PressableScale onPress={closePaywall} disabled={busy === 'buy'} accessibilityLabel="Not now">
              <Text style={styles.link}>Not now</Text>
            </PressableScale>
          </View>
          <Text style={styles.foot}>
            {monthlyPrice && plan === 'monthly'
              ? `Renews every month until you cancel in your ${store} settings, at least a day before renewal. Charged to your ${store}.`
              : `One-time payment charged to your ${store}.`}{' '}
            Nothing is deleted until you unlock.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** App-style tile with a red count badge that pops in and counts up (numbers are the real scan results). */
function HeroTile({ icon, tone, label, count }: { icon: string; tone: string; label: string; count: number }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(500, withSpring(1, { damping: 8, stiffness: 160 }));
  }, [pop]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon as never} size={34} color={tone} />
        {count > 0 && (
          <Animated.View style={[styles.badgeDot, st]}>
            <CountUp value={count} duration={900} format={(n) => (n > 999 ? '999+' : `${Math.round(n)}`)} style={styles.badgeText} />
          </Animated.View>
        )}
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

/** Soft breathing glow so the main button draws the eye without being pushy. */
function PulseCta({ children }: { children: ReactNode }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withSequence(withTiming(1.025, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1);
  }, [s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

function PlanCard({ selected, onPress, name, price, note, badge }: { selected: boolean; onPress: () => void; name: string; price: string; note: string; badge?: string }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`${name}, ${price}`} style={[styles.plan, { marginBottom: 0 }, !selected && { borderColor: colors.line, backgroundColor: '#fff' }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.planName}>{name}</Text>
          {badge && <Text style={styles.best}>{badge}</Text>}
        </View>
        <Text style={styles.planNote}>{note}</Text>
      </View>
      <Text style={styles.planPrice}>{price}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 6 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(11,16,32,0.07)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 32, color: colors.blue, textAlign: 'center', marginTop: 14, letterSpacing: -0.6 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.ink2, textAlign: 'center', marginTop: 6 },
  tiles: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30 },
  tileIcon: { width: 76, height: 76, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow },
  tileLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  badgeDot: { position: 'absolute', top: -9, right: -9, minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 6, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  badgeText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  usedText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink2, textAlign: 'center', marginTop: 10 },
  usedNum: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  best: { fontFamily: fonts.bold, fontSize: 11, color: colors.navy, backgroundColor: colors.mint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  planNote: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  perks: { gap: 9, marginTop: 22, marginBottom: 18, backgroundColor: '#fff', borderRadius: radius.md, padding: 16 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
  plan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.blue, backgroundColor: colors.blueSoft, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 12 },
  planName: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink },
  planPrice: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 10 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 },
  link: { fontFamily: fonts.semi, fontSize: 14, color: colors.blue },
  dot: { color: colors.ink3 },
  foot: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3, textAlign: 'center', marginTop: 8 },
});
