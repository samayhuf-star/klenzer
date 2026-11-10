import { dupReclaimable, ScanResult, sum } from './scanner';

/** Everything a scan found that Klenzer could clear, in bytes. Used for the paywall headline and reminders. */
export function reclaimableBytes(r: ScanResult | null, tempSize = 0): number {
  if (!r) return 0;
  return dupReclaimable(r.duplicates) + sum(r.screenshots) + sum(r.largeVideos) + sum(r.livePhotos) + tempSize;
}
