import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Sparkle } from '../components/Sparkle';
import { useStore } from '../lib/store';
import { colors, fonts } from '../theme';

const SLIDES = [
  { icon: 'copy-outline', c: [colors.mint, colors.blue], title: 'Find the clutter', body: 'Klenzer spots duplicate and near-identical photos, old screenshots and huge videos hiding in your library.' },
  { icon: 'hand-left-outline', c: [colors.blue, colors.violet], title: 'You decide, always', body: 'Review everything before it goes. Nothing is deleted without your tap and your phone’s own confirmation.' },
  { icon: 'lock-closed-outline', c: [colors.violet, '#FF6BA8'], title: 'Private by design', body: 'Everything happens on your device. Your photos are never uploaded, shared or tracked. No account needed.' },
] as const;

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { finishOnboarding } = useStore();
  const x = useSharedValue(0);
  const [i, setI] = useState(0);
  const list = useRef<FlatList>(null);
  const onScroll = useAnimatedScrollHandler((e) => (x.value = e.contentOffset.x));
  const last = i === SLIDES.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <Animated.FlatList
        ref={list as never}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => <Slide item={item} index={index} x={x} width={width} />}
      />
      <View style={styles.dots}>
        {SLIDES.map((s, k) => (
          <Dot key={s.title} k={k} x={x} width={width} />
        ))}
      </View>
      <View style={styles.cta}>
        <Button
          label={last ? 'Get started' : 'Continue'}
          onPress={() => (last ? finishOnboarding() : list.current?.scrollToIndex({ index: i + 1, animated: true }))}
        />
      </View>
    </View>
  );
}

function Dot({ k, x, width }: { k: number; x: SharedValue<number>; width: number }) {
  const s = useAnimatedStyle(() => ({
    width: interpolate(x.value, [(k - 1) * width, k * width, (k + 1) * width], [8, 26, 8], Extrapolation.CLAMP),
    opacity: interpolate(x.value, [(k - 1) * width, k * width, (k + 1) * width], [0.3, 1, 0.3], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[styles.dot, s]} />;
}

function Slide({ item, index, x, width }: { item: (typeof SLIDES)[number]; index: number; x: SharedValue<number>; width: number }) {
  const art = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(x.value, [(index - 1) * width, index * width, (index + 1) * width], [width * 0.4, 0, -width * 0.4]) },
      { scale: interpolate(x.value, [(index - 1) * width, index * width, (index + 1) * width], [0.7, 1, 0.7], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(x.value, [(index - 1) * width, index * width, (index + 1) * width], [0, 1, 0], Extrapolation.CLAMP),
  }));
  return (
    <View style={{ width, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.artWrap, art]}>
        <LinearGradient colors={[item.c[0], item.c[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.art}>
          <Ionicons name={item.icon as never} size={96} color="#fff" />
        </LinearGradient>
        <Sparkle size={34} color={item.c[0]} delay={0} style={{ top: -10, right: -6 }} />
        <Sparkle size={22} color={item.c[1]} delay={500} style={{ bottom: 6, left: -14 }} />
      </Animated.View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  artWrap: { width: 200, height: 200, marginBottom: 44 },
  art: { flex: 1, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.ink, letterSpacing: -0.8, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.ink2, textAlign: 'center', marginTop: 14, maxWidth: 340 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 22 },
  dot: { height: 8, borderRadius: 4, backgroundColor: colors.blue },
  cta: { paddingHorizontal: 24 },
});
