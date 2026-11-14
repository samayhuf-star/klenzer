import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components/PressableScale';
import { CountUp } from '../components/CountUp';
import { formatBytes } from '../lib/format';
import { useStore } from '../lib/store';
import { RecentlyDeletedSheet } from '../components/RecentlyDeletedSheet';
import { colors, fonts, shadow } from '../theme';

export default function Done() {
  const { lastFreed, lifetimeFreed, hideRdSheet, setHideRdSheet } = useStore();
  const [sheetOpen, setSheetOpen] = useState(
    () => Platform.OS === 'ios' && !!lastFreed?.toRecentlyDeleted && (lastFreed.bytes ?? 0) > 0 && !hideRdSheet,
  );
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  useEffect(() => {
    // Reanimated shared values are mutated by design.
    // eslint-disable-next-line react-hooks/immutability
    pop.value = reduceMotion ? 1 : withDelay(150, withSequence(withSpring(1.15, { damping: 7 }), withSpring(1)));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const t = setTimeout(async () => {
      try {
        if (await StoreReview.hasAction()) await StoreReview.requestReview();
      } catch {}
    }, 2600);
    return () => clearTimeout(t);
  }, [pop, reduceMotion]);

  const bytes = lastFreed?.bytes ?? 0;
  const count = lastFreed?.count ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.center}>
        <Animated.View style={[styles.markWrap, badge]}>
          <LinearGradient colors={['#19E3B1', colors.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mark}>
            <Ionicons name="checkmark" size={72} color="#fff" />
          </LinearGradient>
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(450)} style={{ alignItems: 'center', marginTop: 32 }}>
          <Text style={styles.kicker}>ALL DONE</Text>
          {bytes > 0 ? <CountUp value={bytes} format={(n) => lastFreed?.action === 'convert' ? `${formatBytes(n)} ready to free` : `${formatBytes(n)} cleared`} style={styles.big} /> : <Text style={styles.big}>{count} items cleared</Text>}
          <Text style={styles.sub}>
            {lastFreed?.action === 'convert'
              ? (count === 1 ? '1 Live Photo was converted to a still.' : `${count.toLocaleString()} Live Photos were converted to stills.`)
              : count > 0
                ? `${count.toLocaleString()} ${count === 1 ? 'item was' : 'items were'} removed from your library.`
                : 'Temporary files removed.'}
          </Text>
          {lifetimeFreed > 0 && <CountUp value={lifetimeFreed} format={(n) => `${formatBytes(n)} freed with Klenzer so far`} style={styles.total} />}
        </Animated.View>
      </View>
      <PressableScale onPress={() => router.replace('/')} accessibilityLabel="Done" style={styles.doneBtn} testID="done-button">
        <Text style={styles.doneText}>Done</Text>
      </PressableScale>
      <RecentlyDeletedSheet
        visible={sheetOpen}
        bytes={bytes}
        onClose={() => setSheetOpen(false)}
        hidePref={hideRdSheet}
        onHidePrefChange={setHideRdSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markWrap: { ...shadow },
  mark: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 2, color: colors.blue },
  big: { fontFamily: fonts.display, fontSize: 40, color: colors.ink, letterSpacing: -1, textAlign: 'center', marginTop: 6 },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2, textAlign: 'center', maxWidth: 300, marginTop: 8 },
  total: { fontFamily: fonts.semi, fontSize: 14, color: '#0BAE86', marginTop: 12 },
  doneBtn: { height: 52, borderRadius: 999, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: colors.blue, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  doneText: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
});
