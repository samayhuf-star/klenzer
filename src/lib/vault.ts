/**
 * Secret Album storage.
 *
 * Encryption: every photo, its thumbnail and the album index are sealed with AES-256-GCM using expo-crypto's native AES
 * (CryptoKit on iOS, javax.crypto on Android). The 256-bit key is generated on the device and kept only in the iOS Keychain /
 * Android Keystore through expo-secure-store (this device only, available while unlocked). Ciphertext lives in the app's
 * private document directory. The PIN is never stored: only a salted, iterated SHA-256 hash is kept in secure storage.
 * Viewing a full photo writes a temporary decrypted copy to the app cache, which is deleted when the viewer closes or the album locks.
 */
import { AESEncryptionKey, AESKeySize, AESSealedData, aesDecryptAsync, aesEncryptAsync, CryptoDigestAlgorithm, digestStringAsync, getRandomBytes, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as LocalAuthentication from 'expo-local-authentication';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as SecureStore from 'expo-secure-store';
import { addEntries, constantTimeEqual, extensionFor, parseIndex, removeEntry, VAULT_MAX_ITEM_BYTES, type VaultEntry, type VaultIndex } from './vault-logic';
import { PHOTO_PERMISSION_REQUEST } from './photo-access';

const SS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const K = { key: 'klenzer.vault.key.v1', pin: 'klenzer.vault.pin.v1', faceId: 'klenzer.vault.faceid.v1' };
const PIN_ITERATIONS = 1000;

const dir = () => new Directory(Paths.document, 'secret-album');
const viewDir = () => new Directory(Paths.cache, 'secret-album-view');
const dataFile = (id: string) => new File(dir(), `${id}.bin`);
const thumbFile = (id: string) => new File(dir(), `${id}.thumb.bin`);
const indexFile = () => new File(dir(), 'index.bin');

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function ensureDir(d: Directory) {
  if (!d.exists) d.create({ intermediates: true });
}

let keyCache: AESEncryptionKey | null = null;
async function key(): Promise<AESEncryptionKey> {
  if (keyCache) return keyCache;
  const hex = await SecureStore.getItemAsync(K.key, SS);
  if (hex) {
    keyCache = await AESEncryptionKey.import(hex, 'hex');
    return keyCache;
  }
  const fresh = await AESEncryptionKey.generate(AESKeySize.AES256);
  await SecureStore.setItemAsync(K.key, await fresh.encoded('hex'), SS);
  keyCache = fresh;
  return fresh;
}

async function seal(bytes: Uint8Array): Promise<Uint8Array> {
  const sealed = await aesEncryptAsync(bytes, await key());
  return sealed.combined('bytes');
}

async function open(file: File): Promise<Uint8Array> {
  return aesDecryptAsync(AESSealedData.fromCombined(await file.bytes()), await key());
}

async function openBase64(file: File): Promise<string> {
  return aesDecryptAsync(AESSealedData.fromCombined(await file.bytes()), await key(), { output: 'base64' });
}

// PIN

async function hashPin(pin: string, saltHex: string, iterations = PIN_ITERATIONS): Promise<string> {
  let h = `${saltHex}:${pin}`;
  for (let i = 0; i < iterations; i++) h = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${saltHex}${h}${pin}`);
  return h;
}

export async function hasPin(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(K.pin, SS));
}

export async function setPin(pin: string): Promise<void> {
  const salt = toHex(getRandomBytes(16));
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(K.pin, JSON.stringify({ salt, hash, iterations: PIN_ITERATIONS }), SS);
  await key(); // create the album key alongside the PIN
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(K.pin, SS);
  if (!raw) return false;
  try {
    const { salt, hash, iterations } = JSON.parse(raw) as { salt: string; hash: string; iterations: number };
    return constantTimeEqual(await hashPin(pin, salt, iterations), hash);
  } catch {
    return false;
  }
}

// Face ID

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function faceIdEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K.faceId, SS)) === '1';
}

export async function setFaceIdEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(K.faceId, on ? '1' : '0', SS);
}

/** Face ID only. The device passcode is not offered; the Klenzer PIN is the fallback. */
export async function unlockWithBiometrics(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Secret Album', cancelLabel: 'Use PIN', disableDeviceFallback: true });
    return r.success;
  } catch {
    return false;
  }
}

// Album

export async function loadIndex(): Promise<VaultIndex> {
  const f = indexFile();
  if (!f.exists) return parseIndex(null);
  try {
    return parseIndex(new TextDecoder().decode(await open(f)));
  } catch {
    return parseIndex(null);
  }
}

async function saveIndex(index: VaultIndex) {
  ensureDir(dir());
  const f = indexFile();
  f.write(await seal(new TextEncoder().encode(JSON.stringify(index))));
}

export type ImportSource = { uri: string; assetId?: string | null; fileName?: string | null; mimeType?: string | null; width: number; height: number; fileSize?: number };
export type ImportResult = { added: VaultEntry[]; skipped: number; assetIds: string[] };

/** Encrypt each picked photo into the album. Originals stay in Photos until the user chooses to delete them. */
export async function importItems(sources: ImportSource[]): Promise<ImportResult> {
  ensureDir(dir());
  const added: VaultEntry[] = [];
  const assetIds: string[] = [];
  let skipped = 0;
  for (const s of sources) {
    try {
      const src = new File(s.uri);
      const size = src.size ?? s.fileSize ?? 0;
      if (size > VAULT_MAX_ITEM_BYTES) {
        skipped++;
        continue;
      }
      const id = randomUUID();
      dataFile(id).write(await seal(await src.bytes()));
      const thumb = await ImageManipulator.manipulateAsync(s.uri, [{ resize: { width: 360 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      const thumbSrc = new File(thumb.uri);
      thumbFile(id).write(await seal(await thumbSrc.bytes()));
      try {
        thumbSrc.delete();
      } catch {}
      added.push({
        id,
        filename: s.fileName || `Photo-${id.slice(0, 8)}.jpg`,
        mime: s.mimeType || 'image/jpeg',
        width: s.width,
        height: s.height,
        size,
        createdAt: Date.now(),
        addedAt: Date.now(),
      });
      if (s.assetId) assetIds.push(s.assetId);
      // The picker hands over a plaintext copy in the app cache. Remove it so only the sealed copy remains.
      if (src.uri.startsWith(Paths.cache.uri)) {
        try {
          src.delete();
        } catch {}
      }
    } catch {
      skipped++;
    }
  }
  if (added.length) await saveIndex(addEntries(await loadIndex(), added));
  return { added, skipped, assetIds };
}

/** Decrypted thumbnail as an in-memory data URI. Nothing is written to disk. */
export async function thumbDataUri(entry: VaultEntry): Promise<string | null> {
  try {
    return `data:image/jpeg;base64,${await openBase64(thumbFile(entry.id))}`;
  } catch {
    return null;
  }
}

/** Decrypt the full photo to a temporary cache file for the viewer. Call clearViewCache when done. */
export async function openForViewing(entry: VaultEntry): Promise<string> {
  const d = viewDir();
  ensureDir(d);
  const out = new File(d, `${entry.id}.${extensionFor(entry.filename, entry.mime)}`);
  if (!out.exists) out.write(await open(dataFile(entry.id)));
  return out.uri;
}

export function clearViewCache() {
  try {
    const d = viewDir();
    if (d.exists) d.delete();
  } catch {}
}

/** Save a decrypted copy back into Photos. The album copy stays until the user removes it. */
export async function exportToPhotos(entry: VaultEntry): Promise<boolean> {
  try {
    // Ask for full read-write access first. Writing with no grant makes iOS give add-only access,
    // which later blocks the scan behind the "additional access" sheet.
    const p = await MediaLibrary.getPermissionsAsync(PHOTO_PERMISSION_REQUEST.writeOnly, PHOTO_PERMISSION_REQUEST.granular);
    if (p.status !== 'granted') {
      const r = await MediaLibrary.requestPermissionsAsync(PHOTO_PERMISSION_REQUEST.writeOnly, PHOTO_PERMISSION_REQUEST.granular);
      if (r.status !== 'granted') return false;
    }
    const uri = await openForViewing(entry);
    await MediaLibrary.createAssetAsync(uri);
    return true;
  } catch {
    return false;
  } finally {
    clearViewCache();
  }
}

export async function removeFromAlbum(entry: VaultEntry): Promise<void> {
  for (const f of [dataFile(entry.id), thumbFile(entry.id)]) {
    try {
      if (f.exists) f.delete();
    } catch {}
  }
  await saveIndex(removeEntry(await loadIndex(), entry.id));
}

/** Delete the originals from Photos. iOS shows its own confirmation and moves them to Recently Deleted. */
export async function deleteOriginals(assetIds: string[]): Promise<boolean> {
  if (!assetIds.length) return false;
  try {
    return await MediaLibrary.deleteAssetsAsync(assetIds);
  } catch {
    return false;
  }
}

/** Forget the key from memory when the album locks. */
export function lockAlbum() {
  keyCache = null;
  clearViewCache();
}
