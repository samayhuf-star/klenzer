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
/**
 * Auto-renewing monthly plan, a second product in its own subscription group. It is only offered in the countries where
 * the product is made available in App Store Connect / Play Console, so regional pricing needs no country list in code:
 * if the store doesn't return the monthly product, the sheet shows Lifetime alone.
 */
export const MONTHLY_SKU = 'com.krosz.klenzer.monthly';
const OWNED_SKUS = [LIFETIME_SKU, MONTHLY_SKU];
export type Plan = 'lifetime' | 'monthly';
const CACHE_KEY = 'klenzer.unlocked.v1';
const FALLBACK_PRICE = '$14.99';
const STORE = Platform.OS === 'ios' ? 'Apple ID' : 'Google account';
/** Set only by the `testflight` EAS profile (eas.json). Tester builds skip the paywall; App Store builds never set it. */
const TESTER_BUILD = process.env.EXPO_PUBLIC_TESTER_BUILD === '1';

type Ctx = {
  /** True once the lifetime purchase is owned. Scanning is always free; deleting needs this. */
  unlocked: boolean;
  /** Localised price from the store, falling back to $4.99 until it loads. */
  price: string;
  /** Localised monthly price, or null where the monthly plan isn't sold. */
  monthlyPrice: string | null;
  plan: Plan;
  setPlan: (p: Plan) => void;
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
  const [unlocked, setUnlocked] = useState(TESTER_BUILD);
  const [price, setPrice] = useState(FALLBACK_PRICE);
  const [monthlyPrice, setMonthlyPrice] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>('lifetime');
  const offerToken = useRef<string | null>(null);
  const [busy, setBusy] = useState<Ctx['busy']>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const grant = useCallback(() => {
    setUnlocked(true);
    AsyncStorage.setItem(CACHE_KEY, '1').catch(() => {});
  }, []);

  useEffect(() => {
    // Tester builds stay unlocked and never talk to the store.
    if (TESTER_BUILD || Platform.OS === 'web') return;
    let alive = true;
    // The cached flag keeps the app unlocked while offline; the store check below is the source of truth.
    AsyncStorage.getItem(CACHE_KEY)
      .then((v) => alive && v === '1' && setUnlocked(true))
      .catch(() => {});

    const updated = purchaseUpdatedListener(async (purchase) => {
      if (!OWNED_SKUS.includes(purchase.productId)) return;
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
        try {
          const subs = await fetchProducts({ skus: [MONTHLY_SKU], type: 'subs' });
          const m = Array.isArray(subs) ? subs.find((p) => p.id === MONTHLY_SKU) : undefined;
          if (alive && m?.displayPrice) {
            setMonthlyPrice(m.displayPrice);
            const offers = 'subscriptionOffers' in m ? m.subscriptionOffers : null;
            offerToken.current = offers?.find((o) => o.offerTokenAndroid)?.offerTokenAndroid ?? null;
          }
        } catch {
          // Monthly isn't sold here: Lifetime stays the only plan.
        }
        const owned = await getAvailablePurchases();
        if (!alive) return;
        if (owned.some((p) => OWNED_SKUS.includes(p.productId))) grant();
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
      if (plan === 'monthly' && monthlyPrice) {
        const token = offerToken.current;
        await requestPurchase({
          request: { apple: { sku: MONTHLY_SKU }, google: { skus: [MONTHLY_SKU], subscriptionOffers: token ? [{ sku: MONTHLY_SKU, offerToken: token }] : undefined } },
          type: 'subs',
        });
      } else {
        await requestPurchase({ request: { apple: { sku: LIFETIME_SKU }, google: { skus: [LIFETIME_SKU] } }, type: 'in-app' });
      }
    } catch {
      setBusy(null);
      setError('The store isn’t available right now. Check your connection and try again.');
    }
  }, [plan, monthlyPrice]);

  const restore = useCallback(async () => {
    setError(null);
    setBusy('restore');
    try {
      await restorePurchases();
      const owned = await getAvailablePurchases();
      if (owned.some((p) => OWNED_SKUS.includes(p.productId))) {
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
    () => ({ unlocked, price, monthlyPrice, plan, setPlan, busy, error, paywallOpen, requireUnlock, buy, restore, closePaywall }),
    [unlocked, price, monthlyPrice, plan, busy, error, paywallOpen, requireUnlock, buy, restore, closePaywall],
  );
  return <UnlockCtx.Provider value={value}>{children}</UnlockCtx.Provider>;
}

export function useUnlock(): Ctx {
  const c = useContext(UnlockCtx);
  if (!c) throw new Error('useUnlock must be used inside UnlockProvider');
  return c;
}
