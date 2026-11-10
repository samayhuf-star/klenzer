import Purchases, { CustomerInfo, LOG_LEVEL, PACKAGE_TYPE, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { RC_ANDROID_KEY, RC_ENTITLEMENT, RC_IOS_KEY, RC_SECOND_CHANCE_OFFERING } from './config';

/**
 * Pricing is set per country in App Store Connect / Play Console, so the app never hard-codes a price:
 * it shows whatever the store returns (priceString). The only market-specific rule here is WHICH plans to show.
 *   - India and similar low-price markets: lifetime only (store price ₹599 for India).
 *   - Everywhere else: monthly ($3.99) and lifetime ($14.99).
 */
const LIFETIME_ONLY = new Set([
  'IN', 'PK', 'BD', 'LK', 'NP', 'ID', 'PH', 'VN', 'EG', 'NG', 'KE', 'GH', 'ZA', 'MA', 'DZ', 'TN', 'BR', 'MX', 'CO', 'PE', 'AR', 'TR', 'UA', 'TH', 'MY',
]);

const key = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
let configured = false;

/** True once the SDK has a key; without one (e.g. a fresh clone) the paywall shows a friendly "unavailable" state. */
export const purchasesAvailable = () => configured;

export function configurePurchases(): boolean {
  if (configured) return true;
  if (!key) return false;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
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

export async function storefrontCountry(): Promise<string> {
  try {
    const s = await Purchases.getStorefront();
    if (s?.countryCode) return s.countryCode.toUpperCase();
  } catch {}
  try {
    const region = Intl.DateTimeFormat().resolvedOptions().locale.split('-').pop();
    if (region && region.length === 2) return region.toUpperCase();
  } catch {}
  return 'US';
}

export type Plan = { pkg: PurchasesPackage; kind: 'lifetime' | 'monthly'; price: string };

/** Picks the plans to show for this storefront, lifetime first (it is pre-selected). */
export function plansFor(offering: PurchasesOffering | null, country: string): Plan[] {
  if (process.env.EXPO_PUBLIC_PAYWALL_PREVIEW === '1') {
    // Screenshot builds only: show sample prices so the paywall can be captured for App Review.
    return [
      { pkg: {} as never, kind: 'lifetime', price: '$14.99' },
      { pkg: {} as never, kind: 'monthly', price: '$3.99' },
    ];
  }
  if (!offering) return [];
  const lifetime = offering.lifetime ?? offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME) ?? null;
  const monthly = offering.monthly ?? offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY) ?? null;
  const plans: Plan[] = [];
  if (lifetime) plans.push({ pkg: lifetime, kind: 'lifetime', price: lifetime.product.priceString });
  if (monthly && !LIFETIME_ONLY.has(country)) plans.push({ pkg: monthly, kind: 'monthly', price: monthly.product.priceString });
  return plans;
}

export async function loadOfferings(): Promise<{ main: PurchasesOffering | null; secondChance: PurchasesOffering | null }> {
  if (!configured) return { main: null, secondChance: null };
  try {
    const o = await Purchases.getOfferings();
    return { main: o.current ?? null, secondChance: o.all[RC_SECOND_CHANCE_OFFERING] ?? null };
  } catch {
    return { main: null, secondChance: null };
  }
}

export type BuyResult = 'purchased' | 'cancelled' | 'error';

export async function buy(pkg: PurchasesPackage): Promise<BuyResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPro(customerInfo) ? 'purchased' : 'error';
  } catch (e) {
    return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'error';
  }
}

export async function restore(): Promise<boolean> {
  try {
    return hasPro(await Purchases.restorePurchases());
  } catch {
    return false;
  }
}
