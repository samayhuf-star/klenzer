import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { ScreenshotStatusBar } from '../components/ScreenshotChrome';
import { screenshotsEnabled, screenshotScene, SHOT_METRICS } from '../lib/screenshotMode';
import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The web dev bundle warns about SVG props. Store captures should not show that toast.
if (screenshotsEnabled()) LogBox.ignoreAllLogs();

function ShotNavigator() {
  const scene = screenshotScene();
  const path = usePathname();
  const { result } = useStore();
  useEffect(() => {
    if (scene === 'duplicates' && result && path !== '/review/duplicates') router.replace('/review/duplicates');
    if (scene === 'control' && result && path !== '/review/videos') router.replace('/review/videos');
  }, [scene, path, result]);
  return null;
}

function Shell() {
  const { ready, onboarded } = useStore();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Fraunces_700Bold });
  const shot = screenshotScene();
  const [splashDone, setSplashDone] = useState(screenshotsEnabled());
  const done = useCallback(() => setSplashDone(true), []);
  const loaded = fontsLoaded || !!fontError;

  useEffect(() => {
    if (Platform.OS !== 'web' || !shot) return;
    const style = document.createElement('style');
    style.textContent = 'html,body{background:#F4F7FF;overflow:hidden}::-webkit-scrollbar{display:none}';
    document.head.appendChild(style);
    return () => style.remove();
  }, [shot]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID={shot ? `shot-${shot}` : undefined}>
      <StatusBar style="dark" />
      {loaded && ready && (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: shot ? 'none' : 'slide_from_right' }}>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="index" />
            <Stack.Screen name="review/[kind]" />
            <Stack.Screen name="cleaning" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="privacy" />
          </Stack.Protected>
        </Stack>
      )}
      {loaded && ready && shot && <ShotNavigator />}
      {loaded && shot && <ScreenshotStatusBar />}
      {!splashDone && <AnimatedSplash ready={loaded && ready} onDone={done} />}
    </View>
  );
}

export default function RootLayout() {
  const tree = (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
  // Web measures safe area from env(), which headless Chrome reports as 0.
  // Pin the iPhone insets for captures so the status bar does not cover the UI.
  if (screenshotsEnabled()) {
    return (
      <SafeAreaInsetsContext.Provider value={SHOT_METRICS.insets}>
        <SafeAreaFrameContext.Provider value={SHOT_METRICS.frame}>{tree}</SafeAreaFrameContext.Provider>
      </SafeAreaInsetsContext.Provider>
    );
  }
  return <SafeAreaProvider>{tree}</SafeAreaProvider>;
}
