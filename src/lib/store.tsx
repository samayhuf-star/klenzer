import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { DiskInfo, getDiskInfo } from './disk';
import { deleteItems, Item, Progress, ScanResult, scanLibrary } from './scanner';

type Access = 'unknown' | 'granted' | 'limited' | 'denied';

type Ctx = {
  ready: boolean;
  onboarded: boolean;
  finishOnboarding: () => void;
  access: Access;
  canAskAgain: boolean;
  requestAccess: () => Promise<Access>;
  openSettings: () => void;
  manageLimited: () => Promise<void>;
  disk: DiskInfo;
  refreshDisk: () => void;
  scanning: boolean;
  progress: Progress | null;
  result: ScanResult | null;
  scan: () => Promise<void>;
  cancelScan: () => void;
  remove: (items: Item[]) => Promise<boolean>;
  lifetimeFreed: number;
  lastFreed: { bytes: number; count: number } | null;
};

const KEYS = { onboarded: 'klenzer.onboarded.v1', freed: 'klenzer.freed.v1' };
const StoreCtx = createContext<Ctx>(null as never);
export const useStore = () => useContext(StoreCtx);

const toAccess = (p: MediaLibrary.PermissionResponse): Access =>
  p.status === 'granted' ? (p.accessPrivileges === 'limited' ? 'limited' : 'granted') : p.status === 'denied' ? 'denied' : 'unknown';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [access, setAccess] = useState<Access>('unknown');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [disk, setDisk] = useState<DiskInfo>(() => getDiskInfo());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [lifetimeFreed, setLifetimeFreed] = useState(0);
  const [lastFreed, setLastFreed] = useState<{ bytes: number; count: number } | null>(null);
  const signal = useRef({ cancelled: false });

  useEffect(() => {
    (async () => {
      try {
        const [o, f] = await Promise.all([AsyncStorage.getItem(KEYS.onboarded), AsyncStorage.getItem(KEYS.freed)]);
        setOnboarded(o === '1');
        setLifetimeFreed(Number(f) || 0);
      } catch {}
      try {
        const p = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
        setAccess(toAccess(p));
        setCanAskAgain(p.canAskAgain);
      } catch {}
      setReady(true);
    })();
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboarded(true);
    AsyncStorage.setItem(KEYS.onboarded, '1').catch(() => {});
  }, []);

  const requestAccess = useCallback(async () => {
    const p = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
    const a = toAccess(p);
    setAccess(a);
    setCanAskAgain(p.canAskAgain);
    return a;
  }, []);

  const refreshDisk = useCallback(() => setDisk(getDiskInfo()), []);

  const scan = useCallback(async () => {
    let a = access;
    if (a === 'unknown' || a === 'denied') a = await requestAccess();
    if (a !== 'granted' && a !== 'limited') return;
    signal.current = { cancelled: false };
    setScanning(true);
    setProgress({ phase: 'reading', done: 0, total: 0 });
    try {
      const r = await scanLibrary(setProgress, signal.current);
      if (!signal.current.cancelled) setResult(r);
    } finally {
      setScanning(false);
      setProgress(null);
      setDisk(getDiskInfo());
    }
  }, [access, requestAccess]);

  const cancelScan = useCallback(() => {
    signal.current.cancelled = true;
  }, []);

  const remove = useCallback(async (items: Item[]) => {
    const ok = await deleteItems(items);
    if (!ok) return false;
    const gone = new Set(items.map((i) => i.id));
    const bytes = items.reduce((n, i) => n + i.size, 0);
    setResult((r) =>
      r && {
        ...r,
        photoCount: r.photoCount - items.filter((i) => !i.isVideo).length,
        videoCount: r.videoCount - items.filter((i) => i.isVideo).length,
        screenshots: r.screenshots.filter((i) => !gone.has(i.id)),
        largeVideos: r.largeVideos.filter((i) => !gone.has(i.id)),
        duplicates: r.duplicates
          .map((g) => ({ ...g, items: g.items.filter((i) => !gone.has(i.id)) }))
          .filter((g) => g.items.length > 1),
      },
    );
    setLastFreed({ bytes, count: items.length });
    setLifetimeFreed((n) => {
      const next = n + bytes;
      AsyncStorage.setItem(KEYS.freed, String(next)).catch(() => {});
      return next;
    });
    setDisk(getDiskInfo());
    return true;
  }, []);

  const manageLimited = useCallback(async () => {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(['photo', 'video']);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess,
      openSettings: () => Linking.openSettings(), manageLimited,
      disk, refreshDisk, scanning, progress, result, scan, cancelScan, remove, lifetimeFreed, lastFreed,
    }),
    [ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess, manageLimited, disk, refreshDisk, scanning, progress, result, scan, cancelScan, remove, lifetimeFreed, lastFreed],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
