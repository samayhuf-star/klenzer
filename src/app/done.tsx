import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CountUp } from '../components/CountUp';
import { Sparkle } from '../components/Sparkle';
import { formatBytes } from '../lib/format';
import { useStore } from '../lib/store';
import { colors, fonts } from '../theme';

const IOS = Platform.OS === 'ios';

export default function Done() {
  const { lastFreed, lifetimeFreed, pending, openPhotos } = useStore();
  const insets = useSafeAreaInsets();
  const pop = useSharedValue(0);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  useEffect(() => {
    pop.value = withDelay(150, withSequence(withSpring(1.15, { damping: 7 }), withSpring(1)));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Ask for a rating only after a real success, and at most once the OS allows.
    const t = setTimeout(async () => {
      try {
        if (await StoreReview.hasAction()) await StoreReview.requestReview();
      } catch {}
    }, 2600);
    return () => clearTimeout(t);
  }, [pop]);

  const bytes = lastFreed?.bytes ?? 0;
  return (
    <LinearGradient colors={['#0B1020', '#12307A']} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.center}>
        <Animated.View style={[styles.badge, badge]}>
          <LinearGradient colors={[colors.mint, colors.blue]} style={styles.badgeFill}>
            <Ionicons name="checkmark" size={72} color="#fff" />
          </LinearGradient>
        </Animated.View>
        <Sparkle size={34} color={colors.mint} delay={300} style={{ top: '27%', right: '22%' }} />
        <Sparkle size={22} color="#fff" delay={700} style={{ top: '33%', left: '20%' }} />
        <Sparkle size={26} color="#8FB2FF" delay={1100} style={{ top: '40%', right: '14%' }} />

        <Animated.View entering={FadeInUp.delay(450)} style={{ alignItems: 'center', gap: 6, marginTop: 34 }}>
          <Text style={styles.kicker}>All done</Text>
          {bytes > 0 ? (
            <CountUp value={bytes} format={(n) => `${formatBytes(n)} ${IOS ? 'cleared' : 'freed'}`} style={styles.big} />
          ) : (
            <Text style={styles.big}>{lastFreed?.count ?? 0} items cleared</Text>
          )}
          <Text style={styles.sub}>
            {IOS
              ? lastFreed?.count
                ? `${lastFreed.count.toLocaleString()} ${lastFreed.count === 1 ? 'item is' : 'items are'} in Recently Deleted. iPhone only gives the space back once you empty it, and apps aren’t allowed to do that for you. Tap below, then Recently Deleted › Select › Delete All.`
                : 'Temporary files removed.'
              : !lastFreed?.count
              ? 'Temporary files removed.'
              : `${lastFreed?.count.toLocaleString()} ${lastFreed?.count === 1 ? 'item was' : 'items were'} deleted from your device.`}
          </Text>
          {lifetimeFreed > bytes && <Text style={styles.total}>{formatBytes(lifetimeFreed)} cleared in total</Text>}
        </Animated.View>
      </View>
      {IOS && pending && <Button variant="primary" label="Open Photos to empty Recently Deleted" onPress={openPhotos} style={{ marginBottom: 12 }} />}
      <Button variant="light" label="Done" onPress={() => router.replace('/')} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 150, height: 150, borderRadius: 75, overflow: 'hidden' },
  badgeFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 2, color: colors.mint, textTransform: 'uppercase' },
  big: { fontFamily: fonts.display, fontSize: 44, color: '#fff', letterSpacing: -1, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: '#B6C3EA', textAlign: 'center', maxWidth: 320, marginTop: 6 },
  total: { fontFamily: fonts.semi, fontSize: 14, color: colors.mint, marginTop: 10 },
});
