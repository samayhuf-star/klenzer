import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import { defaultPlanKind, PRODUCT_CATALOG, productIds, type PlanKind, type ProductDef } from './products';
import { RC_ENTITLEMENT } from './config';
import { DEMO } from './demo';

/**
 * RevenueCat is the only purchase layer. Prices, trials and receipts come from RevenueCat and the store.
 * The public SDK key is not a secret; it is set per platform in eas.json.
 */
const LOG = '[klenzer-purchases]';
const RC_KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

export type { PlanKind };
export { defaultPlanKind, PRODUCT_CATALOG };

export type Plan = ProductDef & {
  price: string;
  product: PurchasesStoreProduct | null;
  /** Set when the offering returned a package; otherwise the product is bought directly. */
  pkg: PurchasesPackage | null;
  /** Set only when the store reports a free trial AND this user is eligible. Lifetime is always null. */
  trialDays: number | null;
};

export type BuyResult = 'purchased' | 'cancelled' | 'pending' | 'error';
export type PlansLoad = { plans: Plan[]; error: string | null };
export type RestoreResult = 'restored' | 'none' | 'cancelled' | 'error';

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
/** One friendly line for the paywall. Never a raw store error. */
export const PLANS_UNAVAILABLE_MESSAGE = `We couldn’t reach the ${STORE_NAME} just now. Check your connection, then tap Retry.`;

const entitlementListeners = new Set<(isPro: boolean) => void>();
let configured = false;
let listening = false;

/** Small diagnostics for the support screen. Never contains secrets. */
export type StoreDebug = { platform: string; configured: boolean; lastError: string | null };
const debug: StoreDebug = { platform: Platform.OS, configured: false, lastError: null };
const debugListeners = new Set<(d: StoreDebug) => void>();
export const getStoreDebug = (): StoreDebug => ({ ...debug });
export function onStoreDebugChange(cb: (d: StoreDebug) => void): () => void {
  debugListeners.add(cb);
  return () => {
    debugListeners.delete(cb);
  };
}
export const storeDebugLine = (d: StoreDebug = getStoreDebug()) =>
  `${d.platform} | revenuecat ${d.configured ? 'yes' : 'no'} | last error ${d.lastError ?? 'none'}`;
const logErr = (where: string, e: unknown) => {
  const err = e as { code?: unknown; message?: string };
  console.log(LOG, `${where} failed`, { code: err?.code, message: err?.message });
  debug.lastError = `${where} ${String(err?.code ?? '')} ${err?.message ?? ''}`.trim();
  debugListeners.forEach((cb) => cb(getStoreDebug()));
};

/** The user has Pro when the klenzer_pro entitlement is active. Any active catalog product also counts, so a product that is not yet mapped to the entitlement in RevenueCat still unlocks. */
export function hasPro(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  if (info.entitlements.active[RC_ENTITLEMENT]) return true;
  const ids = new Set(productIds());
  return info.activeSubscriptions.some((id) => ids.has(id.split(':')[0])) || info.nonSubscriptionTransactions.some((t) => ids.has(t.productIdentifier));
}

const emitPro = (info: CustomerInfo) => {
  const pro = hasPro(info);
  entitlementListeners.forEach((cb) => cb(pro));
};

function configure(): boolean {
  if (configured) return true;
  if (!RC_KEY) {
    logErr('configure', { code: 'no-key', message: 'RevenueCat SDK key missing' });
    return false;
  }
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: RC_KEY });
    configured = true;
    debug.configured = true;
  } catch (e) {
    logErr('configure', e);
    return false;
  }
  if (!listening) {
    listening = true;
    Purchases.addCustomerInfoUpdateListener(emitPro);
  }
  return true;
}

const SYNCED_KEY = 'klenzer.rc.synced.v1';

/**
 * Versions up to 1.1.1 sold Pro through StoreKit directly, so RevenueCat has never seen those receipts.
 * Send them once, silently. syncPurchases does not show the Apple ID prompt (restorePurchases can).
 * The flag is only set after a successful sync, so a failed attempt is retried on the next launch.
 */
async function syncLegacyPurchasesOnce(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(SYNCED_KEY)) === '1') return;
    await Purchases.syncPurchases();
    await AsyncStorage.setItem(SYNCED_KEY, '1');
  } catch (e) {
    logErr('syncPurchases', e);
  }
}

/** Configure RevenueCat and listen for customer changes. Never restores — that can prompt for the Apple ID. */
export async function initIAP(): Promise<boolean> {
  if (!configure()) return false;
  if (!DEMO) await syncLegacyPurchasesOnce();
  return true;
}

const isCancel = (e: unknown) => {
  const err = e as { userCancelled?: boolean | null; code?: unknown } | null;
  return !!err?.userCancelled || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
};
const isPending = (e: unknown) => (e as { code?: unknown } | null)?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR;

const DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
function freeTrialDays(product: PurchasesStoreProduct | null): number | null {
  const intro = product?.introPrice;
  if (!intro || intro.price !== 0) return null;
  const per = DAYS[String(intro.periodUnit).toUpperCase()];
  if (!per) return null;
  const days = per * (intro.periodNumberOfUnits || 1) * (intro.cycles || 1);
  return days > 0 ? days : null;
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Offering packages first; if the offering is empty or missing, fall back to the store products so the paywall never goes blank. */
async function fetchProducts(): Promise<Map<string, { product: PurchasesStoreProduct; pkg: PurchasesPackage | null }>> {
  const byId = new Map<string, { product: PurchasesStoreProduct; pkg: PurchasesPackage | null }>();
  try {
    const offerings = await Purchases.getOfferings();
    for (const pkg of offerings.current?.availablePackages ?? []) {
      if (productIds().includes(pkg.product.identifier)) byId.set(pkg.product.identifier, { product: pkg.product, pkg });
    }
  } catch (e) {
    logErr('getOfferings', e);
  }
  const missing = productIds().filter((id) => !byId.has(id));
  if (missing.length) {
    try {
      for (const product of await Purchases.getProducts(missing)) {
        if (productIds().includes(product.identifier)) byId.set(product.identifier, { product, pkg: null });
      }
    } catch (e) {
      logErr('getProducts', e);
    }
  }
  return byId;
}

export async function loadPlans(): Promise<PlansLoad> {
  // Dev web screenshots only. Production never sets DEMO, so store prices stay live.
  if (DEMO) {
    const priceFor = (kind: PlanKind) => (kind === 'yearly' ? '$19.99' : kind === 'monthly' ? '$3.99' : kind === 'weekly' ? '$1.99' : '$29.99');
    return {
      plans: PRODUCT_CATALOG.map((def) => ({ ...def, price: priceFor(def.kind), product: null, pkg: null, trialDays: def.type === 'subs' ? 7 : null })),
      error: null,
    };
  }
  if (!configure()) return { plans: [], error: PLANS_UNAVAILABLE_MESSAGE };
  let byId = new Map<string, { product: PurchasesStoreProduct; pkg: PurchasesPackage | null }>();
  for (const delay of [0, 1200, 2500]) {
    if (delay) await wait(delay);
    byId = await fetchProducts();
    if (byId.size) break;
  }
  if (!byId.size) return { plans: [], error: PLANS_UNAVAILABLE_MESSAGE };

  // Trial copy only for users StoreKit / Play says can still use the intro offer. Errors count as not eligible.
  let eligible: Record<string, { status: INTRO_ELIGIBILITY_STATUS }> = {};
  try {
    eligible = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds('subs'));
  } catch (e) {
    logErr('introEligibility', e);
  }
  const plans: Plan[] = [];
  for (const def of PRODUCT_CATALOG) {
    const hit = byId.get(def.id);
    if (!hit) continue;
    const days = def.type === 'subs' ? freeTrialDays(hit.product) : null;
    const ok = eligible[def.id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    plans.push({ ...def, price: hit.product.priceString, product: hit.product, pkg: hit.pkg, trialDays: days && ok ? days : null });
  }
  return plans.length ? { plans, error: null } : { plans: [], error: PLANS_UNAVAILABLE_MESSAGE };
}

export async function refreshEntitlements(): Promise<boolean> {
  if (!configure()) return false;
  try {
    return hasPro(await Purchases.getCustomerInfo());
  } catch (e) {
    logErr('getCustomerInfo', e);
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
  if (!configure() || !(plan.pkg || plan.product)) return 'error';
  try {
    const { customerInfo } = plan.pkg ? await Purchases.purchasePackage(plan.pkg) : await Purchases.purchaseStoreProduct(plan.product as PurchasesStoreProduct);
    emitPro(customerInfo);
    return hasPro(customerInfo) ? 'purchased' : 'error';
  } catch (e) {
    if (isCancel(e)) return 'cancelled';
    if (isPending(e)) return 'pending';
    logErr('purchase', e);
    return 'error';
  }
}

/** Runs only when the user taps Restore. A cancelled Apple ID prompt returns 'cancelled' so the UI stays silent. */
export async function restore(): Promise<RestoreResult> {
  if (!configure()) return 'error';
  try {
    const info = await Purchases.restorePurchases();
    emitPro(info);
    return hasPro(info) ? 'restored' : 'none';
  } catch (e) {
    if (isCancel(e)) return 'cancelled';
    logErr('restore', e);
    return 'error';
  }
}

/** RevenueCat Customer Center: manage, cancel, restore, refund request. Falls back to the store's own page. */
export async function openCustomerCenter(): Promise<void> {
  try {
    if (!configure()) throw new Error('not configured');
    const ui = require('react-native-purchases-ui') as typeof import('react-native-purchases-ui');
    await ui.default.presentCustomerCenter();
    emitPro(await Purchases.getCustomerInfo());
  } catch (e) {
    logErr('customerCenter', e);
    await manageSubscriptions();
  }
}

/** Open the store's subscription manager. */
export async function manageSubscriptions(): Promise<void> {
  try {
    const info = configure() ? await Purchases.getCustomerInfo() : null;
    await Linking.openURL(info?.managementURL ?? (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions'));
  } catch (e) {
    logErr('manageSubscriptions', e);
  }
}
