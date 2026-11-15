/** Display progress. The percent and the "X of Y" line are the same ratio. */

export function alignDisplayedProgress(done: number, total: number): { done: number; total: number; percent: number } {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const safeDone = Number.isFinite(done) ? Math.max(0, Math.min(safeTotal, Math.floor(done))) : 0;
  const percent = safeTotal > 0 ? Math.min(100, Math.round((safeDone / safeTotal) * 100)) : 0;
  return { done: safeDone, total: safeTotal, percent };
}

/**
 * One category's own bar. Never copies the overall percent.
 * A running category with no total yet is 0, not a placeholder.
 */
export function categoryBarPercent(cat: { status: string; done: number; total: number }): number {
  const total = Number.isFinite(cat.total) ? cat.total : 0;
  const done = Number.isFinite(cat.done) ? cat.done : 0;
  if (total <= 0) return cat.status === 'done' ? 100 : 0;
  if (cat.status === 'done') return 100;
  return Math.max(0, Math.min(99, Math.round((done / total) * 100)));
}
