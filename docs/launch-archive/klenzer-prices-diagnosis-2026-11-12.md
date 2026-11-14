# Klenzer paywall “Couldn’t load prices” diagnosis

**Date:** 12 November 2026, Asia/Dhaka (UTC+6)  
**Scope:** Read-only. No EAS build, no git push, no commit, no App Store Connect or RevenueCat changes.  
**Code read:** `/workspace/7apps/klenzer` branch `klenzer/ios-submit-fixes` at `3f1f8e595d70635705334e536d438c11c35bdba8`.

## Build 15

EAS `build:list` (iOS, last 5, production/store) shows:

- **Build 15** is 1.1.0, profile `production`, distribution STORE, status FINISHED, completed **12 November 2026, 10:34:37 AM Asia/Dhaka**.
- **Git commit:** `3f1f8e595d70635705334e536d438c11c35bdba8` — “Point legal links at app-legal, fix in-app privacy, and drop attribution.”
- That is the current `klenzer/ios-submit-fixes` HEAD. The paywall and offerings code in this checkout **is** the code in build 15. (The only offerings-path difference vs `8078b978`, used for build 12, is a comment in `configurePurchases`. Behaviour is the same.)

Build 15 finished in the morning. The Paid Apps agreement was reported as signed around **1:20 PM Asia/Dhaka** the same day, after the binary was built. Offerings are fetched at runtime, not at build time, so the later signature can still help once it has propagated.

## What the error actually means

In `src/app/paywall.tsx`, the exact copy Samay saw is shown only when loading has finished **and** `plans.length === 0` **and** `purchasesAvailable()` is true:

```115:121:src/app/paywall.tsx
        ) : plans.length === 0 ? (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableTitle}>{purchasesAvailable() ? 'Couldn’t load prices' : 'Purchases aren’t available yet'}</Text>
            <Text style={styles.unavailableBody}>
              {purchasesAvailable() ? 'Check your connection and try again.' : 'This build has no store connection. Install a release or development build to buy.'}
            </Text>
```

`purchasesAvailable()` is `configured === true` (`purchases.ts:19`). That flag is set only after `Purchases.configure({ apiKey })` succeeds with a non-empty key (`purchases.ts:21–33`).

So build 15 **does have a RevenueCat iOS public key**, and configure succeeded. This is not the “Purchases aren’t available yet” empty-key path. “Check your connection” is a generic message; the code also uses it when `getOfferings()` returns no usable current offering or no matching packages.

## (a) Which iOS public key the build uses

- **Source:** `src/lib/config.ts:10` — `RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? ''`.
- **Not** from `app.json` / `app.config` `extra` (only `router` and the EAS project id).
- **Not** from EAS Environment Variables: `eas env:list production` returned **no variables** for the production environment (no secrets were opened).
- **Is** from `eas.json` `build.production.env.EXPO_PUBLIC_RC_IOS_KEY` (the same value is also set on the `development` and `preview` profiles; `simulator` extends `production`). Metro inlines `EXPO_PUBLIC_*` at build time, so this value is baked into the production binary.

The value is an **Apple** public SDK key (`appl_…`), not a Google `goog_` key, and it is non-empty on the production profile. Prefix and last four characters: **`appl_…UGvh`**. Whether that key belongs to the RevenueCat **production** store (vs a test/sandbox project) has to be confirmed in the dashboard; the prefix alone does not distinguish that.

`EXPO_PUBLIC_RC_ANDROID_KEY` is unset in `eas.json`. That does not affect this iOS build (`purchases.ts:15` picks the iOS key on iOS).

## (b) Paywall fetch path and the empty-plans condition

1. `Paywall` mounts and, in a `useEffect` (`paywall.tsx:35–45`), calls `Promise.all([loadOfferings(), storefrontCountry()])`.
2. `loadOfferings()` (`purchases.ts:80–87`):
   - returns `{ main: null, secondChance: null }` immediately if not configured;
   - otherwise `await Purchases.getOfferings()`;
   - sets `main` to **`offerings.current` only** (`o.current ?? null`);
   - looks up an optional `second_chance` offering by id `RC_SECOND_CHANCE_OFFERING`;
   - **swallows all errors** and also returns nulls if `getOfferings()` throws.
3. `plansFor(offering, country)` (`purchases.ts:70–77`) builds the list:
   - lifetime = `offering.lifetime` or the first package with `PACKAGE_TYPE.LIFETIME`;
   - monthly = `offering.monthly` or the first package with `PACKAGE_TYPE.MONTHLY`;
   - **it does not match `com.krosz.klenzer.lifetime` / `com.krosz.klenzer.monthly` (or `$rc_lifetime` / `$rc_monthly` identifiers) by product id**;
   - if `country` is in `LIFETIME_ONLY` (includes **`IN` and `BD`**, `purchases.ts:11–13`), monthly is omitted even if present.
4. `storefrontCountry()` (`purchases.ts:55–64`) prefers `Purchases.getStorefront().countryCode`, else the device locale region, else `'US'`. A device in Dhaka typically resolves to **`BD`**.

The “Couldn’t load prices” UI is therefore shown when configure succeeded, but either:

- `getOfferings()` threw (including StoreKit / ASC / agreement / network failures);
- `offerings.current` is null (no offering marked current, or current has no store products RevenueCat can attach);
- or `current` exists but has no package with type Lifetime (and, for a BD/IN storefront, a Monthly-only offering would also yield **zero** plans).

There is no logging of the RevenueCat error or of `availablePackages`, so those three cases look identical in the UI.

## (c) Configure vs getOfferings race

Unlikely on this build.

`StoreProvider` calls `configurePurchases()` in its boot `useEffect` **before** `setReady(true)` (`store.tsx:113` then `122`). `_layout.tsx:25` does not mount the stack (and therefore cannot mount `paywall`) until `ready` is true. `Purchases.configure` is synchronous. By the time the paywall’s `loadOfferings()` runs, `configured` should already be true.

A leftover race is not needed to explain the copy Samay saw.

## Root cause (and a close second)

**Most likely: RevenueCat returned no current offering (or `getOfferings()` failed) because the App Store products are not yet visible to the SDK.** Evidence: the error is the “key present, plans empty” branch (`paywall.tsx:115–119` + `purchases.ts:80–87`); IAPs are only `READY_TO_SUBMIT` (not approved); the Paid Apps agreement was signed about 1:20 PM Asia/Dhaka, after build 15, and can take a while to propagate; `loadOfferings` uses only `offerings.current` and hides the real failure.

**Second, in the code, and worth fixing anyway:** `plansFor` only accepts RevenueCat’s standard Lifetime / Monthly **package types**. If the dashboard offering has the right product IDs attached as **custom** packages (not `$rc_lifetime` / `$rc_monthly`), `availablePackages` can be non-empty and the UI still shows this error (`purchases.ts:70–77`). That is worse for a tester in Bangladesh: monthly is already filtered out, so a mistyped or monthly-only offering shows nothing.

Both can be true at once. The dashboard checklist below is the first place to look; the code fix makes the app less brittle and less misleading once products are actually returned.

## Suggested code / config fix (not applied)

Config does not need a new key for iOS production; `eas.json` already supplies `EXPO_PUBLIC_RC_IOS_KEY`. Do not put the full key in a commit message or this report.

Suggested logic change: match packages by store product id as well as package type, and if `current` is missing, fall back to any offering that has packages. Keep error details in `__DEV__` only. Still hide monthly in `LIFETIME_ONLY` countries **after** a lifetime package has been resolved.

```diff
--- a/src/lib/purchases.ts
+++ b/src/lib/purchases.ts
@@
+const LIFETIME_PRODUCT_ID = 'com.krosz.klenzer.lifetime';
+const MONTHLY_PRODUCT_ID = 'com.krosz.klenzer.monthly';
+
+function productId(pkg: PurchasesPackage | null | undefined): string {
+  return pkg?.product?.identifier ?? '';
+}
+
 export function plansFor(offering: PurchasesOffering | null, country: string): Plan[] {
   if (!offering) return [];
-  const lifetime = offering.lifetime ?? offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME) ?? null;
-  const monthly = offering.monthly ?? offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY) ?? null;
+  const pkgs = offering.availablePackages ?? [];
+  const lifetime =
+    offering.lifetime ??
+    pkgs.find((p) => p.packageType === PACKAGE_TYPE.LIFETIME) ??
+    pkgs.find((p) => productId(p) === LIFETIME_PRODUCT_ID) ??
+    null;
+  const monthly =
+    offering.monthly ??
+    pkgs.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY) ??
+    pkgs.find((p) => productId(p) === MONTHLY_PRODUCT_ID) ??
+    null;
   const plans: Plan[] = [];
   if (lifetime) plans.push({ pkg: lifetime, kind: 'lifetime', price: lifetime.product.priceString });
   if (monthly && !LIFETIME_ONLY.has(country)) plans.push({ pkg: monthly, kind: 'monthly', price: monthly.product.priceString });
   return plans;
 }

 export async function loadOfferings(): Promise<{ main: PurchasesOffering | null; secondChance: PurchasesOffering | null }> {
   if (!configured) return { main: null, secondChance: null };
   try {
     const o = await Purchases.getOfferings();
-    return { main: o.current ?? null, secondChance: o.all[RC_SECOND_CHANCE_OFFERING] ?? null };
+    const current =
+      o.current ??
+      Object.values(o.all).find((off) => (off.availablePackages?.length ?? 0) > 0) ??
+      null;
+    return { main: current, secondChance: o.all[RC_SECOND_CHANCE_OFFERING] ?? null };
   } catch {
     return { main: null, secondChance: null };
   }
 }
```

Do not treat that fallback as a substitute for fixing the RevenueCat project if `current` is empty for a real reason.

## Must be checked in the RevenueCat dashboard

Confirm all of the following for the **same project** that issued the public iOS key `appl_…UGvh`:

1. An iOS app exists with bundle id **`com.krosz.klenzer`** (production App Store app, not a typo / test app).
2. The **App Store Connect In-App Purchase key / App Store Connect API key** is uploaded in RevenueCat (Project settings → Apple App Store) so RevenueCat can fetch products and prices from ASC.
3. Products **`com.krosz.klenzer.lifetime`** and **`com.krosz.klenzer.monthly`** are imported from App Store Connect and are attached to entitlement **`klenzer_pro`**.
4. There is a **current** offering (`offerings.current`) that includes a **Lifetime** package mapped to `com.krosz.klenzer.lifetime` and a **Monthly** package mapped to `com.krosz.klenzer.monthly` (use the standard `$rc_lifetime` / `$rc_monthly` package types, not only custom types). The optional `second_chance` offering is not required for the first screen.
5. The public iOS SDK key in that project matches `appl_…UGvh` (production store, not a different test project).

Until those are right, the app will keep showing “Couldn’t load prices” even with a valid key in the binary.

## Note on IAP status (READY_TO_SUBMIT)

`com.krosz.klenzer.lifetime` and `com.krosz.klenzer.monthly` being **READY_TO_SUBMIT** means they are not approved yet. Sandbox / TestFlight can still fail to return prices until the products are attached to a version that has been submitted (or until StoreKit / RevenueCat can see them), **or** until the RevenueCat setup above is complete.

The Paid Apps agreement being signed is required, but it **can take a while to propagate**. It was signed around 1:20 PM Asia/Dhaka, after build 15 was produced. If offerings still fail after the dashboard is confirmed, wait for that propagation and try again on a sandbox/TestFlight Apple ID, without needing a new binary for the agreement itself.

