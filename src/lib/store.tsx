import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { DiskInfo, getDiskInfo } from './disk';
import { Kind } from './kinds';
import { deleteItems, Item, Progress, ScanResult, scanLibrary } from './scanner';
import { clearTemp, tempBytes } from './temp';

type Access = 'unknown' | 'granted' | 'limited' | 'denied';

export type CleanRow = {
  kind: Kind;
  count: number; // items (files for temp)
  bytes: number;
  done: number;
  status: 'pending' | 'active' | 'done' | 'cancelled';
  note?: string;
};
export type Cleaning = { rows: CleanRow[]; phase: 'working' | 'finished' | 'cancelled' | 'error'; freed: number };
export type CleanPlan = { kind: Kind; items: Item[] }[];
type Pending = { bytes: number; baselineFree: number };

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
  cleaning: Cleaning | null;
  clean: (plan: CleanPlan) => Promise<void>;
  tempSize: number;
  pending: Pending | null;
  dismissPending: () => void;
  openPhotos: () => void;
  lifetimeFreed: number;
  lastFreed: { bytes: number; count: number } | null;
};

const KEYS = { onboarded: 'klenzer.onboarded.v1', freed: 'klenzer.freed.v1', pending: 'klenzer.pending.v1' };
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
  const [cleaning, setCleaning] = useState<Cleaning | null>(null);
  const [tempSize, setTempSize] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const signal = useRef({ cancelled: false });

  useEffect(() => {
    (async () => {
      try {
        const [o, f, pd] = await Promise.all([
          AsyncStorage.getItem(KEYS.onboarded),
          AsyncStorage.getItem(KEYS.freed),
          AsyncStorage.getItem(KEYS.pending),
        ]);
        setOnboarded(o === '1');
        setLifetimeFreed(Number(f) || 0);
        if (pd) setPending(JSON.parse(pd));
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

  const refreshDisk = useCallback(() => {
    setDisk(getDiskInfo());
    setTempSize(tempBytes());
  }, []);

  // The OS updates free space lazily, so re-read it whenever the app comes back to the foreground
  // (e.g. after the user empties Recently Deleted in Photos) and keep polling for a while after a clean.
  useEffect(() => {
    refreshDisk();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshDisk());
    return () => sub.remove();
  }, [refreshDisk]);

  const pollDisk = useCallback(() => {
    let n = 0;
    const t = setInterval(() => {
      refreshDisk();
      if (++n >= 10) clearInterval(t);
    }, 1500);
  }, [refreshDisk]);

  // Recently Deleted is emptied outside the app; notice it when free space has actually grown.
  useEffect(() => {
    if (pending && disk.free - pending.baselineFree >= pending.bytes * 0.5) {
      setPending(null);
      AsyncStorage.removeItem(KEYS.pending).catch(() => {});
    }
  }, [disk.free, pending]);

  const dismissPending = useCallback(() => {
    setPending(null);
    AsyncStorage.removeItem(KEYS.pending).catch(() => {});
  }, []);

  const openPhotos = useCallback(() => {
    // Apple gives apps no way to empty Recently Deleted, so hand the user straight to Photos.
    Linking.openURL(Platform.OS === 'ios' ? 'photos-redirect://' : 'content://media/internal/images/media').catch(() => Linking.openSettings());
  }, []);

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
      refreshDisk();
    }
  }, [access, requestAccess, refreshDisk]);

  const cancelScan = useCallback(() => {
    signal.current.cancelled = true;
  }, []);

  const patch = (fn: (rows: CleanRow[]) => CleanRow[], extra: Partial<Cleaning> = {}) =>
    setCleaning((c) => (c ? { ...c, ...extra, rows: fn(c.rows) } : c));

  const clean = useCallback(async (plan: CleanPlan) => {
    const rows: CleanRow[] = plan.map(({ kind, items }) => ({
      kind,
      count: kind === 'temp' ? 0 : items.length,
      bytes: items.reduce((n, i) => n + i.size, 0),
      done: 0,
      status: 'pending',
    }));
    setCleaning({ rows, phase: 'working', freed: 0 });
    let freed = 0;

    try {
      // 1. Temporary files: no OS dialog, so progress is real, file by file.
      const ti = plan.findIndex((p) => p.kind === 'temp');
      if (ti >= 0) {
        patch((r) => r.map((x, i) => (i === ti ? { ...x, status: 'active' } : x)));
        const n = await clearTemp((done, total, bytes) =>
          patch((r) => r.map((x, i) => (i === ti ? { ...x, done, count: total, bytes } : x))),
        );
        freed += n;
        patch((r) => r.map((x, i) => (i === ti ? { ...x, status: 'done', bytes: n } : x)));
      }

      // 2. Photos & videos: one OS confirmation covers everything chosen.
      const media = plan.filter((p) => p.kind !== 'temp');
      const all = media.flatMap((p) => p.items);
      if (all.length) {
        patch((r) => r.map((x) => (x.kind === 'temp' ? x : { ...x, status: 'active', note: 'Waiting for your confirmation…' })));
        const ok = await deleteItems(all);
        if (!ok) {
          patch((r) => r.map((x) => (x.kind === 'temp' ? x : { ...x, status: 'cancelled', note: 'Cancelled. Nothing was deleted.' })), {
            phase: 'cancelled',
            freed,
          });
          refreshDisk();
          return;
        }
        const gone = new Set(all.map((i) => i.id));
        const mediaBytes = all.reduce((n, i) => n + i.size, 0);
        freed += mediaBytes;
        // Rows complete one after another so the user can see each subcategory finish.
        for (let i = 0; i < media.length; i++) {
          patch((r) => r.map((x) => (x.kind === media[i].kind ? { ...x, status: 'done', done: x.count, note: undefined } : x)));
          await new Promise((res) => setTimeout(res, 350));
        }
        setResult(
          (r) =>
            r && {
              ...r,
              photoCount: r.photoCount - all.filter((i) => !i.isVideo).length,
              videoCount: r.videoCount - all.filter((i) => i.isVideo).length,
              screenshots: r.screenshots.filter((i) => !gone.has(i.id)),
              largeVideos: r.largeVideos.filter((i) => !gone.has(i.id)),
              livePhotos: r.livePhotos.filter((i) => !gone.has(i.id)),
              duplicates: r.duplicates
                .map((g) => ({ ...g, items: g.items.filter((i) => !gone.has(i.id)) }))
                .filter((g) => g.items.length > 1),
            },
        );
        if (Platform.OS === 'ios' && mediaBytes > 0) {
          const next = { bytes: mediaBytes + (pending?.bytes ?? 0), baselineFree: pending?.baselineFree ?? getDiskInfo().free };
          setPending(next);
          AsyncStorage.setItem(KEYS.pending, JSON.stringify(next)).catch(() => {});
        }
      }

      setLastFreed({ bytes: freed, count: plan.reduce((n, p) => n + (p.kind === 'temp' ? 0 : p.items.length), 0) });
      setLifetimeFreed((n) => {
        const next = n + freed;
        AsyncStorage.setItem(KEYS.freed, String(next)).catch(() => {});
        return next;
      });
      patch((r) => r, { phase: 'finished', freed });
      refreshDisk();
      pollDisk();
    } catch {
      patch((r) => r, { phase: 'error', freed });
      refreshDisk();
    }
  }, [pending, refreshDisk, pollDisk]);

  const manageLimited = useCallback(async () => {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(['photo', 'video']);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess,
      openSettings: () => Linking.openSettings(), manageLimited,
      disk, refreshDisk, scanning, progress, result, scan, cancelScan, cleaning, clean, tempSize, pending, dismissPending, openPhotos, lifetimeFreed, lastFreed,
    }),
    [ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess, manageLimited, disk, refreshDisk, scanning, progress, result, scan, cancelScan, cleaning, clean, tempSize, pending, dismissPending, openPhotos, lifetimeFreed, lastFreed],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
