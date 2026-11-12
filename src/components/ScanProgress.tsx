import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

/** Live scan radar with a large monotonic percentage. Reduce Motion: static ring + % only. */
export function ScanProgress({
  percent,
  line1,
  line2,
  reduceMotion,
}: {
  percent: number;
  line1: string;
  line2: string;
  reduceMotion: boolean;
}) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      spin.value = 0;
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false);
  }, [reduceMotion, spin]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const pct = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <View style={styles.wrap} accessibilityLabel={`${line1}. ${line2}`}>
      <View style={styles.radar}>
        <View style={styles.ringOuter} />
        <View style={styles.ringMid} />
        <View style={styles.ringInner} />
        {!reduceMotion && (
          <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
            <View style={styles.beam} />
          </Animated.View>
        )}
        <Text style={styles.percent}>{pct}%</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.line1}>{line1}</Text>
        <Text style={styles.line2}>{line2}</Text>
      </View>
    </View>
  );
}

const SIZE = 148;
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 14, gap: 10 },
  radar: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringOuter: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: colors.blueSoft,
  },
  ringMid: {
    position: 'absolute',
    top: 18,
    right: 18,
    bottom: 18,
    left: 18,
    borderRadius: (SIZE - 36) / 2,
    borderWidth: 1.5,
    borderColor: '#D4DCFC',
  },
  ringInner: {
    position: 'absolute',
    top: 36,
    right: 36,
    bottom: 36,
    left: 36,
    borderRadius: (SIZE - 72) / 2,
    backgroundColor: colors.blueSoft,
  },
  sweep: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center' },
  beam: {
    width: 4,
    height: SIZE / 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.blue,
    opacity: 0.7,
  },
  percent: { fontFamily: fonts.display, fontSize: 36, color: colors.ink, letterSpacing: -1, zIndex: 2 },
  copy: { alignItems: 'center', gap: 4, paddingHorizontal: 16 },
  line1: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.ink, textAlign: 'center' },
  line2: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink3, textAlign: 'center' },
});
