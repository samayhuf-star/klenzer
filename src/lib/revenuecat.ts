/**
 * RevenueCat integration shared by all Krosz apps (same file in every repo).
 *
 * What this wires up, so everything shows in the RevenueCat dashboard:
 *  - SDK configured per platform with trusted-entitlement verification (informational)
 *  - Subscriber attributes (app version, build, locale, OS, platform) for segmentation and Targeting
 *  - Campaign attribution ($campaign, $mediaSource ...) captured from utm_* deep links
 *  - Apple Search Ads (AdServices) attribution + device identifiers for attribution integrations
 *  - Remote paywalls (RevenueCat Paywalls) with the paywall source stored on the customer
 *  - Customer Center (manage / cancel / refund / restore)
 *  - Entitlement hook, restore, sync, identify / log out
 *
 * Paywall impressions, closes and conversions are tracked by RevenueCat automatically whenever
 * a RevenueCat paywall is shown; offerings, products and the paywall design live in the dashboard.
 */
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export type RevenueCatOptions = {
  /** Entitlement identifier configured in the RevenueCat dashboard. */
  entitlementId: string;
  /** Public SDK keys (safe to ship). Set as EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY in EAS. */
  iosKey?: string;
  androidKey?: string;
  /** Optional: identify the user with your own stable id instead of an anonymous RevenueCat id. */
  appUserId?: string;
};

let opts: RevenueCatOptions | null = null;
let configured = false;
let initPromise: Promise<boolean> | null = null;
let active = false;
let latest: CustomerInfo | null = null;
const listeners = new Set<(info: CustomerInfo | null, active: boolean) => void>();

const isPlaceholder = (k?: string) => !k || k.includes('REPLACE_ME');

function publish(info: CustomerInfo | null) {
  latest = info;
  active = !!(info && opts && info.entitlements.active[opts.entitlementId]);
  listeners.forEach((l) => l(info, active));
}

export const isRevenueCatReady = () => configured;
export const isEntitled = () => active;
export const getLatestCustomerInfo = () => latest;

/** Call once at app start (root layout / App.tsx). Safe to call repeatedly. */
export function initRevenueCat(options: RevenueCatOptions): Promise<boolean> {
  opts = options;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const apiKey = Platform.OS === 'ios' ? options.iosKey : options.androidKey;
    if (Platform.OS === 'web' || isPlaceholder(apiKey)) return false; // key not set in this build
    try {
      // Configure synchronously (before the first await) so callers can check isRevenueCatReady() right away.
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN).catch(() => {});
      Purchases.configure({
        apiKey: apiKey as string,
        appUserID: options.appUserId ?? null,
        entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
      });
      configured = true;
      Purchases.addCustomerInfoUpdateListener(publish);

      // Attribution + device identifiers (feeds RevenueCat attribution integrations and Charts).
      Purchases.collectDeviceIdentifiers().catch(() => {});
      if (Platform.OS === 'ios') Purchases.enableAdServicesAttributionTokenCollection().catch(() => {});

      // Subscriber attributes: visible on the customer profile, usable for Targeting and Experiments.
      const cfg = Constants.expoConfig;
      Purchases.setAttributes({
        app_version: cfg?.version ?? null,
        app_build: String(cfg?.ios?.buildNumber ?? cfg?.android?.versionCode ?? ''),
        app_name: cfg?.name ?? null,
        locale: safeLocale(),
        os_version: String(Platform.Version),
        platform: Platform.OS,
      }).catch(() => {});

      captureCampaignFromUrl().catch(() => {});
      publish(await Purchases.getCustomerInfo());
      return true;
    } catch {
      // Offline or misconfigured: the app keeps running on its free tier.
      return configured;
    }
  })();
  return initPromise;
}

function safeLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

/** Reads utm_* / ref params from the launch URL and stores them as RevenueCat campaign attributes. */
export async function captureCampaignFromUrl(url?: string | null) {
  if (!configured) return;
  const link = url ?? (await Linking.getInitialURL());
  if (!link || !link.includes('?')) return;
  const q = new URLSearchParams(link.split('?')[1].split('#')[0]);
  const attrs: Record<string, string | null> = {
    $campaign: q.get('utm_campaign'),
    $mediaSource: q.get('utm_source'),
    $adGroup: q.get('utm_medium'),
    $keyword: q.get('utm_term'),
    $creative: q.get('utm_content'),
    referrer: q.get('ref'),
  };
  if (Object.values(attrs).some(Boolean)) await Purchases.setAttributes(attrs);
}

/** Record a one-off milestone on the customer (e.g. "first_scan"). Stored once, as an ISO date. */
const seen = new Set<string>();
export function markMilestone(name: string) {
  if (!configured || seen.has(name)) return;
  seen.add(name);
  Purchases.setAttributes({ [`milestone_${name}`]: new Date().toISOString().slice(0, 10) }).catch(() => {});
}

export function setCustomAttributes(attrs: Record<string, string | null>) {
  if (configured) Purchases.setAttributes(attrs).catch(() => {});
}

/** React hook: current entitlement state, updates live after purchases, restores and refunds. */
export function useEntitlement() {
  const [state, setState] = useState({ active, loading: !latest && !initPromise });
  useEffect(() => {
    const cb = (_i: CustomerInfo | null, a: boolean) => setState({ active: a, loading: false });
    listeners.add(cb);
    initPromise?.finally(() => setState({ active, loading: false }));
    setState({ active, loading: !latest && !!initPromise });
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return state;
}

const WON = [PAYWALL_RESULT.PURCHASED, PAYWALL_RESULT.RESTORED];

/**
 * Show the RevenueCat paywall configured for the current offering (design + prices come from the
 * dashboard, so they can change without an app update). Resolves true when the user ends up entitled.
 */
export async function presentPaywall(source: string, offering?: PurchasesOffering): Promise<boolean> {
  if (!configured) return false;
  setCustomAttributes({ last_paywall_source: source, last_paywall_at: new Date().toISOString() });
  try {
    const result = await RevenueCatUI.presentPaywall(offering ? { offering } : undefined);
    return WON.includes(result);
  } catch {
    return active;
  }
}

/** Gate a premium action: resolves true immediately for subscribers, otherwise shows the paywall. */
export async function requirePro(source: string): Promise<boolean> {
  if (active) return true;
  if (!configured) return false;
  setCustomAttributes({ last_paywall_source: source, last_paywall_at: new Date().toISOString() });
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: opts!.entitlementId });
    return result === PAYWALL_RESULT.NOT_PRESENTED || WON.includes(result);
  } catch {
    return false;
  }
}

/** Manage / cancel / request refund / restore, hosted by RevenueCat. */
export async function openCustomerCenter() {
  if (!configured) return;
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch {
    // Customer Center needs a dev/production build; ignore in preview runtimes.
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  publish(info);
  return active;
}

export async function syncPurchases() {
  if (configured) await Purchases.syncPurchases().catch(() => {});
}

export async function identify(appUserId: string) {
  if (!configured) return;
  const { customerInfo } = await Purchases.logIn(appUserId);
  publish(customerInfo);
}

export async function logOutUser() {
  if (!configured) return;
  publish(await Purchases.logOut());
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    return (await Purchases.getOfferings()).current ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    publish(customerInfo);
    return active;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}
