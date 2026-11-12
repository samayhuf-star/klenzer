import { Platform } from 'react-native';
import {
  currentEntitlementIOS,
  deepLinkToSubscriptions,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getActiveSubscriptions,
  getAvailablePurchases,
  getPendingTransactionsIOS,
  hasActiveSubscriptions,
  initConnection,
  isTransactionVerifiedIOS,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases as storeRestore,
  showManageSubscriptionsIOS,
  syncIOS,
  type Product,
  type ProductOrSubscription,
  type Purchase,
} from 'expo-iap';
import { defaultPlanKind, defForId, isKnownProduct, PRODUCT_CATALOG, productIds, type PlanKind, type ProductDef } from './products';

const LOG = '[klenzer-paywall]';

export type { PlanKind };
export { defaultPlanKind, PRODUCT_CATALOG };

export type Plan = ProductDef & { price: string; product: ProductOrSubscription };

export type BuyResult = 'purchased' | 'cancelled' | 'pending' | 'error';

export type PlansLoad = { plans: Plan[]; error: string | null };

let connected = false;
let listeners = false;
const entitlementListeners = new Set<(isPro: boolean) => void>();
let purchaseWaiter: ((result: BuyResult) => void) | null = null;

const emitPro = (isPro: boolean) => {
  entitlementListeners.forEach((cb) => cb(isPro));
};

const logErr = (action: string, e: unknown) => {
  const err = e as { code?: unknown; message?: string; debugMessage?: string };
  console.log(LOG, `${action} failed`, { code: err?.code, message: err?.message, debugMessage: err?.debugMessage });
};

async function ensureConnected(): Promise<boolean> {
  if (connected) return true;
  try {
    connected = !!(await initConnection());
  } catch (e) {
    logErr('initConnection', e);
    connected = false;
  }
  return connected;
}

async function verifyOnDevice(purchase: Purchase): Promise<boolean> {
  if (purchase.purchaseState === 'pending') return false;
  if ('isSuspendedAndroid' in purchase && purchase.isSuspendedAndroid) return false;
  if (!isKnownProduct(purchase.productId)) return false;

  if (Platform.OS === 'ios') {
    try {
      if (await isTransactionVerifiedIOS(purchase.productId)) return true;
    } catch (e) {
      logErr('isTransactionVerifiedIOS', e);
    }
    try {
      const entitlement = await currentEntitlementIOS(purchase.productId);
      if (entitlement) return true;
    } catch (e) {
      logErr('currentEntitlementIOS', e);
    }
    try {
      const pending = await getPendingTransactionsIOS();
      if (pending.some((p) => p.id === purchase.id || p.productId === purchase.productId)) return true;
    } catch (e) {
      logErr('getPendingTransactionsIOS', e);
    }
    try {
      const available = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: false });
      if (available.some((p) => p.id === purchase.id || p.productId === purchase.productId)) return true;
    } catch (e) {
      logErr('getAvailablePurchases', e);
    }
    // StoreKit 2 already signed this transaction if it arrived via Transaction.updates.
    return purchase.purchaseState === 'purchased' || purchase.purchaseState === 'unknown';
  }

  return purchase.purchaseState === 'purchased' || purchase.purchaseState === 'unknown';
}

async function verifyAndFinish(purchase: Purchase): Promise<boolean> {
  if (purchase.purchaseState === 'pending') return false;
  const ok = await verifyOnDevice(purchase);
  if (!ok) {
    console.log(LOG, 'purchase did not verify', { productId: purchase.productId, state: purchase.purchaseState });
    return false;
  }
  const def = defForId(purchase.productId);
  try {
    await finishTransaction({ purchase, isConsumable: false });
  } catch (e) {
    logErr('finishTransaction', e);
  }
  return !!def;
}

function attachListeners() {
  if (listeners) return;
  listeners = true;
  purchaseUpdatedListener(async (purchase) => {
    if (purchase.purchaseState === 'pending') {
      purchaseWaiter?.('pending');
      purchaseWaiter = null;
      return;
    }
    const ok = await verifyAndFinish(purchase);
    if (ok) {
      const entitled = await refreshEntitlements();
      emitPro(entitled);
    }
    purchaseWaiter?.(ok ? 'purchased' : 'error');
    purchaseWaiter = null;
  });
  purchaseErrorListener((error) => {
    logErr('purchaseError', error);
    if (isUserCancelledError(error) || error.code === ErrorCode.UserCancelled) {
      purchaseWaiter?.('cancelled');
    } else if (error.code === ErrorCode.Pending || error.code === ErrorCode.DeferredPayment) {
      purchaseWaiter?.('pending');
    } else {
      purchaseWaiter?.('error');
    }
    purchaseWaiter = null;
  });
}

/** Connect and listen for transaction updates. Never calls AppStore.sync or restore — those prompt for the Apple ID password. */
export async function initIAP(): Promise<boolean> {
  attachListeners();
  return ensureConnected();
}

export async function loadPlans(): Promise<PlansLoad> {
  if (!(await ensureConnected())) {
    return { plans: [], error: 'Plans unavailable right now, try again later.' };
  }
  const inAppIds = productIds('in-app');
  const subIds = productIds('subs');
  let inApp: ProductOrSubscription[] = [];
  let subs: ProductOrSubscription[] = [];
  try {
    if (inAppIds.length) inApp = (await fetchProducts({ skus: inAppIds, type: 'in-app' })) ?? [];
  } catch (e) {
    logErr('fetchProducts in-app', e);
  }
  try {
    if (subIds.length) subs = (await fetchProducts({ skus: subIds, type: 'subs' })) ?? [];
  } catch (e) {
    logErr('fetchProducts subs', e);
  }
  const byId = new Map<string, ProductOrSubscription>();
  for (const product of [...inApp, ...subs]) {
    if (product?.id && product.displayPrice) byId.set(product.id, product);
  }
  // Keep catalog order; skip IDs the store did not return (e.g. yearly not in ASC yet).
  const plans: Plan[] = [];
  for (const def of PRODUCT_CATALOG) {
    const product = byId.get(def.id);
    if (!product) continue;
    plans.push({ ...def, price: product.displayPrice, product });
  }
  if (!plans.length) {
    console.log(LOG, 'no store products loaded', { inApp: inApp.map((p) => p.id), subs: subs.map((p) => p.id) });
    return { plans: [], error: 'Plans unavailable right now, try again later.' };
  }
  return { plans, error: null };
}

export async function refreshEntitlements(): Promise<boolean> {
  if (!(await ensureConnected())) return false;
  try {
    const lifetimeId = productIds('in-app');
    const subIds = productIds('subs');
    // Current entitlements only. Do not call syncIOS, restorePurchases, or getAvailablePurchases here —
    // those can show Apple's "Sign in to Apple Account" prompt.
    if (Platform.OS === 'ios') {
      for (const id of [...lifetimeId, ...subIds]) {
        try {
          if (await currentEntitlementIOS(id)) return true;
        } catch (e) {
          logErr(`currentEntitlementIOS ${id}`, e);
        }
      }
    }

    if (subIds.length) {
      try {
        if (await hasActiveSubscriptions(subIds)) return true;
      } catch (e) {
        logErr('hasActiveSubscriptions', e);
      }
      try {
        const active = await getActiveSubscriptions(subIds);
        if (active.some((s) => s.isActive)) return true;
      } catch (e) {
        logErr('getActiveSubscriptions', e);
      }
    }
    return false;
  } catch (e) {
    logErr('refreshEntitlements', e);
    return false;
  }
}

export function onEntitlementChange(cb: (isPro: boolean) => void): () => void {
  entitlementListeners.add(cb);
  return () => {
    entitlementListeners.delete(cb);
  };
}

export async function buy(plan: Plan): Promise<BuyResult> {
  if (!(await ensureConnected())) return 'error';
  const result = new Promise<BuyResult>((resolve) => {
    purchaseWaiter = resolve;
  });
  try {
    const offers =
      plan.type === 'subs'
        ? ((plan.product as Product & { subscriptionOffers?: { offerTokenAndroid?: string }[] }).subscriptionOffers ?? [])
            .filter((offer) => offer.offerTokenAndroid)
            .map((offer) => ({ sku: plan.id, offerToken: offer.offerTokenAndroid as string }))
        : [];
    await requestPurchase({
      request: {
        apple: { sku: plan.id },
        google: {
          skus: [plan.id],
          ...(offers.length ? { subscriptionOffers: offers } : {}),
        },
      },
      type: plan.type,
    });
  } catch (e) {
    purchaseWaiter = null;
    if (isUserCancelledError(e) || (e as { code?: string })?.code === ErrorCode.UserCancelled) return 'cancelled';
    if ((e as { code?: string })?.code === ErrorCode.Pending || (e as { code?: string })?.code === ErrorCode.DeferredPayment) {
      return 'pending';
    }
    logErr('requestPurchase', e);
    return 'error';
  }
  return result;
}

export async function restore(): Promise<boolean> {
  if (!(await ensureConnected())) return false;
  if (Platform.OS === 'ios') {
    try {
      await syncIOS();
    } catch (e) {
      logErr('syncIOS restore', e);
    }
  }
  try {
    await storeRestore();
  } catch (e) {
    logErr('restorePurchases', e);
  }
  try {
    const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: false });
    for (const purchase of purchases) {
      if (purchase.purchaseState === 'pending') continue;
      if (!isKnownProduct(purchase.productId)) continue;
      try {
        if (await verifyOnDevice(purchase)) {
          await finishTransaction({ purchase, isConsumable: false });
        }
      } catch (e) {
        logErr('restore finish', e);
      }
    }
  } catch (e) {
    logErr('restore getAvailablePurchases', e);
  }
  const entitled = await refreshEntitlements();
  emitPro(entitled);
  return entitled;
}

/** Open the system subscription manager (Settings › Subscriptions / Play subscriptions). */
export async function manageSubscriptions(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await showManageSubscriptionsIOS();
      emitPro(await refreshEntitlements());
      return;
    }
    const yearly = defForId('com.krosz.klenzer.yearly');
    const monthly = defForId('com.krosz.klenzer.monthly');
    await deepLinkToSubscriptions({ skuAndroid: (yearly ?? monthly)?.id });
  } catch (e) {
    logErr('manageSubscriptions', e);
  }
}
