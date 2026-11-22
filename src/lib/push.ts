import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Remote push through OneSignal, so messages can be sent and measured from the OneSignal dashboard.
 *
 * Privacy rules this file enforces:
 * - Nothing is sent to OneSignal until the user turns notifications on in this version or later
 *   (consent is required before the SDK may talk to its servers).
 * - People who switched on local reminders in an older version (when the policy said no push
 *   token was collected) are NOT enrolled automatically; they stay local-only until they toggle again.
 * - Turning notifications off withdraws consent and unsubscribes the device.
 *
 * With no App ID configured (extra.oneSignalAppId), every function here is a no-op.
 */
const KEY = 'klenzer.push.v1';
const APP_ID: string = (Constants.expoConfig?.extra?.oneSignalAppId as string | undefined)?.trim() ?? '';
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

type OneSignalModule = typeof import('react-native-onesignal');
let sdk: OneSignalModule['OneSignal'] | null = null;

function oneSignal() {
  if (!SUPPORTED || !APP_ID) return null;
  if (sdk) return sdk;
  try {
    // Loaded lazily so web and builds without an App ID never touch the native module.
    const mod = require('react-native-onesignal') as OneSignalModule;
    mod.OneSignal.setConsentRequired(true);
    mod.OneSignal.initialize(APP_ID);
    sdk = mod.OneSignal;
  } catch {
    sdk = null;
  }
  return sdk;
}

export const pushConfigured = SUPPORTED && !!APP_ID;

async function pushPref(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'on';
  } catch {
    return false;
  }
}

/** The user just turned notifications on: record consent for remote push and subscribe. */
export async function enablePush(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'on');
  } catch {}
  await syncPush(true);
}

/** The user turned notifications off: unsubscribe and withdraw consent. */
export async function disablePush(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'off');
  } catch {}
  await syncPush(false);
}

/**
 * Brings OneSignal in line with the user's choice. Call on app open with whether notifications
 * are currently on and allowed by the OS.
 */
export async function syncPush(notificationsOn: boolean): Promise<void> {
  try {
    const consented = notificationsOn && (await pushPref());
    // Never start the SDK for someone who has not opted in.
    if (!consented && !sdk) return;
    const os = oneSignal();
    if (!os) return;
    if (consented) {
      os.setConsentGiven(true);
      os.User.pushSubscription.optIn();
    } else {
      os.User.pushSubscription.optOut();
      os.setConsentGiven(false);
    }
  } catch {}
}
