import { dupReclaimable, ScanResult, sum } from './scanner';

/** Library clutter a completed (or partial) scan has actually measured, excluding Klenzer's own cache. */
export function scanReclaimableBytes(r: ScanResult | null): number {
  if (!r) return 0;
  return (
    dupReclaimable(r.duplicates) +
    dupReclaimable(r.similar) +
    dupReclaimable(r.duplicateVideos) +
    sum(r.screenshots) +
    sum(r.largeVideos) +
    sum(r.livePhotos) +
    sum(r.blurry)
  );
}

/** Everything a scan found that Klenzer could clear, in bytes. Used for reminders. */
export function reclaimableBytes(r: ScanResult | null, tempSize = 0): number {
  if (!r) return 0;
  return scanReclaimableBytes(r) + tempSize;
}
