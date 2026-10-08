import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

type Props = { size: number; color?: string; delay?: number; style?: object };

/** A 4-point star that twinkles in and out. */
export function Sparkle({ size, color = '#fff', delay = 0, style }: Props) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0.15, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1),
    );
  }, [delay, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.6 + v.value * 0.5 }, { rotate: `${v.value * 30}deg` }] }));
  const r = 50;
  const k = 11;
  return (
    <Animated.View style={[{ position: 'absolute' }, style, a]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path
          fill={color}
          d={`M50 ${50 - r} C${50 + k} ${50 - k} ${50 + k} ${50 - k} ${50 + r} 50 C${50 + k} ${50 + k} ${50 + k} ${50 + k} 50 ${50 + r} C${50 - k} ${50 + k} ${50 - k} ${50 + k} ${50 - r} 50 C${50 - k} ${50 - k} ${50 - k} ${50 - k} 50 ${50 - r}Z`}
        />
      </Svg>
    </Animated.View>
  );
}
