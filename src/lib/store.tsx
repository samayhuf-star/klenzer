import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Notifications from 'expo-notifications';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { formatBytes } from './format';
import { DiskInfo, getDiskInfo, getDiskInfoSync } from './disk';
import { Kind } from './kinds';
import { CategoryProgress, deleteItems, Item, Progress, ScanCategory, ScanResult, scanLibrary } from './scanner';
import { clearTemp, tempBytes } from './temp';
import { disableReminders, enableReminders, isScanNotification, permissionState, remindersPref, remindersAsked, markRemindersAsked, scheduleReminders } from './reminders';
import { configurePurchases, currentCustomer, hasPro, onCustomerInfo } from './purchases';
import { reclaimableBytes } from './reclaim';

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

export type CategoryScanMap = Record<ScanCategory, CategoryProgress>;

const idleCats = (): CategoryScanMap => ({
  photos: { category: 'photos', status: 'idle', done: 0, total: 0 },
  screenshots: { category: 'screenshots', status: 'idle', done: 0, total: 0 },
  videos: { category: 'videos', status: 'idle', done: 0, total: 0 },
});

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
  scanCats: CategoryScanMap;
  result: ScanResult | null;
  scan: () => Promise<void>;
  cancelScan: () => void;
  cleaning: Cleaning | null;
  clean: (plan: CleanPlan) => Promise<void>;
  /** Entry point for every Fix / Clear button: opens the paywall first unless Klenzer is unlocked. */
  startClean: (plan: CleanPlan) => void;
  /** Called by the paywall once the user has paid: continues the clean they asked for. */
  completeUnlock: () => void;
  isPro: boolean;
  tempSize: number;
  reminders: boolean;
  setReminders: (on: boolean) => Promise<'on' | 'off' | 'blocked'>;
  /** Space Klenzer has actually given back (on iOS: only once Recently Deleted is emptied). */
  lifetimeFreed: number;
  /** Every photo, video and temp file Klenzer has removed, so the total moves even when sizes are unknown. */
  lifetimeItems: number;
  lastFreed: { bytes: number; count: number } | null;
};

const KEYS = { onboarded: 'klenzer.onboarded.v1', freed: 'klenzer.freed.v1', items: 'klenzer.items.v1', pending: 'klenzer.pending.v1', reclaim: 'klenzer.reclaim.v1' };

const StoreCtx = createContext<Ctx>(null as never);
export const useStore = () => useContext(StoreCtx);

const toAccess = (p: MediaLibrary.PermissionResponse): Access =>
  p.status === 'granted' ? (p.accessPrivileges === 'limited' ? 'limited' : 'granted') : p.status === 'denied' ? 'denied' : 'unknown';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [access, setAccess] = useState<Access>('unknown');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [disk, setDisk] = useState<DiskInfo>(() => getDiskInfoSync());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [scanCats, setScanCats] = useState<CategoryScanMap>(idleCats);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [lifetimeFreed, setLifetimeFreed] = useState(0);
  const [lifetimeItems, setLifetimeItems] = useState(0);
  const [lastFreed, setLastFreed] = useState<{ bytes: number; count: number } | null>(null);
  const [cleaning, setCleaning] = useState<Cleaning | null>(null);
  const [tempSize, setTempSize] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reminders, setRemindersState] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const afterUnlock = useRef<CleanPlan | null>(null);
  const signal = useRef({ cancelled: false });
  const handledNotif = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [o, f, it, pd] = await Promise.all([
          AsyncStorage.getItem(KEYS.onboarded),
          AsyncStorage.getItem(KEYS.freed),
          AsyncStorage.getItem(KEYS.items),
          AsyncStorage.getItem(KEYS.pending),
        ]);
        setOnboarded(o === '1');
        setLifetimeFreed(Number(f) || 0);
        setLifetimeItems(Number(it) || 0);
        if (pd) setPending(JSON.parse(pd));
      } catch {}
      if (configurePurchases()) setIsPro(hasPro(await currentCustomer()));
      try {
        setRemindersState((await remindersPref()) && (await permissionState()) === 'granted');
      } catch {}
      try {
        const p = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
        setAccess(toAccess(p));
        setCanAskAgain(p.canAskAgain);
      } catch {}
      setReady(true);
    })();
  }, []);

  // Keep the unlocked state live: a purchase, a restore, or a refund all arrive here.
  useEffect(() => onCustomerInfo((info) => setIsPro(hasPro(info))), [ready]);

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

  // Disk reads are async on iOS; ignore any answer that arrives after a newer one was requested.
  const diskSeq = useRef(0);
  const refreshDisk = useCallback(() => {
    const seq = ++diskSeq.current;
    getDiskInfo().then((d) => seq === diskSeq.current && setDisk(d)).catch(() => {});
    setTempSize(tempBytes());
  }, []);

  const addFreed = useCallback((bytes: number) => {
    if (bytes <= 0) return;
    setLifetimeFreed((n) => {
      const next = n + bytes;
      AsyncStorage.setItem(KEYS.freed, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const addItems = useCallback((count: number) => {
    if (count <= 0) return;
    setLifetimeItems((n) => {
      const next = n + count;
      AsyncStorage.setItem(KEYS.items, String(next)).catch(() => {});
      return next;
    });
  }, []);

  // Recently Deleted was emptied: that space is now really free, so it joins the lifetime total.
  // Tracked silently — the UI no longer tells the user to empty the album by hand.
  const pendingRef = useRef<Pending | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const settlePending = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    addFreed(p.bytes);
    setPending(null);
    AsyncStorage.removeItem(KEYS.pending).catch(() => {});
  }, [addFreed]);

  useEffect(() => {
    // Initial and foreground disk refresh; the setter is inside refreshDisk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshDisk();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshDisk());
    return () => sub.remove();
  }, [refreshDisk]);

  const pollDisk = useCallback(() => {
    let n = 0;
    const t = setInterval(() => {
      refreshDisk();
      if (++n >= 20) clearInterval(t);
    }, 1500);
  }, [refreshDisk]);

  useEffect(() => {
    if (pending && disk.free - pending.baselineFree >= pending.bytes * 0.5) settlePending();
  }, [disk.free, pending, settlePending]);

  // Cancel and reschedule the 3-day local reminder with fresh used/total on open and foreground.
  const reminderInfo = useRef({ used: 0, total: 0 });
  useEffect(() => {
    reminderInfo.current = { used: disk.used, total: disk.total };
  }, [disk.used, disk.total]);
  useEffect(() => {
    if (!ready) return;
    const plan = () => scheduleReminders({ usedBytes: reminderInfo.current.used, totalBytes: reminderInfo.current.total });
    plan();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && plan());
    return () => sub.remove();
  }, [ready, disk.used, disk.total]);

  const setReminders = useCallback(async (on: boolean) => {
    if (!on) {
      await disableReminders();
      setRemindersState(false);
      return 'off' as const;
    }
    const ok = await enableReminders({ usedBytes: disk.used, totalBytes: disk.total });
    setRemindersState(ok);
    return ok ? ('on' as const) : ('blocked' as const);
  }, [disk.used, disk.total]);

  // Right after the first scan the user has just seen how much space is wasted, so that is the moment to offer reminders.
  const askAboutReminders = useCallback(
    async (reclaim: number) => {
      try {
        if (await remindersAsked()) return;
        await markRemindersAsked();
        if ((await permissionState()) === 'denied') return;
        const body = reclaim > 0 ? `We found ${formatBytes(reclaim)} you can clear. Want a gentle reminder every few days?` : 'Want a gentle reminder every few days to check your storage?';
        Alert.alert('Remind me to clean up?', body, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Yes, remind me', onPress: () => void setReminders(true) },
        ]);
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disk.used, disk.total],
  );

  const scan = useCallback(async () => {
    let a = access;
    if (a === 'unknown' || a === 'denied') a = await requestAccess();
    if (a !== 'granted' && a !== 'limited') return;
    signal.current = { cancelled: false };
    setScanning(true);
    setProgress({ phase: 'reading', done: 0, total: 0 });
    setScanCats({
      photos: { category: 'photos', status: 'running', done: 0, total: 0 },
      screenshots: { category: 'screenshots', status: 'running', done: 0, total: 0 },
      videos: { category: 'videos', status: 'running', done: 0, total: 0 },
    });
    try {
      const r = await scanLibrary(
        {
          onProgress: setProgress,
          onCategory: (p) => setScanCats((c) => ({ ...c, [p.category]: p })),
          onPartial: (partial) => setResult({ ...partial }),
        },
        signal.current,
      );
      if (!signal.current.cancelled) {
        setResult(r);
        const reclaim = reclaimableBytes(r, tempBytes());
        AsyncStorage.setItem(KEYS.reclaim, String(reclaim)).catch(() => {});
        askAboutReminders(reclaim);
      }
    } finally {
      setScanning(false);
      setProgress(null);
      refreshDisk();
    }
  }, [access, requestAccess, refreshDisk, askAboutReminders]);

  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

  // Tapping a reminder opens the app and starts a scan. Never request notification permission here.
  useEffect(() => {
    if (!ready || !onboarded) return;
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      if (!isScanNotification(response.notification.request.content.data)) return;
      const id = `${response.notification.request.identifier}:${String(response.notification.date)}`;
      if (handledNotif.current === id) return;
      handledNotif.current = id;
      void Notifications.clearLastNotificationResponseAsync?.();
      void scanRef.current();
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [ready, onboarded]);

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
    let freed = 0; // removed by this clean (shown on the Done screen)
    let freedNow = 0; // space actually returned right now (lifetime total)

    try {
      // 1. Temporary files: no OS dialog, so progress is real, file by file.
      const ti = plan.findIndex((p) => p.kind === 'temp');
      if (ti >= 0) {
        patch((r) => r.map((x, i) => (i === ti ? { ...x, status: 'active' } : x)));
        const n = await clearTemp((done, total, bytes) =>
          patch((r) => r.map((x, i) => (i === ti ? { ...x, done, count: total, bytes } : x))),
        );
        freed += n;
        freedNow += n;
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
          addFreed(freedNow); // temporary files were still cleared
          refreshDisk();
          return;
        }
        const gone = new Set(all.map((i) => i.id));
        const mediaBytes = all.reduce((n, i) => n + i.size, 0);
        freed += mediaBytes;
        freedNow += mediaBytes;
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
              blurry: r.blurry.filter((i) => !gone.has(i.id)),
              duplicates: r.duplicates
                .map((g) => ({ ...g, items: g.items.filter((i) => !gone.has(i.id)) }))
                .filter((g) => g.items.length > 1),
              similar: r.similar
                .map((g) => ({ ...g, items: g.items.filter((i) => !gone.has(i.id)) }))
                .filter((g) => g.items.length > 1),
            },
        );
        if (Platform.OS === 'ios' && mediaBytes > 0) {
          // Photos keeps these in Recently Deleted for 30 days, so the space isn't free yet.
          freedNow -= mediaBytes;
          const baselineFree = pending?.baselineFree ?? (await getDiskInfo()).free;
          const next = { bytes: mediaBytes + (pending?.bytes ?? 0), baselineFree };
          setPending(next);
          AsyncStorage.setItem(KEYS.pending, JSON.stringify(next)).catch(() => {});
        }
      }

      const count = plan.reduce((n, p) => n + (p.kind === 'temp' ? 0 : p.items.length), 0);
      setLastFreed({ bytes: freed, count });
      addFreed(freedNow);
      addItems(count);
      patch((r) => r, { phase: 'finished', freed });
      refreshDisk();
      pollDisk();
    } catch {
      patch((r) => r, { phase: 'error', freed });
      refreshDisk();
    }
  }, [pending, refreshDisk, pollDisk, addFreed, addItems]);

  // Klenzer scans for free; clearing is the paid part. Every Fix / Clear button comes through here.
  const isProRef = useRef(false);
  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);
  const startClean = useCallback(
    (plan: CleanPlan) => {
      if (isProRef.current) {
        router.push('/cleaning');
        void clean(plan);
        return;
      }
      afterUnlock.current = plan;
      router.push('/paywall');
    },
    [clean],
  );
  const completeUnlock = useCallback(() => {
    const plan = afterUnlock.current;
    afterUnlock.current = null;
    if (plan) {
      router.replace('/cleaning');
      void clean(plan);
    } else if (router.canGoBack()) router.back();
  }, [clean]);

  const manageLimited = useCallback(async () => {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(['photo', 'video']);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess,
      openSettings: () => Linking.openSettings(), manageLimited,
      disk, refreshDisk, scanning, progress, scanCats, result, scan, cancelScan, cleaning, clean, startClean, completeUnlock, isPro, tempSize, reminders, setReminders, lifetimeFreed, lifetimeItems, lastFreed,
    }),
    [ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess, manageLimited, disk, refreshDisk, scanning, progress, scanCats, result, scan, cancelScan, cleaning, clean, startClean, completeUnlock, isPro, tempSize, reminders, setReminders, lifetimeFreed, lifetimeItems, lastFreed],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
