import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  endConnection,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
} from 'expo-iap';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** One non-consumable purchase: pay once, keep it for life. Must match the product ID in App Store Connect and Play Console. */
export const LIFETIME_SKU = 'com.krosz.klenzer.lifetime';
const CACHE_KEY = 'klenzer.unlocked.v1';
const FALLBACK_PRICE = '$14.99';
const STORE = Platform.OS === 'ios' ? 'Apple ID' : 'Google account';

type Ctx = {
  /** True once the lifetime purchase is owned. Scanning is always free; deleting needs this. */
  unlocked: boolean;
  /** Localised price from the store, falling back to $14.99 until it loads. */
  price: string;
  busy: 'buy' | 'restore' | null;
  error: string | null;
  paywallOpen: boolean;
  /** Run `action` now if unlocked, otherwise show the payment sheet and run it right after a successful purchase. */
  requireUnlock: (action: () => void) => void;
  buy: () => Promise<void>;
  restore: () => Promise<void>;
  closePaywall: () => void;
};

const UnlockCtx = createContext<Ctx | null>(null);

export function UnlockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [price, setPrice] = useState(FALLBACK_PRICE);
  const [busy, setBusy] = useState<Ctx['busy']>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const grant = useCallback(() => {
    setUnlocked(true);
    AsyncStorage.setItem(CACHE_KEY, '1').catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    // The cached flag keeps the app unlocked while offline; the store check below is the source of truth.
    AsyncStorage.getItem(CACHE_KEY)
      .then((v) => alive && v === '1' && setUnlocked(true))
      .catch(() => {});

    const updated = purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== LIFETIME_SKU) return;
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // An unfinished transaction is replayed on the next launch; the purchase itself is already valid.
      }
      if (!alive) return;
      grant();
      setBusy(null);
      setError(null);
      setPaywallOpen(false);
      const next = pending.current;
      pending.current = null;
      if (next) setTimeout(next, 350);
    });
    const failed = purchaseErrorListener((e) => {
      if (!alive) return;
      setBusy(null);
      if (e.code !== ErrorCode.UserCancelled) setError('The purchase didn’t go through, and you haven’t been charged. Try again.');
    });

    (async () => {
      try {
        await initConnection();
        const products = await fetchProducts({ skus: [LIFETIME_SKU], type: 'in-app' });
        const product = Array.isArray(products) ? products.find((p) => p.id === LIFETIME_SKU) : undefined;
        if (alive && product?.displayPrice) setPrice(product.displayPrice);
        const owned = await getAvailablePurchases();
        if (!alive) return;
        if (owned.some((p) => p.productId === LIFETIME_SKU)) grant();
        else {
          // The store answered and the purchase isn't there (for example it was refunded): lock again.
          setUnlocked(false);
          AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
        }
      } catch {
        // Offline or store unavailable: keep whatever the cache says.
      }
    })();

    return () => {
      alive = false;
      updated.remove();
      failed.remove();
      endConnection().catch(() => {});
    };
  }, [grant]);

  const requireUnlock = useCallback(
    (action: () => void) => {
      if (unlocked) {
        action();
        return;
      }
      pending.current = action;
      setError(null);
      setPaywallOpen(true);
    },
    [unlocked],
  );

  const buy = useCallback(async () => {
    setError(null);
    setBusy('buy');
    try {
      // The result arrives through purchaseUpdatedListener / purchaseErrorListener.
      await requestPurchase({ request: { apple: { sku: LIFETIME_SKU }, google: { skus: [LIFETIME_SKU] } }, type: 'in-app' });
    } catch {
      setBusy(null);
      setError('The store isn’t available right now. Check your connection and try again.');
    }
  }, []);

  const restore = useCallback(async () => {
    setError(null);
    setBusy('restore');
    try {
      await restorePurchases();
      const owned = await getAvailablePurchases();
      if (owned.some((p) => p.productId === LIFETIME_SKU)) {
        grant();
        setPaywallOpen(false);
        const next = pending.current;
        pending.current = null;
        if (next) setTimeout(next, 350);
      } else {
        setError(`No earlier purchase found for this ${STORE}.`);
      }
    } catch {
      setError('Couldn’t reach the store. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }, [grant]);

  const closePaywall = useCallback(() => {
    pending.current = null;
    setPaywallOpen(false);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ unlocked, price, busy, error, paywallOpen, requireUnlock, buy, restore, closePaywall }),
    [unlocked, price, busy, error, paywallOpen, requireUnlock, buy, restore, closePaywall],
  );
  return <UnlockCtx.Provider value={value}>{children}</UnlockCtx.Provider>;
}

export function useUnlock(): Ctx {
  const c = useContext(UnlockCtx);
  if (!c) throw new Error('useUnlock must be used inside UnlockProvider');
  return c;
}
