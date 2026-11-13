import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatBytes } from './format';
import { scanCompleteBody } from './scan-complete';
export { scanCompleteBody };

/**
 * Local, on-device reminders only: no push server, no tokens, no data leaves the phone.
 * Opt-in, scheduled with a 3-day interval, and rewritten every time the app opens or
 * returns to the foreground so the used/total figures stay current.
 */
const KEY = 'klenzer.reminders.v1';
const ASKED_KEY = 'klenzer.reminders.asked.v1';
const CHANNEL = 'reminders';
const SCAN_COMPLETE_CHANNEL = 'scan-complete';
const INTERVAL_SECONDS = 3 * 24 * 60 * 60;
export const SCAN_NOTIFICATION_ACTION = 'scan';

export type ReminderInfo = {
  usedBytes?: number;
  totalBytes?: number;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export function isScanNotification(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return (data as { action?: string }).action === SCAN_NOTIFICATION_ACTION;
}

export async function remindersPref(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'on';
  } catch {
    return false;
  }
}

async function savePref(on: boolean) {
  try {
    await AsyncStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {}
}

export async function permissionState(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Clears and re-plans the 3-day reminder with fresh disk numbers (call on each app open / foreground). */
export async function scheduleReminders(opts: ReminderInfo = {}): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await remindersPref()) || (await permissionState()) !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const used = opts.usedBytes ?? 0;
    const total = opts.totalBytes ?? 0;
    const body =
      used > 0 && total > 0
        ? `You've used ${formatBytes(used)} of ${formatBytes(total, 0)}. Time to run Klenzer`
        : 'Time to run Klenzer';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Klenzer',
        body,
        data: { action: SCAN_NOTIFICATION_ACTION },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: INTERVAL_SECONDS,
        repeats: true,
        channelId: Platform.OS === 'android' ? CHANNEL : undefined,
      },
    });
  } catch {}
}

export async function remindersAsked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markRemindersAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, '1');
  } catch {}
}

/** Asks the OS for permission (first call shows the system prompt). Returns whether reminders are now on. */
export async function enableReminders(info: ReminderInfo = {}): Promise<boolean> {
  try {
    let state = await permissionState();
    if (state === 'undetermined') {
      const r = await Notifications.requestPermissionsAsync();
      state = r.granted ? 'granted' : 'denied';
    }
    if (state !== 'granted') return false;
    await savePref(true);
    await scheduleReminders(info);
    return true;
  } catch {
    return false;
  }
}

export async function disableReminders(): Promise<void> {
  await savePref(false);
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export const SCAN_COMPLETE_ACTION = 'scan-complete';


/**
 * Request notification permission when the first scan starts. Never call this on launch.
 * If the user already decided, or the prompt fails, do nothing and do not throw.
 */
export async function askNotificationPermissionOnScanStart(): Promise<boolean> {
  try {
    const state = await permissionState();
    if (state === 'granted') return true;
    if (state !== 'undetermined') return false;
    const r = await Notifications.requestPermissionsAsync();
    return !!r.granted;
  } catch {
    return false;
  }
}

/** Fire a local scan-complete notification with the default sound. No-op if permission was denied. */
export async function notifyScanComplete(bytes: number): Promise<void> {
  try {
    if ((await permissionState()) !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(SCAN_COMPLETE_CHANNEL, {
        name: 'Scan complete',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: 'klenzer-scan-complete',
      content: {
        title: 'Klenzer',
        body: scanCompleteBody(bytes),
        sound: true,
        data: { action: SCAN_COMPLETE_ACTION },
        ...(Platform.OS === 'android' ? { channelId: SCAN_COMPLETE_CHANNEL } : {}),
      },
      trigger: null,
    });
  } catch {
    // Permission errors or a missing channel must not break the scan.
  }
}
