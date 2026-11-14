/** Swipe to Organize: month grouping, swipe decisions, undo, progress and the delete batch. Pure, so unit tests run in Node. */

export type SwipeItem = { id: string; creationTime: number; size: number };
export type Decision = 'keep' | 'delete';
export type SwipeState = { decisions: Record<string, Decision>; history: string[] };
export type MonthGroup<T extends SwipeItem> = { key: string; label: string; items: T[] };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const emptySwipe = (): SwipeState => ({ decisions: {}, history: [] });

/** Local calendar month, e.g. "2026-03". */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

/** Newest month first; oldest photo first inside each month, so a month reads like a camera roll. */
export function groupByMonth<T extends SwipeItem>(items: T[]): MonthGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = monthKey(it.creationTime);
    const list = map.get(k);
    if (list) list.push(it);
    else map.set(k, [it]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, list]) => ({ key, label: monthLabel(key), items: [...list].sort((a, b) => a.creationTime - b.creationTime) }));
}

/** Left marks for deletion, right keeps. Swiping an item again replaces its earlier decision. */
export function swipe(state: SwipeState, id: string, direction: 'left' | 'right'): SwipeState {
  const decision: Decision = direction === 'left' ? 'delete' : 'keep';
  return {
    decisions: { ...state.decisions, [id]: decision },
    history: [...state.history.filter((h) => h !== id), id],
  };
}

/** Undo the last swipe. Returns the same state when there is nothing to undo. */
export function undo(state: SwipeState): { state: SwipeState; restoredId: string | null } {
  const id = state.history[state.history.length - 1];
  if (!id) return { state, restoredId: null };
  const decisions = { ...state.decisions };
  delete decisions[id];
  return { state: { decisions, history: state.history.slice(0, -1) }, restoredId: id };
}

/** Items in this month that have not been swiped yet, in order. The first one is the top card. */
export const pending = <T extends SwipeItem>(items: T[], state: SwipeState) => items.filter((i) => !state.decisions[i.id]);

/** Whole-number percent of the month that has been swiped. */
export function progressPercent(items: SwipeItem[], state: SwipeState): number {
  if (!items.length) return 100;
  const done = items.filter((i) => state.decisions[i.id]).length;
  return Math.round((done / items.length) * 100);
}

/** Items marked for deletion, in month order: the one batch sent to the system delete prompt. */
export const deleteBatch = <T extends SwipeItem>(items: T[], state: SwipeState) => items.filter((i) => state.decisions[i.id] === 'delete');

/** Running "to be released" size of everything marked for deletion. */
export const releaseBytes = (items: SwipeItem[], state: SwipeState) => deleteBatch(items, state).reduce((n, i) => n + (i.size || 0), 0);

/** After a delete, forget the decisions for ids that no longer exist so undo cannot bring them back. */
export function pruneDeleted(state: SwipeState, goneIds: Iterable<string>): SwipeState {
  const gone = new Set(goneIds);
  const decisions: Record<string, Decision> = {};
  for (const [id, d] of Object.entries(state.decisions)) if (!gone.has(id)) decisions[id] = d;
  return { decisions, history: state.history.filter((h) => !gone.has(h)) };
}

/** Split a large batch into chunks for the system prompt. */
export function chunk<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
