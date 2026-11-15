import { File, Paths } from 'expo-file-system';
import type { ScanResult } from './scan-logic';
import { parseStoredScanResult, serializeScanResult } from './scan-result-parse';

/** Last finished (or partial) scan, so a later launch can show it without scanning again. */
const file = () => new File(Paths.document, 'scan-result.json');

export async function loadScanResult(): Promise<ScanResult | null> {
  try {
    const f = file();
    if (!f.exists) return null;
    return parseStoredScanResult(await f.text());
  } catch {
    return null;
  }
}

export async function saveScanResult(result: ScanResult): Promise<void> {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(serializeScanResult(result));
  } catch {
    // A full library can be large. Failing to cache must not fail the scan.
  }
}
