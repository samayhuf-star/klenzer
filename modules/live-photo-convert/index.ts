import { Platform } from 'react-native';

export type PairedVideoSize = { id: string; videoBytes: number };

export type ConvertResult = {
  convertedIds: string[];
  createdIds: string[];
  skippedIds: string[];
  pendingIds: string[];
  videoBytesSaved: number;
};

type NativeAPI = {
  pairedVideoSizes: (ids: string[]) => Promise<PairedVideoSize[]>;
  convertToStills: (ids: string[]) => Promise<ConvertResult>;
  scanThumb?: (id: string, targetPx: number, timeoutMs: number) => Promise<string | null>;
  scanAnalyze?: (id: string, targetPx: number, timeoutMs: number) => Promise<{ ok: boolean; dhash?: string; blur?: number } | null>;
  beginShortBackgroundTask?: () => void;
  endShortBackgroundTask?: () => void;
};

const loadNative = (): NativeAPI | null => {
  if (Platform.OS !== 'ios') return null;
  try {
    // Optional so Android and tests do not throw if the module is not linked.
    const { requireOptionalNativeModule } = require('expo') as {
      requireOptionalNativeModule: (name: string) => NativeAPI | null;
    };
    return requireOptionalNativeModule('LivePhotoConvert');
  } catch {
    return null;
  }
};

const Native = loadNative();

export const isConvertSupported = Platform.OS === 'ios' && Native != null;

export async function pairedVideoSizes(ids: string[]): Promise<PairedVideoSize[]> {
  if (!ids.length) return [];
  if (!Native) return ids.map((id) => ({ id, videoBytes: 0 }));
  return Native.pairedVideoSizes(ids);
}

export async function convertToStills(ids: string[]): Promise<ConvertResult> {
  if (!Native) {
    throw new Error('Convert to still is available on iPhone.');
  }
  return Native.convertToStills(ids);
}

/** Small scan thumbnail from Photos, iCloud allowed. Temp JPEG file URI, or null if unavailable. */
export async function scanThumb(id: string, targetPx: number, timeoutMs: number): Promise<string | null> {
  if (!Native?.scanThumb) return null;
  try {
    return (await Native.scanThumb(id, targetPx, timeoutMs)) ?? null;
  } catch {
    return null;
  }
}

/** True when this build can hash and blur-check photos natively from a small Photos thumbnail. */
export const isScanAnalyzeSupported = Platform.OS === 'ios' && typeof Native?.scanAnalyze === 'function';

/**
 * dHash and blur for one photo, computed natively from a small Photos thumbnail (iCloud allowed,
 * never the full-size original). Null on failure or timeout so the scan skips the photo.
 */
export async function scanAnalyze(id: string, targetPx: number, timeoutMs: number): Promise<{ dhash: string; blur: number } | null> {
  if (!Native?.scanAnalyze) return null;
  try {
    const r = await Native.scanAnalyze(id, targetPx, timeoutMs);
    if (!r || !r.ok || typeof r.dhash !== 'string' || r.dhash.length !== 16 || typeof r.blur !== 'number' || !Number.isFinite(r.blur)) return null;
    return { dhash: r.dhash, blur: r.blur };
  } catch {
    return null;
  }
}

/** Ask iOS for a short remaining-time window. No-op on Android, web, or if unlinked. */
export function beginShortBackgroundTask(): void {
  try {
    Native?.beginShortBackgroundTask?.();
  } catch {}
}

export function endShortBackgroundTask(): void {
  try {
    Native?.endShortBackgroundTask?.();
  } catch {}
}
