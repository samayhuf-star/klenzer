# Klenzer legal pages and App Privacy answers

**Date:** 12 November 2026, Asia/Dhaka (UTC+6)  
**Updated:** 12 November 2026, later the same morning, after submit-fix work on the 1.1.0 paywall base.  
**Code branch used for the legal/privacy answers:** `feature/revenuecat-paywall` commit `8078b978` (“Bump version to 1.1.0”), which is the git commit for ASC iOS build 12 (version 1.1.0), plus the submit-fix branch `klenzer/ios-submit-fixes` built from that commit. Compared earlier with `main` at `0c10f20` and `revenuecat-integration` at `789a808`. No App Store Connect, EAS, or Vercel actions were taken in this task, other than regular git pushes of legal/code branches.

**Legal-pages commits on `samayhuf-star/app-legal` `main` (regular push, not a force push):**
- `4c0c968c76f17258b35fc5dfb2083411296ec45d` — initial Klenzer pages
- Follow-up commit `8dcaf4452c8c21f8fb06c3a46c394ba0cf077c55` removes device-identifier and attribution claims from `klenzer/privacy.html` so the live policy matches the 1.1.0 code (no `collectDeviceIdentifiers`, no AdServices, no utm/campaign setters).

## Live URLs

| Page | URL | Status |
|---|---|---|
| Home | https://samayhuf-star.github.io/app-legal/klenzer/ | 200 (published earlier) |
| Privacy | https://samayhuf-star.github.io/app-legal/klenzer/privacy.html | 200, updated copy live (no device-identifier collection) |
| Terms | https://samayhuf-star.github.io/app-legal/klenzer/terms.html | 200 |
| Support | https://samayhuf-star.github.io/app-legal/klenzer/support.html | 200 |

Effective date on Privacy and Terms is the literal placeholder `[EFFECTIVE DATE – LAUNCH DAY]`. Contact on all pages is samayhuf@gmail.com only (no phone).

In-app and config URLs on the 1.1.0 submit-fix branch are:

- Privacy: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html
- Terms: https://samayhuf-star.github.io/app-legal/klenzer/terms.html
- Support: https://samayhuf-star.github.io/app-legal/klenzer/support.html

The previous Vercel host (`https://klenzer-privacy-krosz.vercel.app`) has been removed from the 1.1.0 submit-fix branch.

## IAP product IDs

On `8078b978` / the 1.1.0 paywall, product IDs are **not hard-coded**. `plansFor()` loads the current RevenueCat offering and picks the `lifetime` and `monthly` packages (`offering.lifetime` / `offering.monthly`, or `PACKAGE_TYPE.LIFETIME` / `PACKAGE_TYPE.MONTHLY`). The price shown is `product.priceString` from the store (not a figure fixed in the app). A storefront rule hides the monthly plan in a set of lower-price countries (including IN).

Expected App Store product IDs, found in the same repo on `feat/v1.1-smart-tools` and in the ASC check report, and documented in comments on the submit-fix branch:

- `com.krosz.klenzer.lifetime` — one-time lifetime unlock (non-consumable). ASC USA price $14.99, state MISSING_METADATA.
- `com.krosz.klenzer.monthly` — auto-renewing monthly subscription. ASC USA price $3.99, state MISSING_METADATA.

**Match result:** those two IDs **match** the App Store Connect product IDs in `/home/box/shared/app-monitor/reports/klenzer-ios-asc-check-2026-11-12.md`. The 1.1.0 paywall does not embed the IDs; it will show whatever lifetime and monthly packages are attached to the current RevenueCat offering. Confirm the dashboard maps those two store IDs to the lifetime and monthly packages.

Entitlement ID in `src/lib/config.ts`: `klenzer_pro` (`RC_ENTITLEMENT`).

## What the 1.1.0 code collects or uses

### Photo library — on-device only

`expo-media-library` reads the library on-device to find duplicates, screenshots, Live Photos, and large videos, and to delete items the user confirms. `getAssetInfoAsync` is called with `shouldDownloadFromNetwork: false`. Photos and videos are not uploaded.

### Notifications — local, optional

`expo-notifications` schedules local reminders only if the user opts in. The push entitlement is stripped. No push token is collected.

### Purchases — RevenueCat (`react-native-purchases`)

`Purchases.configure({ apiKey })` only. No `appUserId` is passed, so RevenueCat issues an anonymous app user ID. The SDK is used to load offerings, purchase a package, restore purchases, and read entitlement `klenzer_pro`.

**Not called** (and not added on the submit-fix branch):

- `Purchases.collectDeviceIdentifiers()`
- `Purchases.enableAdServicesAttributionTokenCollection()`
- any utm / campaign / `$mediaSource` attribute setters

There is no `react-native-purchases-ui` on this 1.1.0 base; the paywall is the in-app screen `src/app/paywall.tsx`.

### Analytics and crash reporting

No separate analytics, attribution, or crash-reporting SDK. No Device ID collection and no advertising attribution.

### Other

Local AsyncStorage for onboarding, space/item totals, reminders, and pending Recently Deleted bytes. Network: RevenueCat and the store purchase flow; opening Settings, Photos, the hosted legal/support pages, or the OS review prompt. No account or login.

## App Privacy answers the 1.1.0 code supports

“Collected” means data that leaves the device so you or a third party can access it. Photo-library access that never leaves the device is not collected.

| Apple category | Collected? | Linked to the user? | Used for Tracking? | Purpose(s) |
|---|---|---|---|---|
| Contact Info | No | — | — | — |
| Health & Fitness | No | — | — | — |
| Financial Info (payment info) | No. Card details go to Apple/Google. Purchase records are under Purchases. | — | — | — |
| Location | No | — | — | — |
| Sensitive Info | No | — | — | — |
| Contacts | No | — | — | — |
| User Content — Photos or Videos | No (on-device only; not transmitted) | — | — | — |
| User Content — other | No | — | — | — |
| Browsing History | No | — | — | — |
| Search History | No | — | — | — |
| Identifiers — User ID | Yes (RevenueCat anonymous app user ID) | Yes | **No** | App Functionality (entitlements, restore) |
| Identifiers — Device ID | **No** | — | — | The 1.1.0 code does not call `collectDeviceIdentifiers`. |
| Purchases — Purchase History | Yes (RevenueCat and the store) | Yes | **No** | App Functionality |
| Usage Data — Product Interaction | No app-level event or paywall-impression tracking is coded on this base (the paywall is custom, not RevenueCat UI). [CHECK] only if RevenueCat still records standard SDK purchase events that Apple would treat as Product Interaction. If in doubt, you may also declare Product Interaction, linked, not tracking, App Functionality. | — | **No** | — |
| Usage Data — Advertising Data | **No** | — | — | AdServices and utm/campaign collection are not used. |
| Diagnostics | No crash or performance SDK found. | — | — | — |
| Other categories | No evidence in the app code | — | — | — |

**Tracking question (app-level): No.** There is no ATT prompt and no device-identifier or advertising-attribution collection.

## [CHECK] list

1. Confirm the RevenueCat dashboard maps the current offering’s lifetime and monthly packages to `com.krosz.klenzer.lifetime` and `com.krosz.klenzer.monthly`.
2. Optional: whether RevenueCat’s SDK reports additional purchase-lifecycle events that should be declared as Usage Data — Product Interaction. This does not change the Device ID or tracking answers.
3. In-app privacy copy and hosted policy were updated on 12 November 2026 to match this code. The effective date on the hosted Privacy and Terms pages is still the placeholder `[EFFECTIVE DATE – LAUNCH DAY]`.

---

## Addendum — 12 November 2026, 4:37 PM Asia/Dhaka (UTC+6)

RevenueCat has been removed from Klenzer (`klenzer/v2` `7d0ad3e`, legal pages `app-legal` `a457352`). Purchases now use StoreKit 2 / Play Billing via `expo-iap` only, with no third-party purchase SDK and no server.

**App Privacy / Data Safety answers that change:**

- Do **not** declare Identifiers — User ID (the previous RevenueCat anonymous app user ID).
- The app does not collect purchase history on its own servers or share it with a third party. Apple or Google process the payment under their policies. Do not list RevenueCat as a data recipient.
- Photos still stay on the device and are not collected.
- No Device ID and no advertising attribution (unchanged).

In-app privacy copy (`src/lib/privacy.ts`), `store/privacy-policy.html`, `store/listing.md`, `store/play-declarations.md`, and the live pages at https://samayhuf-star.github.io/app-legal/klenzer/privacy.html and terms.html were updated to match. This addendum does not change App Store Connect by itself; the questionnaire must be edited in ASC at submit time if it still lists the RevenueCat user ID.
