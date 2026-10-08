import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'checkbox';
  accessibilityState?: { checked?: boolean; disabled?: boolean };
};

export function PressableScale({ children, onPress, style, disabled, haptic = true, ...a11y }: Props) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...a11y}
      accessibilityRole={a11y.accessibilityRole ?? 'button'}
      disabled={disabled}
      onPressIn={() => (s.value = withSpring(0.96, { damping: 18, stiffness: 400 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 14, stiffness: 300 }))}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={[style, anim, disabled && { opacity: 0.5 }]}>
      {children}
    </AnimatedPressable>
  );
}
