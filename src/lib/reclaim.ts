import { readyToReviewBytes, type ScanResult } from './scan-logic';

/** Library clutter a completed (or partial) scan has actually measured, excluding Klenzer's own cache. */
export function scanReclaimableBytes(r: ScanResult | null): number {
  return readyToReviewBytes(r);
}

/** Everything a scan found that Klenzer could clear, in bytes. Used for reminders. */
export function reclaimableBytes(r: ScanResult | null, tempSize = 0): number {
  if (!r) return 0;
  return scanReclaimableBytes(r) + tempSize;
}
