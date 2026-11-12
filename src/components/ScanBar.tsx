import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

export const SCAN_BAR_COPY = 'Analyzing files on your device';

/** Slim scan progress bar under the top bar. Reduce Motion: the bar jumps to each value without easing. */
export function ScanBar({ percent, reduceMotion }: { percent: number; reduceMotion: boolean }) {
  const pct = Math.max(2, Math.min(100, Math.round(percent)));
  const width = useSharedValue(pct);
  useEffect(() => {
    width.value = reduceMotion ? pct : withTiming(pct, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [pct, reduceMotion, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`${SCAN_BAR_COPY}, ${pct} percent`} testID="scan-bar">
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
      <View style={styles.row}>
        <Ionicons name="search" size={15} color={colors.ink3} />
        <Text style={styles.copy}>{SCAN_BAR_COPY}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, gap: 10 },
  track: { height: 6, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.blue },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  copy: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.ink3 },
});
