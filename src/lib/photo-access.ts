/**
 * Photos access rules for the scanner. Pure so Node tests can cover them.
 *
 * Klenzer needs FULL read-write access to scan. It must never ask for add-only access:
 * an add-only grant (from a write such as saving a photo before any read request) makes iOS
 * show the "additional access" sheet (Limit Access / Allow Full Access / Keep Add Only) later,
 * and the scan cannot read the library on add-only.
 */
export type PhotoAccess = 'unknown' | 'granted' | 'limited' | 'denied';

/** Arguments for expo-media-library's (legacy) get/requestPermissionsAsync: writeOnly=false is read-write. */
export const PHOTO_PERMISSION_REQUEST = { writeOnly: false, granular: ['photo', 'video'] as ('photo' | 'video')[] } as const;

export type PermissionLike = { status: string; accessPrivileges?: string | null; canAskAgain?: boolean };

export function toPhotoAccess(p: PermissionLike | null | undefined): PhotoAccess {
  if (!p) return 'unknown';
  if (p.status === 'granted') return p.accessPrivileges === 'limited' ? 'limited' : 'granted';
  if (p.status === 'denied') return 'denied';
  return 'unknown';
}

export const canScan = (a: PhotoAccess) => a === 'granted' || a === 'limited';

/**
 * What a Scan / Smart Clean tap must do. A tap always leads to a scan once access exists;
 * asking for access is part of the same tap, never a dead end.
 */
export function scanStartAction(a: PhotoAccess, canAskAgain: boolean): 'scan' | 'request-then-scan' | 'open-settings' {
  if (canScan(a)) return 'scan';
  if (a === 'denied' && !canAskAgain) return 'open-settings';
  return 'request-then-scan';
}

/**
 * Called when the app becomes active again or the permission changes (for example after the
 * Photos sheet or Settings). Start the scan the user already asked for once access now allows it.
 */
export function shouldStartScanAfterAccessChange(opts: {
  prev: PhotoAccess;
  next: PhotoAccess;
  pendingScan: boolean;
  scanning: boolean;
}): boolean {
  if (opts.scanning || !opts.pendingScan) return false;
  return canScan(opts.next);
}
