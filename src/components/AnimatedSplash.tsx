import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import { Sparkle } from './Sparkle';

/** Branded intro that continues seamlessly from the native splash (same colour + logo). */
export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const logo = useSharedValue(0.86);
  const word = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    logo.value = withSequence(withSpring(1.08, { damping: 8, stiffness: 120 }), withSpring(1, { damping: 14 }));
    word.value = withDelay(350, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [logo, word]);

  useEffect(() => {
    if (!ready) return;
    out.value = withDelay(1500, withTiming(0, { duration: 450 }, (done) => done && runOnJS(onDone)()));
  }, [ready, onDone, out]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logo.value }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 14 }] }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: out.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="auto">
      <View style={styles.center}>
        <Animated.View style={logoStyle}>
          <Image source={require('../../assets/splash-icon.png')} style={{ width: 200, height: 200 }} contentFit="contain" />
        </Animated.View>
        <Sparkle size={26} color={colors.mint} delay={400} style={{ top: -6, right: 34 }} />
        <Sparkle size={18} color="#fff" delay={900} style={{ bottom: 30, left: 26 }} />
        <Sparkle size={14} color={colors.mint} delay={1300} style={{ top: 60, left: 6 }} />
      </View>
      <Animated.View style={[styles.wordWrap, wordStyle]}>
        <Text style={styles.word}>Klenzer</Text>
        <Text style={styles.tag}>Clear the clutter. Keep the moments.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  center: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  wordWrap: { position: 'absolute', bottom: '18%', alignItems: 'center', gap: 8 },
  word: { color: '#fff', fontSize: 40, letterSpacing: -1, fontFamily: fonts.display },
  tag: { color: '#9FB0E0', fontSize: 15, fontFamily: fonts.medium },
});
