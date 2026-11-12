export function formatBytes(bytes: number, digits = 1): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 1 : digits)} GB`;
  const mb = bytes / 1e6;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Marketed device capacities, in gigabytes (SI, 1e9 bytes). */
export const MARKETED_GB = [32, 64, 128, 256, 512, 1024, 2048] as const;

/** Smallest marketed capacity at or above the reported total. 255.4 GB → 256 GB; 1000 GB → 1 TB. */
export function marketedTotalBytes(reportedTotal: number): number {
  if (!isFinite(reportedTotal) || reportedTotal <= 0) return 0;
  const gb = reportedTotal / 1e9;
  const cap = MARKETED_GB.find((n) => n >= gb - 1e-9);
  return (cap ?? Math.ceil(gb)) * 1e9;
}

export function formatMarketedTotal(reportedTotal: number): string {
  const gb = marketedTotalBytes(reportedTotal) / 1e9;
  if (gb >= 1024) return `${gb / 1024} TB`;
  if (gb <= 0) return '0 GB';
  return `${gb} GB`;
}

/** Reported free bytes, shown next to a marketed total, e.g. "73 GB free of 256 GB". */
export function formatFreeAmount(freeBytes: number): string {
  if (!isFinite(freeBytes) || freeBytes <= 0) return '0 MB';
  const gb = freeBytes / 1e9;
  if (gb >= 10) return `${Math.round(gb)} GB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = freeBytes / 1e6;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round(freeBytes / 1e3))} KB`;
}

export function formatFreeOfTotal(freeBytes: number, reportedTotal: number): string {
  return `${formatFreeAmount(freeBytes)} free of ${formatMarketedTotal(reportedTotal)}`;
}
