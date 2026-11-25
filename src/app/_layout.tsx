import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { ready, onboarded, paywallPending, isPro, clearPaywallPending } = useStore();
  // Load fonts in the background. Do not hold the splash or the first render on them.
  useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Fraunces_700Bold });

  // Hide the native splash as soon as this shell mounts. Do not wait on fonts, IAP, or a branded intro.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Right after onboarding the paywall opens once. Someone who already has Pro (a restored purchase) skips it.
  useEffect(() => {
    if (!ready || !onboarded || !paywallPending) return;
    if (isPro) {
      clearPaywallPending();
      return;
    }
    const t = setTimeout(() => router.push('/paywall?source=onboarding'), 350);
    return () => clearTimeout(t);
  }, [ready, onboarded, paywallPending, isPro, clearPaywallPending]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      {ready && (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="index" />
            <Stack.Screen name="review/[kind]" />
            <Stack.Screen name="cleaning" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="plan" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="swipe" />
            <Stack.Screen name="contacts" />
            <Stack.Screen name="secret-album" options={{ gestureEnabled: true }} />
          </Stack.Protected>
        </Stack>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
