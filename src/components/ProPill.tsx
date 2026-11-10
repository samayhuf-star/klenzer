import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useUnlock } from '../lib/unlock';
import { colors, fonts, gold } from '../theme';
import { PressableScale } from './PressableScale';

/** Gold crown pill in the header. Opens the payment sheet; disappears once unlocked. */
export function ProPill() {
  const { unlocked, requireUnlock } = useUnlock();
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.value = withRepeat(withSequence(withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1);
  }, [glow]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: glow.value }] }));
  if (unlocked) return null;
  return (
    <Animated.View style={st}>
      <PressableScale onPress={() => requireUnlock(() => {})} accessibilityLabel="Go Pro" style={styles.pill}>
        <Ionicons name="ribbon" size={14} color="#fff" />
        <Text style={styles.text}>PRO</Text>
      </PressableScale>
    </Animated.View>
  );
}

export function ProTag() {
  const { unlocked } = useUnlock();
  if (unlocked) return null;
  return <Text style={styles.tag}>PRO</Text>;
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: gold, borderRadius: 999, paddingHorizontal: 12, height: 34 },
  text: { fontFamily: fonts.bold, fontSize: 14, color: '#fff', letterSpacing: 0.4 },
  tag: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff', backgroundColor: gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', letterSpacing: 0.4, alignSelf: 'flex-start' },
});
