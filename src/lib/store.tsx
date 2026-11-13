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
import { disableReminders, enableReminders, isScanNotification, permissionState, remindersPref, remindersAsked, markRemindersAsked, scheduleReminders, askNotificationPermissionOnScanStart, notifyScanComplete } from './reminders';
import { beginShortBackgroundTask, endShortBackgroundTask } from 'live-photo-convert';
import { initIAP, onEntitlementChange, refreshEntitlements } from './purchases';
import { withTimeout } from './scan-logic';
import { reclaimableBytes } from './reclaim';
import {
  consumeAllowance,
  crossLimitMessage,
  decideGate,
  normalizeAllowance,
  parseAllowance,
  remainingFree,
  takeAcrossGroups,
  type Allowance,
  type GateVerb,
  type ProFeature,
} from './gating';
import { DEMO, demoScanResult } from './demo';

type Access = 'unknown' | 'granted' | 'limited' | 'denied';

export type CleanRow = {
  kind: Kind;
  count: number; // items (files for temp)
  bytes: number;
  done: number;
  status: 'pending' | 'active' | 'done' | 'cancelled';
  note?: string;
};
export type Cleaning = { rows: CleanRow[]; phase: 'working' | 'finished' | 'cancelled' | 'error'; freed: number; mode?: 'delete' | 'convert' };
export type LastFreed = { bytes: number; count: number; toRecentlyDeleted?: boolean; action?: 'delete' | 'convert' };
export type CleanPlan = { kind: Kind; items: Item[] }[];

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
  /** Runs a clean and resolves with how many gated items completed (media deleted, plus 1 if temporary files were cleared). */
  clean: (plan: CleanPlan) => Promise<number>;
  /** Entry point for every Fix / Clear button: opens the paywall first unless Klenzer is unlocked. */
  startClean: (plan: CleanPlan) => void;
  /** Called by the paywall once the user has paid: continues the clean they asked for. */
  completeUnlock: () => void;
  isPro: boolean;
  tempSize: number;
  reminders: boolean;
  setReminders: (on: boolean) => Promise<'on' | 'off' | 'blocked'>;
  /** Cumulative size of items this install actually deleted through Klenzer. Starts at 0. */
  lifetimeFreed: number;
  scanError: string | null;
  /** Every photo, video and temp file Klenzer has removed, so the total moves even when sizes are unknown. */
  lifetimeItems: number;
  lastFreed: LastFreed | null;
  hideRdSheet: boolean;
  setHideRdSheet: (hide: boolean) => void;
  startConvert: (items: Item[], videoBytes?: number) => void;
  /** Free items left today for non-Pro users (deletes, merges and Secret Album adds share one count). */
  freeLeft: number;
  /**
   * The one gate for every other Pro action (merging contacts, adding to the Secret Album, Compress).
   * Pro runs everything. Free users run up to their daily allowance; the rest goes to the paywall,
   * which continues the full action after a purchase. `run` resolves with how many items completed.
   */
  runGated: <T>(feature: ProFeature, items: T[], run: (items: T[]) => Promise<number>, verb?: GateVerb) => void;
};

const KEYS = { allowance: 'klenzer.allowance.v1', onboarded: 'klenzer.onboarded.v1', freed: 'klenzer.freed.v2', items: 'klenzer.items.v2', reclaim: 'klenzer.reclaim.v1', scanIncomplete: 'klenzer.scan.incomplete.v1', hideRdSheet: 'klenzer.rdSheet.hide.v1', convertPending: 'klenzer.convert.pending.v1' };

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
  const [lastFreed, setLastFreed] = useState<LastFreed | null>(null);
  const [hideRdSheet, setHideRdSheetState] = useState(false);
  const [cleaning, setCleaning] = useState<Cleaning | null>(null);
  const [tempSize, setTempSize] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [reminders, setRemindersState] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [allowance, setAllowance] = useState<Allowance>(() => normalizeAllowance(null, new Date()));
  const allowanceRef = useRef(allowance);
  const [dayTick, setDayTick] = useState(0);
  const afterUnlockAction = useRef<(() => void) | null>(null);
  const afterUnlock = useRef<CleanPlan | null>(null);
  const afterUnlockConvert = useRef<{ items: Item[]; videoBytes: number } | null>(null);
  const signal = useRef({ cancelled: false });
  const handledNotif = useRef<string | null>(null);
  const scanningRef = useRef(false);
  const scanIncomplete = useRef(false);
  const progressRef = useRef<Progress | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [o, f, it, hide] = await Promise.all([
          AsyncStorage.getItem(KEYS.onboarded),
          AsyncStorage.getItem(KEYS.freed),
          AsyncStorage.getItem(KEYS.items),
          AsyncStorage.getItem(KEYS.hideRdSheet),
        ]);
        setOnboarded(o === '1' || DEMO);
        setLifetimeFreed(Number(f) || 0);
        setLifetimeItems(Number(it) || 0);
        setHideRdSheetState(hide === '1');
        const stored = normalizeAllowance(parseAllowance(await AsyncStorage.getItem(KEYS.allowance)), new Date());
        allowanceRef.current = stored;
        setAllowance(stored);
        if (DEMO) setResult(demoScanResult());
        scanIncomplete.current = (await AsyncStorage.getItem(KEYS.scanIncomplete)) === '1';
      } catch {}
      setReady(true);
      // IAP, permissions and reminders must not hold the splash or first render.
      void (async () => {
        try {
          const ok = await withTimeout(initIAP(), 4000, false);
          if (ok) setIsPro(await withTimeout(refreshEntitlements(), 4000, false));
        } catch {}
        try {
          setRemindersState((await remindersPref()) && (await permissionState()) === 'granted');
        } catch {}
        try {
          const p = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
          setAccess(toAccess(p));
          setCanAskAgain(p.canAskAgain);
        } catch {}
      })();
    })();
  }, []);

  // Keep the unlocked state live: a purchase, a restore, or a refund all arrive here.
  useEffect(() => onEntitlementChange(setIsPro), []);

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

  const markScanIncomplete = (on: boolean) => {
    scanIncomplete.current = on;
    if (on) AsyncStorage.setItem(KEYS.scanIncomplete, '1').catch(() => {});
    else AsyncStorage.removeItem(KEYS.scanIncomplete).catch(() => {});
  };

  const scan = useCallback(async (opts: { resume?: boolean } = {}) => {
    if (scanningRef.current) return;
    let a = access;
    if (a === 'unknown' || a === 'denied') a = await requestAccess();
    if (a !== 'granted' && a !== 'limited') return;
    signal.current = { cancelled: false };
    setScanError(null);
    scanningRef.current = true;
    setScanning(true);
    if (!opts.resume) {
      setProgress({ phase: 'reading', done: 0, total: 0, percent: 0 });
      progressRef.current = { phase: 'reading', done: 0, total: 0, percent: 0 };
    }
    setScanCats({
      photos: { category: 'photos', status: 'running', done: 0, total: 0 },
      screenshots: { category: 'screenshots', status: 'running', done: 0, total: 0 },
      videos: { category: 'videos', status: 'running', done: 0, total: 0 },
    });
    markScanIncomplete(true);
    // Ask only when a scan starts, never on launch. A denial must not stop the scan.
    void askNotificationPermissionOnScanStart();
    beginShortBackgroundTask();
    const finishCats = () =>
      setScanCats((c) => ({
        photos: { ...c.photos, status: 'done' },
        screenshots: { ...c.screenshots, status: 'done' },
        videos: { ...c.videos, status: 'done' },
      }));
    try {
      const r = await scanLibrary(
        {
          onProgress: (p) => {
            progressRef.current = p;
            setProgress(p);
          },
          onCategory: (p) => setScanCats((prev) => ({ ...prev, [p.category]: p })),
          onPartial: (partial) => setResult({ ...partial }),
          onError: (message) => setScanError(message),
        },
        signal.current,
        { initialPercent: opts.resume ? (progressRef.current?.percent ?? 0) : 0 },
      );
      if (!signal.current.cancelled) {
        setResult(r);
        markScanIncomplete(false);
        const reclaim = reclaimableBytes(r, tempBytes());
        AsyncStorage.setItem(KEYS.reclaim, String(reclaim)).catch(() => {});
        void notifyScanComplete(reclaim);
        if (!opts.resume) askAboutReminders(reclaim);
      }
    } catch (e) {
      setScanError(e instanceof Error && e.message ? e.message : 'The scan hit a problem. You can try again.');
      finishCats();
    } finally {
      endShortBackgroundTask();
      finishCats();
      scanningRef.current = false;
      setScanning(false);
      setProgress(null);
      refreshDisk();
    }
  }, [access, requestAccess, refreshDisk, askAboutReminders]);

  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

  // If a scan was in progress when the app left the foreground, resume from the SQLite cache
  // without wiping results. A short iOS background task may let the current scan finish, but we do not promise background processing.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      if (scanningRef.current) return;
      if (!scanIncomplete.current) return;
      void scanRef.current({ resume: true });
    });
    return () => sub.remove();
  }, []);

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
    markScanIncomplete(false);
  }, []);

  const patch = (fn: (rows: CleanRow[]) => CleanRow[], extra: Partial<Cleaning> = {}) =>
    setCleaning((c) => (c ? { ...c, ...extra, rows: fn(c.rows) } : c));

  const clean = useCallback(async (plan: CleanPlan): Promise<number> => {
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
        patch((r) => r.map((x) => (x.kind === 'temp' ? x : { ...x, status: 'active', note: 'Waiting for your confirmation' })));
        const ok = await deleteItems(all);
        if (!ok) {
          patch((r) => r.map((x) => (x.kind === 'temp' ? x : { ...x, status: 'cancelled', note: 'Cancelled. Nothing was deleted.' })), {
            phase: 'cancelled',
            freed,
          });
          addFreed(freedNow); // temporary files were still cleared
          refreshDisk();
          return ti >= 0 ? 1 : 0;
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
              shortVideos: (r.shortVideos ?? []).filter((i) => !gone.has(i.id)),
              screenRecordings: (r.screenRecordings ?? []).filter((i) => !gone.has(i.id)),
              livePhotos: r.livePhotos.filter((i) => !gone.has(i.id)),
              blurry: r.blurry.filter((i) => !gone.has(i.id)),
              photos: (r.photos ?? []).filter((i) => !gone.has(i.id)),
              duplicates: r.duplicates
                .map((g) => ({ ...g, items: g.items.filter((i) => !gone.has(i.id)) }))
                .filter((g) => g.items.length > 1),
              similar: r.similar
                .map((g) => ({ ...g, items: g.items.filter((i) => !gone.has(i.id)) }))
                .filter((g) => g.items.length > 1),
              duplicateVideos: r.duplicateVideos
                .map((g) => ({ ...g, items: g.items.filter((i) => !gone.has(i.id)) }))
                .filter((g) => g.items.length > 1),
            },
        );
      }

      const count = plan.reduce((n, p) => n + (p.kind === 'temp' ? 0 : p.items.length), 0);
      setLastFreed({ bytes: freed, count, toRecentlyDeleted: Platform.OS === 'ios' && all.length > 0, action: 'delete' });
      addFreed(freedNow);
      addItems(count);
      patch((r) => r, { phase: 'finished', freed });
      refreshDisk();
      pollDisk();
      return all.length + (ti >= 0 ? 1 : 0);
    } catch {
      patch((r) => r, { phase: 'error', freed });
      refreshDisk();
      return 0;
    }
  }, [refreshDisk, pollDisk, addFreed, addItems]);


  const setHideRdSheet = useCallback((hide: boolean) => {
    setHideRdSheetState(hide);
    AsyncStorage.setItem(KEYS.hideRdSheet, hide ? '1' : '0').catch(() => {});
  }, []);

  const convertLive = useCallback(async (items: Item[], videoBytes = 0) => {
    const { convertToStills } = await import('live-photo-convert');
    const count = items.length;
    const estimate = videoBytes > 0 ? videoBytes : items.reduce((n, i) => n + i.size, 0);
    setCleaning({
      rows: [{ kind: 'live', count, bytes: estimate, done: 0, status: 'active', note: 'Originals go to Recently Deleted. Space is freed after you empty it, or after 30 days.' }],
      phase: 'working',
      freed: 0,
      mode: 'convert',
    });
    try {
      const outcome = await convertToStills(items.map((i) => i.id));
      const doneIds = new Set(outcome.convertedIds);
      if (outcome.pendingIds.length) {
        await AsyncStorage.setItem(KEYS.convertPending, JSON.stringify(outcome.pendingIds));
      } else {
        await AsyncStorage.removeItem(KEYS.convertPending);
      }
      if (doneIds.size === 0) {
        const cancelled = outcome.pendingIds.length > 0;
        setCleaning({
          rows: [{ kind: 'live', count, bytes: estimate, done: 0, status: cancelled ? 'cancelled' : 'done', note: cancelled ? 'You cancelled the confirmation.' : 'Nothing was converted.' }],
          phase: cancelled ? 'cancelled' : 'error',
          freed: 0,
          mode: 'convert',
        });
        return;
      }
      const gone = doneIds;
      const saved = outcome.videoBytesSaved || items.filter((i) => gone.has(i.id)).reduce((n, i) => n + i.size, 0);
      setResult(
        (r) =>
          r && {
            ...r,
            livePhotos: r.livePhotos.filter((i) => !gone.has(i.id)),
            photos: (r.photos ?? []).map((i) => (gone.has(i.id) ? { ...i, isLive: false } : i)).sort((a, b) => b.size - a.size),
            duplicates: r.duplicates.map((g) => ({ ...g, items: g.items.map((i) => (gone.has(i.id) ? { ...i, isLive: false } : i)) })),
            similar: r.similar.map((g) => ({ ...g, items: g.items.map((i) => (gone.has(i.id) ? { ...i, isLive: false } : i)) })),
          },
      );
      setLastFreed({ bytes: saved, count: doneIds.size, toRecentlyDeleted: Platform.OS === 'ios', action: 'convert' });
      setCleaning({
        rows: [{ kind: 'live', count: doneIds.size, bytes: saved, done: doneIds.size, status: 'done' }],
        phase: 'finished',
        freed: saved,
        mode: 'convert',
      });
      refreshDisk();
      pollDisk();
    } catch {
      setCleaning({
        rows: [{ kind: 'live', count, bytes: estimate, done: 0, status: 'cancelled', note: 'Nothing was converted.' }],
        phase: 'error',
        freed: 0,
        mode: 'convert',
      });
    }
  }, [refreshDisk, pollDisk]);

  // Klenzer scans for free; clearing is the paid part. Every Fix / Clear button comes through here.
  const isProRef = useRef(false);
  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  // Free daily allowance: one shared count of items, reset at local midnight. Pro is unlimited.
  const spendFree = useCallback((items: number) => {
    if (items <= 0 || isProRef.current) return;
    const next = consumeAllowance(allowanceRef.current, items, new Date());
    allowanceRef.current = next;
    setAllowance(next);
    AsyncStorage.setItem(KEYS.allowance, JSON.stringify(next)).catch(() => {});
  }, []);
  const freeLeftNow = () => remainingFree(allowanceRef.current, new Date());
  // Re-read the day on foreground and at the next local midnight so the count resets on screen too.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setDayTick((n) => n + 1));
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1).getTime();
    const t = setTimeout(() => setDayTick((n) => n + 1), Math.max(1000, midnight - now.getTime()));
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [dayTick]);
  // dayTick forces a re-read of the clock after midnight or a return to the app.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const freeLeft = useMemo(() => remainingFree(allowance, new Date()), [allowance, dayTick]);

  /** Shown when a free batch would cross the daily limit: run the free part now, or upgrade for all of it. */
  const askCrossLimit = (freeNow: number, total: number, verb: GateVerb, runFree: () => void, upgrade: () => void) => {
    const label = verb === 'merge' ? 'Merge' : verb === 'add' ? 'Add' : 'Clean';
    const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [{ text: 'Not now', style: 'cancel' }];
    if (freeNow > 0) buttons.push({ text: `${label} ${freeNow.toLocaleString('en-US')} free`, onPress: runFree });
    buttons.push({ text: 'Upgrade', onPress: upgrade });
    Alert.alert(freeNow > 0 ? 'Daily free limit' : 'Free items used up', crossLimitMessage(freeNow, total, verb), buttons);
  };

  const runGated = useCallback(
    <T,>(feature: ProFeature, items: T[], run: (items: T[]) => Promise<number>, verb: GateVerb = 'clean') => {
      if (!items.length) return;
      const d = decideGate({ isPro: isProRef.current, feature, count: items.length, remaining: freeLeftNow() });
      const go = (subset: T[], counts: boolean) => {
        void run(subset).then((done) => counts && spendFree(done)).catch(() => {});
      };
      if (!d.needsPaywall) return go(items, d.countsAgainstAllowance);
      const upgrade = () => {
        afterUnlock.current = null;
        afterUnlockConvert.current = null;
        afterUnlockAction.current = () => go(items, false);
        router.push('/paywall');
      };
      if (!d.countsAgainstAllowance) return upgrade();
      askCrossLimit(d.freeNow, items.length, verb, () => go(items.slice(0, d.freeNow), true), upgrade);
    },
    [spendFree],
  );

  const startClean = useCallback(
    (plan: CleanPlan) => {
      const hasTemp = plan.some((p) => p.kind === 'temp');
      const mediaCount = plan.reduce((n, p) => n + (p.kind === 'temp' ? 0 : p.items.length), 0);
      // Temporary files count as one item.
      const total = mediaCount + (hasTemp ? 1 : 0);
      const run = (p: CleanPlan, counts: boolean) => {
        router.push('/cleaning');
        void clean(p).then((done) => counts && spendFree(done));
      };
      const d = decideGate({ isPro: isProRef.current, feature: 'delete', count: total, remaining: freeLeftNow() });
      if (!d.needsPaywall) return run(plan, d.countsAgainstAllowance);
      const upgrade = () => {
        afterUnlock.current = plan;
        afterUnlockConvert.current = null;
        afterUnlockAction.current = null;
        router.push('/paywall');
      };
      const freePlan = takeAcrossGroups(plan, d.freeNow - (hasTemp ? 1 : 0), (g) => g.kind === 'temp');
      askCrossLimit(d.freeNow, mediaCount || total, 'clean', () => run(freePlan, true), upgrade);
    },
    [clean, spendFree],
  );

  const startConvert = useCallback(
    (items: Item[], videoBytes = 0) => {
      if (!items.length) return;
      if (Platform.OS !== 'ios') {
        Alert.alert('Available on iPhone', 'Convert to still uses Apple’s Live Photos and is available on iPhone.');
        return;
      }
      if (access === 'limited' || access === 'denied' || access === 'unknown') {
        Alert.alert('Full photo access needed', 'Converting a Live Photo to a still needs access to your whole library so the still can keep its album and details.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Allow access', onPress: () => void requestAccess() },
        ]);
        return;
      }
      // Convert Live Photos is Pro only: no free daily allowance.
      if (!decideGate({ isPro: isProRef.current, feature: 'convert', count: items.length, remaining: 0 }).needsPaywall) {
        router.push('/cleaning');
        void convertLive(items, videoBytes);
        return;
      }
      afterUnlockConvert.current = { items, videoBytes };
      afterUnlock.current = null;
      afterUnlockAction.current = null;
      router.push('/paywall');
    },
    [access, requestAccess, convertLive],
  );
  const completeUnlock = useCallback(() => {
    const plan = afterUnlock.current;
    afterUnlock.current = null;
    const convert = afterUnlockConvert.current;
    afterUnlockConvert.current = null;
    const action = afterUnlockAction.current;
    afterUnlockAction.current = null;
    if (action) {
      if (router.canGoBack()) router.back();
      setTimeout(action, 250);
    } else if (convert) {
      router.replace('/cleaning');
      void convertLive(convert.items, convert.videoBytes);
    } else if (plan) {
      router.replace('/cleaning');
      void clean(plan);
    } else if (router.canGoBack()) router.back();
  }, [clean, convertLive]);

  const manageLimited = useCallback(async () => {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(['photo', 'video']);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess,
      openSettings: () => Linking.openSettings(), manageLimited,
      disk, refreshDisk, scanning, progress, scanCats, result, scan, cancelScan, cleaning, clean, startClean, completeUnlock, isPro, tempSize, reminders, setReminders, lifetimeFreed, lifetimeItems, lastFreed, scanError, hideRdSheet, setHideRdSheet, startConvert, freeLeft, runGated,
    }),
    [ready, onboarded, finishOnboarding, access, canAskAgain, requestAccess, manageLimited, disk, refreshDisk, scanning, progress, scanCats, result, scan, cancelScan, cleaning, clean, startClean, completeUnlock, isPro, tempSize, reminders, setReminders, lifetimeFreed, lifetimeItems, lastFreed, scanError, hideRdSheet, setHideRdSheet, startConvert, freeLeft, runGated],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
