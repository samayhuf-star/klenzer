import * as LocalAuthentication from 'expo-local-authentication';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Directory, File, Paths } from 'expo-file-system';

export type VaultItem = { name: string; uri: string; isVideo: boolean; size: number; addedAt: number };

const VIDEO = /\.(mov|mp4|m4v|3gp|webm)$/i;
const dir = () => new Directory(Paths.document, 'secret-space');
const ensure = () => {
  const d = dir();
  if (!d.exists) d.create();
  return d;
};

/** Face ID / fingerprint, falling back to the device passcode. Secret Space is never reachable without it. */
export async function unlockVault(): Promise<'ok' | 'cancelled' | 'no-lock'> {
  // No biometrics and no passcode set means there is nothing to protect the vault with.
  if ((await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE) return 'no-lock';
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Secret Space', cancelLabel: 'Cancel' });
  return r.success ? 'ok' : 'cancelled';
}

export function listVault(): VaultItem[] {
  try {
    const d = dir();
    if (!d.exists) return [];
    return d
      .list()
      .filter((e): e is File => e instanceof File)
      .map((f) => ({ name: f.name, uri: f.uri, isVideo: VIDEO.test(f.name), size: f.size ?? 0, addedAt: Number(f.name.split('__')[0]) || 0 }))
      .sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

const safe = (n: string) => n.replace(/[^\w.\-]+/g, '_');

/** Copies library items into the vault. Returns the ids that are now safely stored (and so safe to remove from Photos). */
export async function hideAssets(
  assets: { id: string; filename: string; creationTime: number }[],
  onProgress: (done: number, total: number) => void,
): Promise<string[]> {
  const d = ensure();
  const ok: string[] = [];
  let done = 0;
  for (const a of assets) {
    try {
      // iCloud-only originals are downloaded first; a vault copy has to be the real file.
      const info = await MediaLibrary.getAssetInfoAsync(a.id, { shouldDownloadFromNetwork: true });
      if (info.localUri) {
        const dest = new File(d, `${Date.now()}${String(ok.length).padStart(3, '0')}__${safe(a.filename)}`);
        await new File(info.localUri).copy(dest);
        if (dest.exists && dest.size > 0) ok.push(a.id);
      }
    } catch {
      // This one stays in Photos.
    }
    onProgress(++done, assets.length);
  }
  return ok;
}

/** Puts vault items back into the photo library, then removes them from the vault. */
export async function restoreItems(items: VaultItem[]): Promise<number> {
  let n = 0;
  for (const it of items) {
    try {
      await MediaLibrary.createAssetAsync(it.uri);
      new File(it.uri).delete();
      n++;
    } catch {
      // Kept in the vault if the library refused it.
    }
  }
  return n;
}

export function deleteVaultItems(items: VaultItem[]): number {
  let n = 0;
  for (const it of items) {
    try {
      new File(it.uri).delete();
      n++;
    } catch {}
  }
  return n;
}
