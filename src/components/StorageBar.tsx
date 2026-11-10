import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

/** Rounded bar whose gradient fill grows to the used share of storage. */
export function StorageBar({ progress, height = 10 }: { progress: number; height?: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress, w]);
  const st = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[{ height: '100%', overflow: 'hidden', borderRadius: height / 2 }, st]}>
        <LinearGradient colors={['#2FD37F', '#F2B134', '#F2704B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 320, height: '100%' }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ track: { backgroundColor: colors.line, overflow: 'hidden' } });
