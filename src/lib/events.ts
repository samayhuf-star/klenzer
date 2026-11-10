import * as Calendar from 'expo-calendar/legacy';

export type EventItem = { id: string; title: string; start: number; end: number; calendar: string; allDay: boolean };
export type EventsAccess = 'granted' | 'denied' | 'undetermined';

const DAY = 86400000;
const YEARS_BACK = 8;

const toAccess = (p: { status: string }): EventsAccess => (p.status === 'granted' ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined');

export async function eventsAccess(): Promise<{ access: EventsAccess; canAskAgain: boolean }> {
  const p = await Calendar.getCalendarPermissionsAsync();
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

export async function requestEvents(): Promise<{ access: EventsAccess; canAskAgain: boolean }> {
  const p = await Calendar.requestCalendarPermissionsAsync();
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

/**
 * Events that ended more than `olderThanDays` ago, in calendars the user can edit.
 * Repeating events are skipped on purpose: deleting one removes the whole series, including future dates.
 */
export async function loadPastEvents(olderThanDays: number): Promise<{ events: EventItem[]; skippedRepeating: number }> {
  const calendars = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).filter((c) => c.allowsModifications);
  const names = new Map(calendars.map((c) => [c.id, c.title]));
  const ids = calendars.map((c) => c.id);
  if (!ids.length) return { events: [], skippedRepeating: 0 };

  const cutoff = Date.now() - olderThanDays * DAY;
  const seen = new Set<string>();
  const events: EventItem[] = [];
  let skippedRepeating = 0;
  // The system only answers for about four years at a time, so ask one year at a time.
  for (let i = 0; i < YEARS_BACK; i++) {
    const end = new Date(cutoff - i * 365 * DAY);
    const start = new Date(cutoff - (i + 1) * 365 * DAY);
    const batch = await Calendar.getEventsAsync(ids, start, end);
    for (const e of batch) {
      const endMs = new Date(e.endDate).getTime();
      if (seen.has(e.id) || endMs >= cutoff) continue;
      seen.add(e.id);
      if (e.recurrenceRule) {
        skippedRepeating++;
        continue;
      }
      events.push({ id: e.id, title: e.title?.trim() || 'Untitled event', start: new Date(e.startDate).getTime(), end: endMs, calendar: names.get(e.calendarId) ?? 'Calendar', allDay: !!e.allDay });
    }
  }
  return { events: events.sort((a, b) => b.start - a.start), skippedRepeating };
}

/** Permanently deletes the chosen events one by one. Returns how many were removed. */
export async function deleteEvents(events: EventItem[], onProgress: (done: number, total: number) => void): Promise<number> {
  let removed = 0;
  let done = 0;
  for (const e of events) {
    try {
      await Calendar.deleteEventAsync(e.id);
      removed++;
    } catch {
      // Read-only or already gone: skip it.
    }
    onProgress(++done, events.length);
  }
  return removed;
}
