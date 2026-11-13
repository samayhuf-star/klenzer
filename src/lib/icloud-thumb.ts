import { withTimeout } from './scan-logic';

/**
 * Duplicate, Similar and Blurry hash a 32×32 copy of each photo. When the original lives only in
 * iCloud, the scan asks Photos for a small thumbnail instead (never the full-size original).
 * These values mirror PHImageRequestOptions in modules/live-photo-convert/ios/ScanThumb.swift.
 */
export const ICLOUD_THUMB_PX = 256;
export const ICLOUD_THUMB_MAX_PX = 300;
export const ICLOUD_THUMB_TIMEOUT_MS = 10000;
export const ICLOUD_THUMB_REQUEST = {
  networkAccessAllowed: true,
  deliveryMode: 'fastFormat',
  resizeMode: 'fast',
  synchronous: false,
  targetPx: ICLOUD_THUMB_PX,
} as const;

export type ThumbAnalysis = { dhash: string; blur: number };

export type ThumbIO = {
  /** Resize a local file to 32×32 and compute dHash and blur. */
  analyze: (fileUri: string) => Promise<ThumbAnalysis | null>;
  /** Ask Photos for a small thumbnail, iCloud allowed. Resolves to a temp file URI or null. */
  fetchCloudThumb: (id: string, targetPx: number, timeoutMs: number) => Promise<string | null>;
  removeFile: (fileUri: string) => void;
  /**
   * Native analysis straight from a small Photos thumbnail (iOS). When present it is used for every
   * photo, local or iCloud, and the local-file + image-manipulator path is never touched.
   */
  analyzeNative?: (id: string, targetPx: number, timeoutMs: number) => Promise<ThumbAnalysis | null>;
  hashTimeoutMs: number;
  cloudTimeoutMs?: number;
};

export function clampThumbPx(px: number): number {
  if (!Number.isFinite(px)) return ICLOUD_THUMB_PX;
  return Math.max(32, Math.min(ICLOUD_THUMB_MAX_PX, Math.round(px)));
}

/**
 * Analyze one photo for Duplicate, Similar and Blurry. Local originals are read as before.
 * iCloud-only photos get a small thumbnail; a failed or slow fetch returns null so the scan
 * skips the photo and keeps moving.
 */
export async function analyzeForScan(id: string, localUri: string | null, io: ThumbIO): Promise<ThumbAnalysis | null> {
  const cloudMs = io.cloudTimeoutMs ?? ICLOUD_THUMB_TIMEOUT_MS;
  if (io.analyzeNative) {
    // Native cancels its Photos request at cloudMs; the outer guard covers a bridge that never answers.
    try {
      return await withTimeout(io.analyzeNative(id, clampThumbPx(ICLOUD_THUMB_REQUEST.targetPx), cloudMs), cloudMs + 1000, null);
    } catch {
      return null;
    }
  }

  if (localUri) return withTimeout(io.analyze(localUri), io.hashTimeoutMs, null);

  // The native side cancels its own request at cloudMs; this outer guard covers a bridge that never answers.
  const thumb = await withTimeout(io.fetchCloudThumb(id, clampThumbPx(ICLOUD_THUMB_REQUEST.targetPx), cloudMs), cloudMs + 1000, null);
  if (!thumb) return null;
  try {
    return await withTimeout(io.analyze(thumb), io.hashTimeoutMs, null);
  } finally {
    try {
      io.removeFile(thumb);
    } catch {}
  }
}
