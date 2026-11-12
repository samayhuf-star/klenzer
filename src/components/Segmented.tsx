import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

/** Pill switcher with a dark sliding pill. Reduce Motion: the pill moves without a spring. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  reduceMotion,
  testID,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (value: T) => void;
  reduceMotion: boolean;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width ? (width - 10) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    const to = index * segW;
    x.value = reduceMotion ? to : withSpring(to, { damping: 22, stiffness: 260 });
  }, [index, segW, reduceMotion, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} onLayout={onLayout} accessibilityRole="tablist" testID={testID}>
      {segW > 0 && <Animated.View style={[styles.thumb, { width: segW }, thumb]} />}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={styles.seg}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            testID={`${testID ?? 'seg'}-${o.value}`}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}>
            {o.icon && <Ionicons name={o.icon} size={15} color={on ? colors.lime : colors.ink2} />}
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 999, padding: 5, height: 50, borderWidth: 1, borderColor: colors.line },
  thumb: { position: 'absolute', top: 5, bottom: 5, left: 5, borderRadius: 999, backgroundColor: colors.navy },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2 },
  labelOn: { color: '#FFFFFF' },
});
