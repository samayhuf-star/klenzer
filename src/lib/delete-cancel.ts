/**
 * PHPhotosError.userCancelled and NSUserCancelledError are both 3072.
 * expo-media-library wraps the Photos error as "Couldn't remove assets: … (PHPhotosErrorDomain error 3072.)"
 * when the person taps Don't Allow on the system delete prompt.
 */
const USER_CANCELLED_CODE = 3072;

function errorText(error: unknown, depth = 0): string {
  if (error == null || depth > 4) return '';
  if (typeof error === 'string' || typeof error === 'number') return String(error);
  if (typeof error !== 'object') return '';
  const obj = error as Record<string, unknown>;
  const bits = [obj.code, obj.message, obj.domain, obj.localizedDescription]
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .map(String);
  if ('cause' in obj) bits.push(errorText(obj.cause, depth + 1));
  if (obj.userInfo) bits.push(errorText(obj.userInfo, depth + 1));
  return bits.join(' ');
}

/** True when deleteAssets was declined. A false return is handled by the caller. */
export function isPhotoDeleteCancelled(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (code === USER_CANCELLED_CODE || code === String(USER_CANCELLED_CODE)) return true;
  }
  const text = errorText(error).toLowerCase();
  if (/\b3072\b/.test(text)) return true;
  if (/user[ -]?cancell?ed/.test(text)) return true;
  if (/operation (was|has been) cancell?ed/.test(text)) return true;
  return false;
}
