import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatBytes } from './format';

/**
 * Local, on-device reminders only: no push server, no tokens, no data leaves the phone.
 * They are opt-in, capped, and pushed back every time the user opens the app, so people who
 * use Klenzer regularly are not nagged. Lapsed users hear from us every 3 days with their storage numbers.
 */
const KEY = 'klenzer.reminders.v1';
const ASKED_KEY = 'klenzer.reminders.asked.v1';
const CHANNEL = 'reminders';
const HOUR = 10; // local time: late enough to be polite
const EVERY_DAYS = 3;
const COUNT = 20; // about two months of reminders; iOS allows 64 pending local notifications

export type ReminderInfo = {
  pendingBytes?: number; // still sitting in Recently Deleted
  usedBytes?: number;
  totalBytes?: number;
  reclaimBytes?: number; // what the last scan found Klenzer can clear
};

/** Every reminder says how full the phone is, because a number is more persuasive than a nudge. */
function message(i: ReminderInfo, n: number): { title: string; body: string } {
  const pct = i.totalBytes && i.usedBytes ? Math.round((i.usedBytes / i.totalBytes) * 100) : 0;
  const used = i.usedBytes && i.totalBytes ? `${formatBytes(i.usedBytes)} of ${formatBytes(i.totalBytes, 0)} used` : '';
  if (i.reclaimBytes && i.reclaimBytes > 0) {
    return n % 2 === 0
      ? { title: `${formatBytes(i.reclaimBytes)} can be cleared`, body: `${used ? `Your storage is ${pct}% full (${used}). ` : ''}Open Klenzer to free it in one tap.` }
      : { title: pct ? `Your phone is ${pct}% full` : 'Time for a storage check', body: `Duplicates, screenshots and big videos are ready to clear: ${formatBytes(i.reclaimBytes)} in total.` };
  }
  return {
    title: pct ? `Your phone is ${pct}% full` : 'Time for a storage check',
    body: used ? `${used}. A 1-minute scan shows what you can clear.` : 'A 1-minute scan shows duplicates and big videos you can clear.',
  };
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

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

const at = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(HOUR, 0, 0, 0);
  return d;
};

/** Clears and re-plans every reminder, counted from now (call on each app open). */
export async function scheduleReminders(opts: ReminderInfo = {}): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await remindersPref()) || (await permissionState()) !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const channelId = Platform.OS === 'android' ? CHANNEL : undefined;

    if (opts.pendingBytes && opts.pendingBytes > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Finish freeing your space',
          body: `${formatBytes(opts.pendingBytes)} is still in Recently Deleted. Empty it in Photos to get the space back.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at(1), channelId },
      });
    }
    for (let i = 1; i <= COUNT; i++) {
      await Notifications.scheduleNotificationAsync({
        content: message(opts, i),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at(i * EVERY_DAYS), channelId },
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
