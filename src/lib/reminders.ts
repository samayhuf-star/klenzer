import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { APP_SHORT_NAME } from './config';
import { nextReminderDates, REMINDER_COUNT, REMINDER_TITLE, reminderBody, shouldScheduleReminders } from './reminder-plan';
import { syncPush } from './push';
import { scanCompleteBody } from './scan-complete';
export { scanCompleteBody };

/**
 * Local, on-device reminders: scheduled by the phone itself, no server involved.
 * Remote push (OneSignal) is separate, lives in ./push, and has its own opt-in switch in Settings.
 * On by default. A local notification every 3 days at 8:00 AM, rewritten whenever the
 * app opens so the size stays current. Buying Pro does not cancel them. The Settings
 * toggle always can. Notification permission is requested by the caller, never from here
 * on a cold launch.
 */
const KEY = 'klenzer.reminders.v1';
const ASKED_KEY = 'klenzer.reminders.asked.v1';
const CHANNEL = 'reminders';
const SCAN_COMPLETE_CHANNEL = 'scan-complete';
export const SCAN_NOTIFICATION_ACTION = 'scan';
export const REMINDER_ACTION = 'reminder';

const HOUR_KEY = 'klenzer.reminders.hour.v1';

/** Hour (0 to 23) the person picked in onboarding. Unset means the default 8:00. */
export async function reminderHourPref(): Promise<number | undefined> {
  try {
    const raw = await AsyncStorage.getItem(HOUR_KEY);
    const n = raw == null ? NaN : parseInt(raw, 10);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : undefined;
  } catch {
    return undefined;
  }
}

export async function saveReminderHour(hour: number): Promise<void> {
  try {
    await AsyncStorage.setItem(HOUR_KEY, String(hour));
  } catch {}
}

export type ReminderInfo = {
  /** Bytes the last scan found ready to review. Omitted or 0 uses the generic line. */
  reclaimBytes?: number;
  /**
   * Passed through so a future copy change can branch on purchase status.
   * 1.1.1 keeps the schedule after Pro; only the toggle and permission cancel it.
   */
  isPro?: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export function isScanNotification(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return (data as { action?: string }).action === SCAN_NOTIFICATION_ACTION;
}

/** Unset means on. Only an explicit 'off' from the Settings toggle disables reminders. */
export async function remindersPref(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== 'off';
  } catch {
    return true;
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

/**
 * Clears and re-plans the 8:00 AM reminders (call on each app open / foreground).
 * Does not ask for permission. Does not delete photos.
 */
export async function scheduleReminders(opts: ReminderInfo = {}): Promise<void> {
  try {
    const enabled = await remindersPref();
    const granted = (await permissionState()) === 'granted';
    // Remote push follows its own opt-in; revoking the OS permission unsubscribes the device.
    await syncPush(granted);
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!shouldScheduleReminders({ enabled, permissionGranted: granted, isPro: opts.isPro })) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const body = reminderBody(opts.reclaimBytes ?? 0);
    const dates = nextReminderDates(new Date(), REMINDER_COUNT, undefined, await reminderHourPref());
    for (const date of dates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: REMINDER_TITLE,
          body,
          data: { action: REMINDER_ACTION },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: Platform.OS === 'android' ? CHANNEL : undefined,
        },
      });
    }
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

/**
 * Records that the user wants reminders, then asks the OS if it has not been asked yet.
 * Returns whether the system will actually deliver them. The preference stays on either way
 * so the Settings switch matches the choice; a denial is reported to the caller.
 */
export async function enableReminders(info: ReminderInfo = {}): Promise<boolean> {
  try {
    await savePref(true);
    let state = await permissionState();
    if (state === 'undetermined') {
      const r = await Notifications.requestPermissionsAsync();
      state = r.granted ? 'granted' : 'denied';
    }
    if (state !== 'granted') return false;
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
        title: APP_SHORT_NAME,
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
