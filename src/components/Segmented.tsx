import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fonts, shadow } from '../theme';

/** Segmented switcher with a sliding thumb. Reduce Motion: the thumb moves without a spring. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  reduceMotion,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  reduceMotion: boolean;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    const to = index * segW;
    x.value = reduceMotion ? to : withSpring(to, { damping: 20, stiffness: 220 });
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
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: 14, padding: 4, height: 46 },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 11, backgroundColor: colors.card, ...shadow },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semi, fontSize: 14.5, color: colors.ink2 },
  labelOn: { color: colors.ink },
});
