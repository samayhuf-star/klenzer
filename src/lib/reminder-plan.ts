import { formatBytes } from './format';

/** Local reminder: every 3 days at 8:00 AM in the device timezone. */
export const REMINDER_HOUR = 8;
export const REMINDER_MINUTE = 0;
export const REMINDER_INTERVAL_DAYS = 3;
/** Enough upcoming dates that a quiet phone still gets a nudge, under iOS's 64 pending limit. */
export const REMINDER_COUNT = 16;
export const REMINDER_TITLE = 'Time for a quick cleanup';

/**
 * Whether to keep local reminders scheduled.
 * Purchase status does not cancel them: Ai Klenzer 1.1.1 sells Pro, and a
 * customer who upgrades keeps the reminders until they turn the Settings toggle off.
 * `isPro` is accepted so a later copy change can branch on it. It is not a switch.
 */
export function shouldScheduleReminders(input: { enabled: boolean; permissionGranted: boolean; isPro?: boolean }): boolean {
  void input.isPro;
  return input.enabled && input.permissionGranted;
}

/** Next local 8:00 AM, then every 3 days. Every date is strictly after `now`. */
export function nextReminderDates(now: Date, count = REMINDER_COUNT, intervalDays = REMINDER_INTERVAL_DAYS): Date[] {
  const n = Math.max(0, Math.floor(count));
  const step = Math.max(1, Math.floor(intervalDays));
  const first = new Date(now.getTime());
  first.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  if (first.getTime() <= now.getTime()) first.setDate(first.getDate() + 1);
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(first.getTime());
    d.setDate(first.getDate() + i * step);
    out.push(d);
  }
  return out;
}

/** Notification body. No medical claims, and no "AI" beyond the product name not used here. */
export function reminderBody(reclaimBytes: number): string {
  if (Number.isFinite(reclaimBytes) && reclaimBytes > 0) {
    return `${formatBytes(reclaimBytes)} is ready to review. Open Ai Klenzer and choose what to remove.`;
  }
  return 'Open Ai Klenzer to review your library and choose what to remove.';
}
