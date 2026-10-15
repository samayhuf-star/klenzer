import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatBytes } from './format';

/**
 * Local, on-device reminders only: no push server, no tokens, no data leaves the phone.
 * They are opt-in, capped, and pushed back every time the user opens the app, so people who
 * use Klenzer regularly are not nagged and lapsed users hear from us only a handful of times.
 */
const KEY = 'klenzer.reminders.v1';
const CHANNEL = 'reminders';
const HOUR = 10; // local time: late enough to be polite
const DAYS_AFTER_LAST_OPEN = [2, 5, 10, 21, 45];

const COPY = [
  { title: 'Quick tidy?', body: 'A 1-minute scan can show new duplicates and screenshots piling up in your camera roll.' },
  { title: 'Your camera roll grows every day', body: 'See what’s taking up space now. You choose what goes; nothing is deleted without your OK.' },
  { title: 'Screenshots add up', body: 'Open Klenzer to review new screenshots and big videos. Takes about a minute.' },
  { title: 'Time for a storage check', body: 'Scan your library to see what’s worth clearing. Everything stays on your device.' },
  { title: 'Still need more space?', body: 'A fresh scan finds duplicates and large videos you may have added since last time.' },
];

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
export async function scheduleReminders(opts: { pendingBytes?: number } = {}): Promise<void> {
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
    for (let i = 0; i < DAYS_AFTER_LAST_OPEN.length; i++) {
      await Notifications.scheduleNotificationAsync({
        content: COPY[i % COPY.length],
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at(DAYS_AFTER_LAST_OPEN[i]), channelId },
      });
    }
  } catch {}
}

/** Asks the OS for permission (first call shows the system prompt). Returns whether reminders are now on. */
export async function enableReminders(pendingBytes?: number): Promise<boolean> {
  try {
    let state = await permissionState();
    if (state === 'undetermined') {
      const r = await Notifications.requestPermissionsAsync();
      state = r.granted ? 'granted' : 'denied';
    }
    if (state !== 'granted') return false;
    await savePref(true);
    await scheduleReminders({ pendingBytes });
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
