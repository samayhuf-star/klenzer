import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

function Wave({ delay, size, color }: { delay: number; size: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1));
  }, [delay, v]);
  const a = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - v.value), transform: [{ scale: 0.35 + v.value * 0.65 }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, a]} />;
}

/** Expanding radar rings with a bobbing icon: used while scanning and cleaning. */
export function ScanPulse({ size = 120, icon = 'sparkles', color = colors.blue }: { size?: number; icon?: string; color?: string }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [bob]);
  const ico = useAnimatedStyle(() => ({ transform: [{ translateY: -4 + bob.value * 8 }, { scale: 0.95 + bob.value * 0.1 }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Wave delay={0} size={size} color={color} />
      <Wave delay={650} size={size} color={color} />
      <Wave delay={1300} size={size} color={color} />
      <Animated.View style={ico}>
        <Ionicons name={icon as never} size={size * 0.34} color={color} />
      </Animated.View>
    </View>
  );
}
