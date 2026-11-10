import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { PaywallSheet } from '../components/PaywallSheet';
import { StoreProvider, useStore } from '../lib/store';
import { UnlockProvider } from '../lib/unlock';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { ready, onboarded } = useStore();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Fraunces_700Bold });
  const [splashDone, setSplashDone] = useState(false);
  const done = useCallback(() => setSplashDone(true), []);
  const loaded = fontsLoaded || !!fontError;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      {loaded && ready && (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="index" />
            <Stack.Screen name="review/[kind]" />
            <Stack.Screen name="cleaning" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="smart" />
            <Stack.Screen name="contacts" />
            <Stack.Screen name="events" />
            <Stack.Screen name="vault" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="privacy" />
          </Stack.Protected>
        </Stack>
      )}
      <PaywallSheet />
      {!splashDone && <AnimatedSplash ready={loaded && ready} onDone={done} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <UnlockProvider>
          <Shell />
        </UnlockProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
