# Klenzer paywall audit: "Couldn't load prices" on build 18

**Date:** 12 November 2026, about 4:40 PM Asia/Dhaka (UTC+6)
**Scope:** Read-only. No ASC writes were needed. Nothing was submitted, no IAP was attached to a review, no prices changed, no builds or build attachments touched, Klarity untouched.
**App:** Klenzer - Clean Photo Clutter, ASC 6820685404, bundle `com.krosz.klenzer` (bundleId 9D44FPTAA3, capability IN_APP_PURCHASE). Version 1.1.0 is PREPARE_FOR_SUBMISSION.
**Code read:** `klenzer/v2` at `02c024c` (build 18) in `/workspace/klenzer-v2-audit`. The branch tip is now `7536574` (scan fixes), and it doesn't touch `purchases.ts`, `paywall.tsx` or `config.ts`.

## Root cause (confirmed)

**The RevenueCat project behind the app's key has no products. Its only offering, `default`, has zero packages.** App Store Connect is set up correctly, and so is the app code.

The app's public iOS key (`appl_…UGvh`, from `eas.json` production env) was used read-only against RevenueCat's public SDK endpoints. These are the same calls the app makes on every launch:

| Endpoint | Result |
| --- | --- |
| `GET /v1/subscribers/<anon>/offerings` | 200. `current_offering_id: "default"`. Offerings: one, `default` ("The standard set of packages"), with **`packages: []`** |
| `GET /v1/subscribers/<anon>/health_report` | 200. project `c41fcfb2`, app `appc001da49f6`. Overall **failed**. `api_key` passed, `bundle_id` **passed** (so the RC iOS app bundle ID matches `com.krosz.klenzer`), `products` **failed** with `products: []` |
| `GET /v1/product_entitlement_mapping` | 200. **`{}`**, so no product is mapped to any entitlement (`klenzer_pro` unlocks nothing) |

The app code gets an empty offering, finds no lifetime or monthly package in any offering, and falls into the "Couldn't load prices / Check your connection" branch. **No new binary is needed.** Offerings load at runtime, so build 18 should show prices as soon as the dashboard is fixed. That is also why the code-side fallback in build 17 changed nothing: there are no packages for it to find.

## Fix, and who makes it

**Samay, in the RevenueCat dashboard** (project `c41fcfb2`, iOS app `appc001da49f6`). Agents have no RC secret key or dashboard access.

1. **Products:** add `com.krosz.klenzer.lifetime` (non-consumable) and `com.krosz.klenzer.monthly` (auto-renewable, 1 month) to the iOS App Store app. You can import them from ASC or type the IDs exactly.
2. **Entitlements:** create entitlement **`klenzer_pro`** (exact identifier the code checks) and attach both products.
3. **Offerings → `default`** (already current): add package **Lifetime (`$rc_lifetime`)** → `com.krosz.klenzer.lifetime` and package **Monthly (`$rc_monthly`)** → `com.krosz.klenzer.monthly`.
4. **App settings → In-App Purchase Key:** upload an App Store Connect **In-App Purchase key** (.p8, created in ASC → Users and Access → Integrations → In-App Purchase). react-native-purchases 11 uses StoreKit 2, so without this key purchases won't validate even after prices show. Also add the ASC API key (for product import) and the App-Specific Shared Secret if RC asks for them. I can't see whether any of these are already uploaded.
5. **Test:** kill and reopen Klenzer build 18 from TestFlight, then open the paywall. If it still fails, re-run the health report (below) and check the `offerings_products` check.

**7 Apps Launch Bot (optional, not blocking):** the user-facing copy "Check your connection" is misleading for a config error. Consider a `__DEV__`/TestFlight-visible error string. No code change is needed for the fix.

## 1. App Store Connect products

| productId | Type | ASC id | State | Price (base) | Localizations | Review screenshot | Availability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `com.krosz.klenzer.lifetime` | NON_CONSUMABLE ("Klenzer Pro Lifetime") | 6829830806 | **READY_TO_SUBMIT** | Base USA, manual USA **$14.99** (proceeds $12.74). Every other territory uses Apple's automatic equalization | en-US "Klenzer Pro Lifetime" (PREPARE_FOR_SUBMISSION) | Present, 1290×2796, `assetDeliveryState: COMPLETE` | 175/175 territories, availableInNewTerritories true |
| `com.krosz.klenzer.monthly` | AUTO_RENEWABLE, period **ONE_MONTH** ("Klenzer Pro Monthly"), groupLevel 1 | 6833133616 | **READY_TO_SUBMIT** | USA **$3.99** (proceeds $3.39). 175 territory prices (USA equalizations) | en-US "Klenzer Pro Monthly" (PREPARE_FOR_SUBMISSION) | Present, 1290×2796, COMPLETE | 175/175 territories, availableInNewTerritories true |

- **Subscription group:** "Klenzer Pro" (id 22565864). Group localization en-US "Klenzer Pro" exists (PREPARE_FOR_SUBMISSION, normal before first review).
- **Other products:** no other IAPs or subscriptions exist. There are no introductory offers, promoted purchases or hosted content.
- **States:** none are in MISSING_METADATA or DEVELOPER_ACTION_NEEDED. READY_TO_SUBMIT products can be fetched in TestFlight/sandbox, so ASC is not the blocker.
- **Gaps fixed:** none needed; nothing was written.
- **Price FYI:** live prices are $14.99 lifetime and $3.99 monthly, set earlier today. They are not Samay's $29.99 / $2.99 defaults and there is no yearly plan. I left them as they are, as instructed.

## 2. Paid Apps agreement, tax and banking

Re-probed now: `/v1/agreements`, `/v1/contracts`, `/v1/taxForms` and `/v1/bankAccounts` all return **HTTP 404**. The App Store Connect API has no resource for agreement, tax or banking status, so **this can't be confirmed via the API**. "Paid Apps is done" came from Samay via an agent and hasn't been verified independently. Territory statuses (CANNOT_SELL + AVAILABLE_FOR_SALE_UNRELEASED_APP, no MISSING_CONTRACT) are consistent with an unreleased app and don't point to an agreement problem. RevenueCat's failure is upstream of this anyway: RC has no products configured at all.

## 3. RevenueCat and app code

- **Key:** `EXPO_PUBLIC_RC_IOS_KEY` is prefix **`appl_`** (…UGvh) in the production, preview and development profiles of `eas.json`. It's valid (health `api_key` passed). There is no Android key.
- **Code requests** (`src/lib/purchases.ts`, `src/lib/config.ts` at 02c024c):
  - It calls `Purchases.getOfferings()` and uses `current` if it has a lifetime or monthly package. Otherwise it scans all offerings.
  - It matches packages by type LIFETIME/MONTHLY **or** product ID `com.krosz.klenzer.lifetime` / `com.krosz.klenzer.monthly`. Those match ASC exactly.
  - Entitlement: `klenzer_pro`. Optional offering: `second_chance` (not required).
- **Error path:** `paywall.tsx:115-119` shows "Couldn't load prices / Check your connection and try again" when the SDK is configured (key present) and `plansFor(main)` is empty. That happens if `getOfferings()` throws, or if no offering has a matching package. Here it's the second case: `default` has `packages: []`.
- **RevenueCat secret (`sk_`) key:** none found in the environment or under `/home/box/shared/app-monitor/secrets/` (which holds only the ASC .p8, firebase-testlab.json and the Play service account), and none in the repo. So I **can't see**:
  - the dashboard product list beyond what the SDK returns
  - whether an In-App Purchase key, ASC API key or shared secret is uploaded
  - the RC project name
- **Common causes checked:**
  - RC bundle-ID mismatch: no, health `bundle_id` passed.
  - Products not attached to the current offering: **yes, the cause**. There are no products at all.
  - No IAP key in RC: unknown (not visible). Required anyway.
  - StoreKit config files: none in the repo (no `.storekit`).
  - Subscription group without localization: no, en-US exists.

## How to re-check without dashboard access

Re-run `/workspace/klenzer-audit/rc.py` with the venv python (`/workspace/venv-asc/bin/python`). It reads the public key from `eas.json` and never prints it. Success looks like `default` having two packages, health `products` passed, and a non-empty `product_entitlement_mapping`.

## Update 4:31 PM pricing changes

**Done:** 12 November 2026 (Asia/Dhaka, UTC+6), shortly after the 4:31 PM BDT request, via the ASC API (key UGN74BU5SZ). Samay asked for this via COO → Monitoring of Apps at 4:31 PM BDT.
**RevenueCat removed:** RevenueCat has been removed from Klenzer in favour of **StoreKit 2** directly, so the RevenueCat root cause and dashboard steps above **no longer apply**. StoreKit 2 fetches products straight from App Store Connect by product ID.
**Not done (by design):** nothing submitted, no IAP attached to a review, no builds, Klenzer 1.1.0's build attachment untouched, Klarity untouched, no RevenueCat work.

### Products after the change (fresh read)

| productId | ASC id | Type | State | USA | IN | GB | DE | Territories |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `com.krosz.klenzer.yearly` (**new**) | 6833884989 | Auto-renewable, ONE_YEAR, group "Klenzer Pro" level **1** | **READY_TO_SUBMIT** | **$19.99** | ₹1,999 | £19.99 | €22.99 | 175 prices / 175 available, availableInNewTerritories true |
| `com.krosz.klenzer.monthly` (price unchanged) | 6833133616 | Auto-renewable, ONE_MONTH, group level **2** (was 1) | **READY_TO_SUBMIT** | $3.99 | ₹399 | £3.99 | €3.99 | 175 / 175 |
| `com.krosz.klenzer.lifetime` | 6829830806 | Non-consumable | **READY_TO_SUBMIT** | **$29.99** (was $14.99) | ₹2,999 | £29.99 | €34.99 | base USA manual, 174 auto-equalized |

### What was done

1. **Yearly created** in group 22565864: reference name "Klenzer Pro Yearly", ONE_YEAR, familySharable false (same as monthly), review note copied from monthly. en-US localization "Klenzer Pro Yearly" / "Unlock Pro cleaning features, billed yearly." Availability: the same 175 territories as monthly. Prices: USA $19.99 price point plus Apple's USA equalizations for all 174 other territories (175 subscriptionPrices, startDate null). Review screenshot: `klenzer-store/screenshots/6.7/02.png` (Duplicates screen, 1290×2796), the same file as monthly and lifetime (checksum 7bf939c6…5d), delivery state COMPLETE.
2. **Group ranking:** lifetime is a non-consumable and isn't in the group, so the ranking only covers the two subscriptions. Yearly is level 1 and monthly is level 2, confirmed by a fresh read.
3. **Lifetime raised to $29.99:** a new inAppPurchasePriceSchedule with base territory USA, $29.99 manual price, startDate null (effective immediately). There were no manual non-USA overrides before or after; the only manual price is USA, and the other 174 territories are auto-equalized.
4. **Monthly price unchanged** at $3.99. Its only change is groupLevel 1 → 2, for the ranking.

### API refusals or issues

None. One transient connection drop during the yearly price creation was retried, and every territory ended up with exactly one price. Paid Apps agreement, tax and banking still can't be read via the API (see section 2).
