import Purchases, { CustomerInfo, LOG_LEVEL, PACKAGE_TYPE, PurchasesOffering, PurchasesOfferings, PurchasesPackage, PurchasesStoreProduct } from 'react-native-purchases';
import { Platform } from 'react-native';
import { RC_ANDROID_KEY, RC_ENTITLEMENT, RC_IOS_KEY, RC_SECOND_CHANCE_OFFERING } from './config';

/**
 * Pricing comes from App Store Connect / Play Console, so the app never hard-codes a price:
 * it shows whatever the store returns (priceString). Lifetime and monthly plans are offered
 * in every country.
 */

const LIFETIME_PRODUCT_ID = 'com.krosz.klenzer.lifetime';
const MONTHLY_PRODUCT_ID = 'com.krosz.klenzer.monthly';
const PAYWALL_LOG = '[klenzer-paywall]';

const key = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
let configured = false;

/** True once the SDK has a key; without one (e.g. a fresh clone) the paywall shows a friendly "unavailable" state. */
export const purchasesAvailable = () => configured;

/** Configure if needed, then wait until the SDK reports it is ready. */
export async function whenConfigured(): Promise<boolean> {
  if (!configurePurchases()) return false;
  try {
    return await Purchases.isConfigured();
  } catch {
    return configured;
  }
}

export function configurePurchases(): boolean {
  if (configured) return true;
  if (!key) return false;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    // Anonymous RevenueCat app user ID only. Do not collect device identifiers
    // or Apple Search Ads (AdServices) attribution, and do not set utm/campaign attributes.
    Purchases.configure({ apiKey: key });
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export const hasPro = (info: CustomerInfo | null | undefined) => !!info?.entitlements.active[RC_ENTITLEMENT];

export async function currentCustomer(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function onCustomerInfo(cb: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(cb);
  };
}

export type Plan = {
  kind: 'lifetime' | 'monthly';
  price: string;
  pkg?: PurchasesPackage;
  product?: PurchasesStoreProduct;
};

function productId(pkg: PurchasesPackage | null | undefined): string {
  return pkg?.product?.identifier ?? '';
}

function isLifetimePkg(pkg: PurchasesPackage): boolean {
  return pkg.packageType === PACKAGE_TYPE.LIFETIME || productId(pkg) === LIFETIME_PRODUCT_ID;
}

function isMonthlyPkg(pkg: PurchasesPackage): boolean {
  return pkg.packageType === PACKAGE_TYPE.MONTHLY || productId(pkg) === MONTHLY_PRODUCT_ID;
}

function pickLifetime(offering: PurchasesOffering): PurchasesPackage | null {
  return offering.lifetime ?? offering.availablePackages.find(isLifetimePkg) ?? null;
}

function pickMonthly(offering: PurchasesOffering): PurchasesPackage | null {
  return offering.monthly ?? offering.availablePackages.find(isMonthlyPkg) ?? null;
}

function hasMatchingPackages(offering: PurchasesOffering | null | undefined): boolean {
  if (!offering) return false;
  return !!(pickLifetime(offering) || pickMonthly(offering));
}

function samePackage(a: PurchasesPackage, b: PurchasesPackage): boolean {
  return a === b || a.identifier === b.identifier || (productId(a) !== '' && productId(a) === productId(b));
}

function buildPlans(lifetime: PurchasesPackage | null, monthly: PurchasesPackage | null): Plan[] {
  const plans: Plan[] = [];
  if (lifetime) plans.push({ pkg: lifetime, kind: 'lifetime', price: lifetime.product.priceString });
  if (monthly && (!lifetime || !samePackage(monthly, lifetime))) {
    plans.push({ pkg: monthly, kind: 'monthly', price: monthly.product.priceString });
  }
  return plans;
}

function collectMatchingPackages(offerings: Iterable<PurchasesOffering>): {
  lifetime: PurchasesPackage | null;
  monthly: PurchasesPackage | null;
  source: PurchasesOffering | null;
} {
  let lifetime: PurchasesPackage | null = null;
  let monthly: PurchasesPackage | null = null;
  let source: PurchasesOffering | null = null;
  for (const offering of offerings) {
    if (!lifetime) {
      const found = pickLifetime(offering);
      if (found) {
        lifetime = found;
        source = source ?? offering;
      }
    }
    if (!monthly) {
      const found = pickMonthly(offering);
      if (found) {
        monthly = found;
        source = source ?? offering;
      }
    }
    if (lifetime && monthly) break;
  }
  return { lifetime, monthly, source };
}

function offeringFromMatches(
  lifetime: PurchasesPackage | null,
  monthly: PurchasesPackage | null,
  source: PurchasesOffering | null,
): PurchasesOffering | null {
  if (!lifetime && !monthly) return null;
  if (source && pickLifetime(source) === lifetime && pickMonthly(source) === monthly) return source;
  const availablePackages: PurchasesPackage[] = [];
  if (lifetime) availablePackages.push(lifetime);
  if (monthly && (!lifetime || !samePackage(monthly, lifetime))) availablePackages.push(monthly);
  return {
    identifier: source?.identifier ?? 'fallback',
    serverDescription: source?.serverDescription ?? '',
    metadata: source?.metadata ?? {},
    availablePackages,
    lifetime,
    monthly,
    annual: null,
    sixMonth: null,
    threeMonth: null,
    twoMonth: null,
    weekly: null,
    webCheckoutUrl: source?.webCheckoutUrl ?? null,
  };
}

function selectMainOffering(offerings: PurchasesOfferings): PurchasesOffering | null {
  const current = offerings.current ?? null;
  if (hasMatchingPackages(current)) return current;
  const { lifetime, monthly, source } = collectMatchingPackages(Object.values(offerings.all ?? {}));
  return offeringFromMatches(lifetime, monthly, source);
}

/** Picks the plans to show, lifetime first (it is pre-selected). */
export function plansFor(offering: PurchasesOffering | null): Plan[] {
  if (!offering) return [];
  return buildPlans(pickLifetime(offering), pickMonthly(offering));
}

/** Package and product ids only. Never logs API keys or app user IDs. */
export function logPaywallOfferingsDiagnostic(offerings: PurchasesOfferings | null | undefined): void {
  if (!offerings) {
    console.log(PAYWALL_LOG, 'no offerings object (SDK not configured, or getOfferings threw)');
    return;
  }
  console.log(PAYWALL_LOG, {
    all: Object.keys(offerings.all),
    current: offerings.current?.identifier ?? null,
    packages: Object.entries(offerings.all).map(([id, offering]) => ({
      offering: id,
      packages: (offering.availablePackages ?? []).map((pkg) => ({
        identifier: pkg.identifier,
        productIdentifier: pkg.product?.identifier ?? null,
      })),
    })),
  });
}

function errorDetails(e: unknown): { code?: unknown; readableErrorCode: string; underlyingErrorMessage: string; message: string } {
  if (!e || typeof e !== 'object') return { readableErrorCode: '', underlyingErrorMessage: '', message: String(e) };
  const x = e as Record<string, unknown>;
  const userInfo = x.userInfo && typeof x.userInfo === 'object' ? (x.userInfo as Record<string, unknown>) : null;
  return {
    code: x.code,
    readableErrorCode: String(x.readableErrorCode ?? userInfo?.readableErrorCode ?? ''),
    underlyingErrorMessage: String(x.underlyingErrorMessage ?? ''),
    message: String(x.message ?? ''),
  };
}

export function shortPaywallReason(details: { readableErrorCode: string; underlyingErrorMessage: string; message: string }, emptyOfferings = false): string {
  const code = details.readableErrorCode || '';
  const blob = `${details.underlyingErrorMessage} ${details.message}`;
  if (code.includes('CONFIGURATION') || /configuration/i.test(blob)) return 'Purchases isn’t configured correctly.';
  if (code.includes('PRODUCT') || /product(s)? not found|could not find product/i.test(blob)) {
    return 'The store did not return Klenzer’s products.';
  }
  if (/NETWORK|OFFLINE|INTERNET/i.test(code) || /network|offline|internet/i.test(blob)) {
    return 'A network error stopped prices from loading.';
  }
  if (emptyOfferings) return 'No current offering, or the offering has no matching products.';
  if (details.underlyingErrorMessage) return details.underlyingErrorMessage.slice(0, 160);
  if (details.message) return details.message.slice(0, 160);
  return '';
}

function logCaught(action: string, e: unknown) {
  const d = errorDetails(e);
  console.log(PAYWALL_LOG, `${action} failed`, {
    code: d.code,
    readableErrorCode: d.readableErrorCode,
    underlyingErrorMessage: d.underlyingErrorMessage,
    message: d.message,
  });
  return d;
}

async function plansFromStoreProducts(): Promise<Plan[]> {
  const plans: Plan[] = [];
  try {
    const lifetime = await Purchases.getProducts([LIFETIME_PRODUCT_ID], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    const product = lifetime.find((p) => p.identifier === LIFETIME_PRODUCT_ID) ?? lifetime[0];
    if (product?.priceString) plans.push({ kind: 'lifetime', price: product.priceString, product });
    else console.log(PAYWALL_LOG, 'getProducts lifetime returned', lifetime.map((p) => p.identifier));
  } catch (e) {
    logCaught('getProducts lifetime', e);
  }
  try {
    const monthly = await Purchases.getProducts([MONTHLY_PRODUCT_ID], Purchases.PRODUCT_CATEGORY.SUBSCRIPTION);
    const product = monthly.find((p) => p.identifier === MONTHLY_PRODUCT_ID) ?? monthly[0];
    if (product?.priceString) plans.push({ kind: 'monthly', price: product.priceString, product });
    else console.log(PAYWALL_LOG, 'getProducts monthly returned', monthly.map((p) => p.identifier));
  } catch (e) {
    logCaught('getProducts monthly', e);
  }
  return plans;
}

export type OfferingsLoad = {
  main: PurchasesOffering | null;
  secondChance: PurchasesOffering | null;
  raw: PurchasesOfferings | null;
  plans: Plan[];
  error: string | null;
};

export async function loadOfferings(): Promise<OfferingsLoad> {
  const empty: OfferingsLoad = { main: null, secondChance: null, raw: null, plans: [], error: null };
  if (!(await whenConfigured())) {
    console.log(PAYWALL_LOG, 'SDK is not configured; skipping getOfferings');
    return { ...empty, error: 'Purchases aren’t configured in this build.' };
  }
  let raw: PurchasesOfferings | null = null;
  let offeringsError: ReturnType<typeof errorDetails> | null = null;
  try {
    raw = await Purchases.getOfferings();
    logPaywallOfferingsDiagnostic(raw);
  } catch (e) {
    offeringsError = logCaught('getOfferings', e);
  }
  const main = raw ? selectMainOffering(raw) : null;
  const secondChance = raw?.all[RC_SECOND_CHANCE_OFFERING] ?? null;
  let plans = plansFor(main);
  if (plans.length === 0) {
    console.log(PAYWALL_LOG, 'offerings empty or unmatched, trying getProducts fallback');
    plans = await plansFromStoreProducts();
  }
  let error: string | null = null;
  if (plans.length === 0) {
    error = offeringsError
      ? shortPaywallReason(offeringsError)
      : shortPaywallReason({ readableErrorCode: '', underlyingErrorMessage: '', message: '' }, true);
  }
  return { main, secondChance, raw, plans, error };
}

export type BuyResult = 'purchased' | 'cancelled' | 'error';

export async function buy(plan: Plan): Promise<BuyResult> {
  try {
    const result = plan.pkg
      ? await Purchases.purchasePackage(plan.pkg)
      : plan.product
        ? await Purchases.purchaseStoreProduct(plan.product)
        : null;
    if (!result) return 'error';
    return hasPro(result.customerInfo) ? 'purchased' : 'error';
  } catch (e) {
    const d = errorDetails(e);
    if ((e as { userCancelled?: boolean })?.userCancelled) return 'cancelled';
    logCaught('purchase', e);
    void d;
    return 'error';
  }
}

export async function restore(): Promise<boolean> {
  try {
    return hasPro(await Purchases.restorePurchases());
  } catch {
    return false;
  }
}
