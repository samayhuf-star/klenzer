/**
 * When a library scan is allowed to start.
 * Cold start, returning from background, and tapping a notification never start one.
 * Granting photo access on the onboarding screen, or tapping Scan / Rescan, does.
 * A scan never deletes anything.
 */
export type ScanStartReason =
  | 'cold-start'
  | 'foreground'
  | 'notification'
  | 'onboarding-granted'
  | 'user-tapped-scan';

export function shouldStartScan(reason: ScanStartReason): boolean {
  return reason === 'onboarding-granted' || reason === 'user-tapped-scan';
}
