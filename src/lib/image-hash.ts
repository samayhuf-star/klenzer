import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

const DHASH_W = 9;
const DHASH_H = 8;
/** Conservative Laplacian-variance cutoff on a 32×32 grayscale thumbnail. Lower = blurrier. */
export const BLUR_THRESHOLD = 80;

function b64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function grayscale(data: Uint8Array, width: number, height: number): Float64Array {
  const g = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    g[i] = data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114;
  }
  return g;
}

function sample(gray: Float64Array, srcW: number, srcH: number, dw: number, dh: number): Float64Array {
  const small = new Float64Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(srcW - 1, Math.floor(((x + 0.5) * srcW) / dw));
      const sy = Math.min(srcH - 1, Math.floor(((y + 0.5) * srcH) / dh));
      small[y * dw + x] = gray[sy * srcW + sx];
    }
  }
  return small;
}

export function dHashFromGray(gray: Float64Array, srcW: number, srcH: number): string {
  const small = sample(gray, srcW, srcH, DHASH_W, DHASH_H);
  let bits = '';
  for (let y = 0; y < DHASH_H; y++) {
    for (let x = 0; x < DHASH_W - 1; x++) {
      bits += small[y * DHASH_W + x] > small[y * DHASH_W + x + 1] ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      n += x & 1;
      x >>= 1;
    }
  }
  return n;
}

export function laplacianVariance(gray: Float64Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let c = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i - width] + gray[i - 1] + gray[i + 1] + gray[i + width] - 4 * gray[i];
      sum += v;
      sumSq += v * v;
      c++;
    }
  }
  if (!c) return 0;
  const mean = sum / c;
  return sumSq / c - mean * mean;
}

export function isBlurry(variance: number): boolean {
  return variance > 0 && variance < BLUR_THRESHOLD;
}

function toFileUri(uri: string): string {
  if (uri.startsWith('/') && !uri.startsWith('file://')) return `file://${uri}`;
  return uri;
}

/** Resize a local image to 32×32, then compute dHash and Laplacian variance. Never downloads from iCloud. */
export async function analyzeThumb(localUri: string): Promise<{ dhash: string; blur: number } | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      toFileUri(localUri),
      [{ resize: { width: 32, height: 32 } }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (result.uri) {
      try {
        new File(result.uri).delete();
      } catch {}
    }
    if (!result.base64) return null;
    const decoded = jpeg.decode(b64ToBytes(result.base64), { useTArray: true, maxMemoryUsageInMB: 8 });
    const gray = grayscale(decoded.data as Uint8Array, decoded.width, decoded.height);
    return {
      dhash: dHashFromGray(gray, decoded.width, decoded.height),
      blur: laplacianVariance(gray, decoded.width, decoded.height),
    };
  } catch {
    return null;
  }
}
