import { formatBytes } from './format';

/** Copy for the scan-finished local notification. Uses the real reclaimable size. */
export function scanCompleteBody(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Scan complete: your library looks clean';
  return `Scan complete: ${formatBytes(bytes)} can be freed`;
}
