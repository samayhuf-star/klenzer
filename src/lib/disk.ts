import { Paths } from 'expo-file-system';
import { getFreeDiskStorageAsync, getTotalDiskCapacityAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type DiskInfo = { total: number; free: number; used: number };

const make = (total: number, free: number): DiskInfo => ({ total, free, used: Math.max(0, total - free) });

/** Instant first guess (raw free bytes) so the ring isn't empty on first paint. */
export function getDiskInfoSync(): DiskInfo {
  return make(Paths.totalDiskSpace ?? 0, Paths.availableDiskSpace ?? 0);
}

/**
 * Real device capacity, as the OS reports it to the user.
 * On iOS this is "available for important usage", which is the figure Settings › General › iPhone Storage shows.
 * The raw free-bytes value excludes space iOS can purge on demand, so it swings by gigabytes as the system
 * fills and empties its caches, and it never matches Settings.
 */
export async function getDiskInfo(): Promise<DiskInfo> {
  if (Platform.OS === 'ios') {
    try {
      const [total, free] = await Promise.all([getTotalDiskCapacityAsync(), getFreeDiskStorageAsync()]);
      if (total > 0 && free >= 0) return make(total, free);
    } catch {}
  }
  return getDiskInfoSync();
}
