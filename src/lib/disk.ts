import { Paths } from 'expo-file-system';

export type DiskInfo = { total: number; free: number; used: number };

/** Real device capacity, as reported by the OS. */
export function getDiskInfo(): DiskInfo {
  const total = Paths.totalDiskSpace ?? 0;
  const free = Paths.availableDiskSpace ?? 0;
  return { total, free, used: Math.max(0, total - free) };
}
