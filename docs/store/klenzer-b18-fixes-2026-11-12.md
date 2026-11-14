# Klenzer build 18 TestFlight fixes

Date: 12 November 2026 (times in Asia/Dhaka, UTC+6)
Branch: `klenzer/v2`
Base: `02c024c3e6daf77863a18447809e9de0a6763def` (TestFlight 1.1.0 build 18)
Fix commits (all on `klenzer/v2`, normal push, no force, no `main`):
- `7536574c417d20cad5405bf2de509e9dbf19171d` — scan hang, stale Space freed, Videos tab, cheap motion, Plan wording
- `bd4a2e4d5ac61403907b2fb9abd1fb62f6aaf170` — interim RevenueCat getProducts fallback (superseded; not in the shipping binary)
- `7d0ad3eca9680072390163e4a1b761387f375c9e` — remove RevenueCat; StoreKit 2 / Play Billing via expo-iap; three products; tagline “Phone Storage Cleaner”
Legal pages: `app-legal` main `a4573520cf0797a57dc5b0d81883bc4c701dc937`, live 200 at https://samayhuf-star.github.io/app-legal/klenzer/ (privacy, terms, support, home). No RevenueCat left on those pages.
No `eas submit`. No App Store Connect changes.

Screenshots reviewed: `/home/box/shared/app-monitor/reports/klenzer-b18-feedback/settings.jpg`, `home.jpg`.

## 1. Settings showed “Space freed 22.4 GB” on a fresh-looking install

**Root cause (not hard-coded, not a mockup leftover).** There is no `22.4` in source. Settings always rendered `formatBytes(lifetimeFreed)` (`src/app/settings.tsx:47` at `02c024c`). That number is loaded from AsyncStorage key `klenzer.freed.v1` on boot (`src/lib/store.tsx:72`, `:109–112`). A TestFlight update does not wipe that store, so a leftover total from builds 15/17 would still appear.

A second path could also inflate it: after an iOS delete, the media bytes were *not* added immediately. They were stored as `klenzer.pending.v1` and later credited by `settlePending` when `disk.free - baselineFree >= pending.bytes * 0.5` (`src/lib/store.tsx:177–184`, `:203–204`, `:380–383`). iOS “available” space routinely swings by gigabytes, so a stale or leftover pending row could credit a large total the user never actually freed in this install. The done screen’s “freed so far” line used the same `lifetimeFreed` (`src/app/done.tsx:53`) and would have shown it once the total was > 0.

**Fix.** Storage keys bumped to `klenzer.freed.v2` and `klenzer.items.v2` with no migration, so existing TestFlight installs start the counter at 0. `settlePending` and the pending key are removed. `lifetimeFreed` is incremented only after a successful `deleteItems` / temp clear (`src/lib/store.tsx` `addFreed` on the actual deleted bytes). Settings still shows the row, with `0 MB` until something has been freed (`src/app/settings.tsx:47`). The done line still uses the same source and stays hidden at 0.

**Confidence:** high for the stored-key leftover (matches 22.4 GB being a real formatted total, not a placeholder). Medium-high that disk-swing credit also contributed on some installs.

## 2. Home hung at (0) / 0 MB with spinners and lime placeholder thumbs

**Root cause.** The scan *did* start: Home showed “Measuring and matching photos…”, which is the post-enumerate `analyzing` copy (`src/app/index.tsx:91` at `02c024c`). Settings on the same device showed Full access, so this was not a missing permission prompt on that phone. Permission banners for denied / limited were already present and were kept.

Home spinners stay up while `scanning === true` and the category status is not `done` (`src/app/index.tsx:62–64`). After enumerate, the first enrich pass is screenshots. `enrich` waited on SQLite `openDatabaseAsync` (`src/lib/scan-cache.ts:16`) and `getAssetInfoAsync` (`src/lib/scanner.ts:84`, `:110`) with no timeout; photo hashing waited on `analyzeThumb` (`src/lib/scanner.ts:123`) with no timeout. If any of those promises never settled, `onPartial` after screenshots never ran, no category reached `done`, `scan()` in the store had no `catch` (`src/lib/store.tsx:261–275`) and never hit `finally`, and every card stayed at 0 with a spinner. Empty thumb arrays fell back to the mockup gradients, including lime `#D4FC79` (`src/app/index.tsx:255`).

`ph://` URIs were already avoided for manipulator work when `localUri` was present; the hang is the missing timeouts, not that path by itself.

**Fix.**
- Timeouts: 8s on `getAssetInfoAsync` and `analyzeThumb`, 20s per library page, 4s on SQLite open (cache is disabled if init fails), 3s on cache reads/writes (`src/lib/scanner.ts`, `src/lib/scan-cache.ts`, `withTimeout` in `src/lib/scan-logic.ts`). A timed-out asset continues with size 0 rather than stalling the pool.
- `scanLibrary` has try/catch and `onError`; categories are marked `done` on failure or timeout so spinners stop.
- Store `scan()` sets `scanError`, always marks categories done in `finally`, and Home shows an error banner with Try again (`src/app/index.tsx:119–122`). Denied / limited CTAs are unchanged.
- Thumbnail stacks use only real asset URIs. The colored placeholders are gone.

**Confidence:** high that a hung `getAssetInfoAsync` / SQLite init / `analyzeThumb` is what kept all four cards at 0 after enumerate. The native hang itself was not reproduced in this environment (no device library); the unit/stress tests cover grouping, stage streaming, spinner-stop rules, and the timeout helper.

## 3. Settings “Klenzer: Free scan”

**Root cause.** Leftover wording at `src/app/settings.tsx:48` (`label="Klenzer"`, `value={isPro ? 'Unlocked' : 'Free scan'}`). Not a paywall or entitlement bug.

**Fix.** The row is now `Plan: Free` with an `Upgrade` chevron to the existing paywall, or `Plan: Pro` when entitled. No RevenueCat or paywall code changes.

**Confidence:** high.

## Videos tab (same build)

Top segmented control is now Photos | Contacts (Contacts still Coming soon). Videos was removed from that control. The bottom tab bar is Clean, Videos, Compress, Settings.

The Videos tab shows Large videos and Duplicate videos in the same card style, with the same streaming progress, counts, sizes, and real thumbnails. It reads the existing `result` / `scanCats.videos` — there is no second scan. Duplicate videos are exact groups (size + dimensions + duration + creation second) on the measured video list (`duplicateVideos` in `ScanResult`, review kind `videoDuplicates`).

Compress stays Coming soon, now as its own tab.

## Animations in this build vs deferred

Cheap, already-available Reanimated / Haptics only. No Lottie and no new native dependency. `useReducedMotion` is honored (sweep omitted, count-up jumps to the value, card fade and done checkmark spring skipped).

**In this build**
- Scan-progress sweep on the analyzing bar
- Cards fading in as they mount / results stream
- Count-up on category sizes, the done “cleared” total, and “freed so far”
- Haptics when a scan category finishes, when a scan completes, and on the existing success checkmark
- Existing done checkmark spring, now also gated on Reduce Motion

**Deferred to the next build**
- New animated splash / launch
- Radar-style scan visualization
- A more elaborate clean / “space freed” celebration beyond the checkmark + count-up
- Extra screen-transition work beyond the card fade-in

## Tests, typecheck, lint

- `npx tsc --noEmit`: pass
- `npx expo lint`: pass
- `npx tsx --test scripts/scan-logic.test.ts`: 9/9 pass, including:
  - exact photo/video grouping and similar dHash groups
  - `buildScanResult` screenshots, large video, duplicate videos
  - `withTimeout` fallback on a hanging promise
  - staged scan: screenshot counts appear and that spinner stops, then video cards fill, then all spinners stop
  - stress: 3,150 photos + 112 videos (400 exact photo pairs, 150 similar pairs, 80 screenshots, 12 large videos, 30 video-dup pairs) grouped in 7 ms

Grouping lives in `src/lib/scan-logic.ts` (no Expo imports) so the tests run in Node with a seeded library.

## Still Coming soon

Contacts merge and Compress. Everything else on Clean / Videos (Similar, Duplicate, Blurry, Screenshots, Large videos, Duplicate videos) is wired to the real scan. Paywall and RevenueCat were not changed.

## 4. Paywall: “Couldn’t load prices” and “Free 852 MB now”

Screenshot: `/home/box/shared/app-monitor/reports/klenzer-b18-feedback/paywall.jpg`. ASC / RevenueCat audit: `/home/box/shared/app-monitor/reports/klenzer-paywall-audit-2026-11-12.md`.

### Product IDs vs App Store Connect

The audit confirmed ASC already had `com.krosz.klenzer.lifetime` (NON_CONSUMABLE, 6829830806, READY_TO_SUBMIT) and `com.krosz.klenzer.monthly` (AUTO_RENEWABLE / ONE_MONTH, 6833133616, READY_TO_SUBMIT) in group “Klenzer Pro”. Samay later added a yearly plan: `com.krosz.klenzer.yearly`, auto-renew in the same group. App Launch Bot is creating that yearly product in ASC, so it may be missing on the first TestFlight run.

### Why prices failed on build 18 (dashboard, confirmed — not a configure race)

Build 18’s store/scan wiring did **not** remove the `ready` gate. Configure ran in boot before `setReady(true)`, and the stack (including the paywall) only mounts when `ready` is true.

The audit probed the RevenueCat public iOS key against offerings and health: current offering `default` had **`packages: []`**, health `products` failed with `products: []`, and `product_entitlement_mapping` was `{}`. Bundle ID and API key checks passed. **That was a RevenueCat dashboard gap, not an ASC product-ID typo.**

### What shipped instead (Samay, 4:31 PM Asia/Dhaka: “remove revenuecat and use normal apple pricing”)

RevenueCat is gone from this binary: `react-native-purchases` uninstalled, the `appl_` key removed from `eas.json`, offerings / `klenzer_pro` entitlement / second-chance offering code removed, `expo-iap` (6.4.3) plus its config plugin added. Purchases use StoreKit 2 on iOS (and Play Billing on Android) with no server and no IAPKit key.

The paywall loads three product IDs and shows each store `displayPrice` (never hard-coded):

- `com.krosz.klenzer.yearly` — auto-renew, default-selected, badged Best value when it loads
- `com.krosz.klenzer.monthly` — auto-renew, same “Klenzer Pro” group
- `com.krosz.klenzer.lifetime` — non-consumable

If some IDs are missing, the paywall shows the ones that load and default-selects yearly if present, otherwise the first loaded plan. Neutral copy **“Plans unavailable right now, try again later”** only if none load. Purchase goes through `requestPurchase`, on-device StoreKit 2 verification (`isTransactionVerifiedIOS` / current entitlements), then `finishTransaction`. Pending, cancelled, and failed purchases are handled. Restore uses `syncIOS` (AppStore.sync) / `restorePurchases`. Pro is a verified lifetime purchase **or** an active yearly **or** an active monthly, checked on launch and on transaction updates. Settings has Restore purchases and Manage subscription (system UI).

### “Free 852 MB now” while Home showed 0 MB

**Not hard-coded.** There is no `852` in source. The hero was “Free {bytes} now” when reclaimable bytes were greater than zero (`src/app/paywall.tsx:82` at `02c024c`), with `reclaim = reclaimableBytes(result, tempSize)` (`:26–27`). After the hung scan enumerated the library, `result` was non-null but every category was still empty, so the only non-zero term was `tempSize` (`Paths.cache` in `src/lib/temp.ts:16–18`) — leftover app cache, not shown on the v2 Home cards.

**Fix (still in this build):** the headline and unlock CTA use `scanReclaimableBytes(result)` only. If that is 0, the hero is “Unlock Klenzer”.

### What would still need RevenueCat (none required for this app)

A third-party purchase SDK would only be useful here for a hosted offerings dashboard, experiments, a customer-center UI, webhook-based refund revocation on a server, or an account-linked entitlement that exists outside Apple/Google. Klenzer has no server and no account. StoreKit current entitlements on launch cover refunds and expiry. Native “Manage subscription” replaces the old RevenueCat customer center.

**Confidence:** high that empty RC offerings caused “Couldn’t load prices”; high that 852 MB was temp cache; high that yearly may be absent on the first TestFlight pass until ASC finishes creating it.

## 5. Tagline: “Phone Storage Cleaner”

`rg` (case-insensitive) for “Clean Photo Clutter” was run across the klenzer and app-legal repos. Hits were in `store/listing.md` and the four app-legal Klenzer pages. There was no occurrence on the in-app splash, onboarding, paywall, or Settings — those already said “Klenzer” or a different line (“Clear the clutter. Keep the moments.”). `expo.name` / prebuild `CFBundleDisplayName` stay **Klenzer**.

Replaced in listing, legal pages, and the Play feature-graphic generator script. **App Store name limit:** “Klenzer - Phone Storage Cleaner” is **31/30** characters. Flagged in `store/listing.md`; at submit time use a 30-character form such as “Klenzer Storage Cleaner” (23) if App Store Connect rejects the 31-character name. Play title “Klenzer: Phone Storage Cleaner” is exactly 30/30. The existing generated Play feature graphic PNG was not regenerated in this build (script source is updated).

## Tests, typecheck, lint, prebuild (this commit)

- `npx tsc --noEmit`: pass
- `npx expo lint`: pass
- `npx tsx --test scripts/scan-logic.test.ts`: 11/11 pass (previous 9 scan/stress tests plus catalog order and default-plan selection)
- Temp iOS prebuild: `npx expo prebuild --platform ios --clean --no-install` succeeded. `CFBundleDisplayName` is Klenzer. Entitlements file is empty (no `aps-environment`). `withoutPushEntitlement` remains listed before `expo-notifications`. Generated `ios/` was not committed.

## What to hand App Launch Bot

The one complete fix build (scan hang + Videos tab + cheap motion + StoreKit paywall + tagline) is **1.1.0 (21)**, commit `7d0ad3e`, build ID `f73d44a9-db37-47cb-bc08-dd497703fa2e`. Logs: https://expo.dev/accounts/krosz/projects/klenzer/builds/f73d44a9-db37-47cb-bc08-dd497703fa2e

Ignore cancelled builds **19** (`b5bb2a88-4ecd-4d83-becb-58dedcbc2ea2`) and **20** (`a6fb69fa-f4ef-4bbc-a02b-ef8b68af9662`) — they were stopped so this work could land in a single binary. Do not submit until QA. Yearly may not appear until the ASC product exists; monthly and lifetime should still show. After Samay tests, App Privacy answers must drop the RevenueCat user ID (see the addendum in `klenzer-legal-and-app-privacy-2026-11-12.md`).

## EAS status

- Cancelled: `b5bb2a88-…` — 1.1.0 (19), commit `7536574` (scan fixes only).
- Cancelled: `a6fb69fa-…` — 1.1.0 (20), commit `bd4a2e4` (RC fallback; superseded).
- Finished: `f73d44a9-db37-47cb-bc08-dd497703fa2e` — **1.1.0 (21)**, commit `7d0ad3e`. Started 12 November 2026, 4:37 PM Asia/Dhaka; finished 4:44 PM Asia/Dhaka. IPA: https://expo.dev/artifacts/eas/WxAuybtFV3i2tphb61hMNjEp4ccs4-KOXTXA1bkzkaA.ipa


## 6. Build 21 QA failures — launch prompt, hung matching stage, home grid, storage headline (build 22)

Screenshots: `/home/box/shared/app-monitor/reports/klenzer-b18-feedback/b21-apple-signin-on-launch.jpg`, `b21-home-scan.jpg`.

Fix commit (normal push to `klenzer/v2`, no force, no `main`, no submit, no ASC): `bdfbba2217188a7f6748b0d246510e1a043b72a3` — Samay Vashsht <samayhuf@gmail.com>. Shipping binary is **1.1.0 (22)**.

### 6.1 Launch: “Sign in to Apple Account” over the splash, then a long hang

**Root cause (file:line, at `7d0ad3e`).** `initIAP` called `syncIOS()` at `src/lib/purchases.ts:151`. That is AppStore.sync and is what presents Apple’s password prompt. `refreshEntitlements` also called `getAvailablePurchases` (`src/lib/purchases.ts:200`), which can trigger a store refresh. Store boot awaited both before `setReady(true)` (`src/lib/store.tsx:115–126`). `_layout.tsx` kept the native splash (and the delayed `AnimatedSplash`) up until `loaded && ready`, so the prompt appeared over the splash and the UI stayed there until the user signed in and IAP finished.

**Fix.** Startup entitlement checks use only non-prompting APIs: `currentEntitlementIOS`, `hasActiveSubscriptions` / `getActiveSubscriptions`, and the purchase-update listener. `syncIOS`, restore, and `getAvailablePurchases` run only from Restore Purchases. `setReady(true)` happens as soon as local prefs are loaded; `initIAP` and entitlement refresh run in the background with a 4s timeout and do not hold first render. Fonts no longer gate the stack. The animated splash was left **out** of this build — it added a 1.5s + 450ms delay after ready.

### 6.2 Matching stage never streamed (Similar / Duplicates / Blurry stuck at 0)

**Where it blocked (file:line, at `7d0ad3e`).** After screenshots and videos had already emitted, `src/lib/scanner.ts:272–282` ran `mapPool` over **all** still photos with hash+blur, then called `buildScanResult` and `onPartial` only once at `:294–308`. Home therefore kept Similar, Duplicates, and Blurry at (0) / 0 MB with spinners, the bar barely moved, and the status stayed on “Measuring and matching photos…”.

**Fix.** Scan orchestration now lives in `src/lib/scan-pipeline.ts` (same path the app uses). Exact duplicates are grouped on size + dimensions + creation second, or the same filename, and emitted immediately after enumerate (newest first), then again after every size batch. Similar hashing is limited to burst neighbours (~60s) and prefix-bucket comparisons (no all-pairs). Blurry runs in a low-priority, capped parallel pass and streams its count too. Progress text is “Matched X of Y” and is forced at least every 2s. SQLite hash cache and ~32px thumbs were already in place and kept.

### 6.3 Home layout (supersedes the Videos bottom tab)

One scrollable Clean grid: Similar, Duplicates, Blurry, Screenshots, Videos (duplicate videos), plus Large videos and Live Photos when present. The Photos | Contacts switch and the Videos tab are gone. Bottom bar is Clean, Compress, Settings. Contacts is a Coming soon card at the end of the grid. Each category has a distinct icon (images, copy, eye-off, phone-portrait, videocam, film, aperture, people); once real thumbnails load, a small icon badge sits on the stack. Cards still fade in as results stream.

### 6.4 Storage card: free space and marketed capacity

Headline is now reported free space against a marketed total, e.g. “73 GB free of 256 GB”, not used-of-raw-total (“187.0 GB of 255.4 GB”). The marketed total is the smallest of 32 / 64 / 128 / 256 / 512 / 1024 / 2048 GB at or above the reported total (255.4 → 256 GB; 1024 / 2048 display as 1 TB / 2 TB). Free is the reported free bytes, not rounded-total minus used. The bar still shows used vs free against the reported total.

### 6.5 App Store name

`store/listing.md` Name is **Klenzer: Phone Storage Cleaner** (colon), exactly 30/30. The 31-character flag was removed. `CFBundleDisplayName` / `expo.name` stay **Klenzer**.

### 6.6 “While scanning” percentage animation — deferred

Samay (5:09 PM Asia/Dhaka) asked for an animated scanning visual with a live % complete during the scan (sweep or radar ring, large %, monotonic per-stage progress, Reduce Motion = static ring + %). This was **not** included in build 22. The production build had already been uploaded and was in progress (`e6dc0bd4-…` started 5:09 PM Asia/Dhaka) when that answer arrived; landing it would have meant cancelling and starting a second EAS build, which would have delayed the launch-prompt and streaming fixes. This binary already has the existing scan sweep, a thin progress bar, and “Matched X of Y” labels, and cards still fill in as results stream. A large monotonic % and radar ring can go in the next build; with Reduce Motion it should be a static ring plus the %.

### Tests (this commit)

- `npx tsc --noEmit`: pass
- `npx expo lint`: pass
- `npx tsx --test scripts/scan-logic.test.ts scripts/iap-startup.test.ts scripts/scan-pipeline.test.ts`: **20/20 pass**, including:
  - no `syncIOS` / restore / `getAvailablePurchases` at startup; those run only from `restore()`
  - layout does not keep a splash up for IAP, fonts, or an animated delay
  - marketed-capacity rounding (255.4 → 256 GB, 1024/2048 → 1 TB/2 TB) and free = reported free, not rounded-total minus used
  - real `scanLibraryWithIO` path with ~30,000 mocked assets and 1 ms per size lookup: first Duplicate arrived within 10s; analyzing progress (including “Matched X of Y”) updated at least every 2s

### What to hand App Launch Bot

The QA follow-up binary is **1.1.0 (22)**, commit `bdfbba2217188a7f6748b0d246510e1a043b72a3`, build ID `e6dc0bd4-0422-4ca8-8070-d7dd88ec1848`. Logs: https://expo.dev/accounts/krosz/projects/klenzer/builds/e6dc0bd4-0422-4ca8-8070-d7dd88ec1848

Do not submit until QA. Animated splash is not in this binary. The while-scanning large-% / radar animation is not in this binary (deferred, see 6.6).

### EAS status (updated)

- Cancelled: `b5bb2a88-…` — 1.1.0 (19), commit `7536574` (scan fixes only).
- Cancelled: `a6fb69fa-…` — 1.1.0 (20), commit `bd4a2e4` (RC fallback; superseded).
- Finished: `f73d44a9-db37-47cb-bc08-dd497703fa2e` — 1.1.0 (21), commit `7d0ad3e`. Started 12 November 2026, 4:37 PM Asia/Dhaka; finished 4:44 PM Asia/Dhaka. This is the QA-failing binary.
- Finished: `e6dc0bd4-0422-4ca8-8070-d7dd88ec1848` — **1.1.0 (22)**, commit `bdfbba2`. Started 12 November 2026, 5:09 PM Asia/Dhaka; finished 5:16 PM Asia/Dhaka. IPA: https://expo.dev/artifacts/eas/1bxhsGDLpZDp85UeSPbRfaUdTentD4Gq0wj1TguPEtg.ipa


## 7. Next build (prepared, not built)

Prepared on `klenzer/v2` from `bdfbba2`, 12 November 2026, 5:20–5:24 PM Asia/Dhaka. Commit `daafe8cc29965b82a58eeff7367d1feba6a377fd` (Samay Vashsht <samayhuf@gmail.com>), pushed normally. **No EAS build was run.** Waiting for Samay’s device result on 1.1.0 (22).

### 7.1 Purchase listener must not prompt

QA flagged `getAvailablePurchases` in `verifyOnDevice` (`src/lib/purchases.ts:87` at `bdfbba2`). A `purchaseUpdatedListener` firing when the connection opens would go through `verifyAndFinish` → `verifyOnDevice` and could show the Apple ID prompt again.

**Fix.** `verifyOnDevice` now uses only `isTransactionVerifiedIOS`, `currentEntitlementIOS`, and the transaction payload (`purchase.purchaseState`). `getAvailablePurchases` and `getPendingTransactionsIOS` were removed from that path. `getAvailablePurchases` and `syncIOS` remain only in `restore()`, after the user taps Restore Purchases.

### 7.2 Live % scanning animation

Home now shows a radar ring with the % in large type, plus the existing “Matched X of Y” label. Cards still fill in as results stream. The percent is a weighted total across reading (12), sizing (55), hashing (18), and blur (15), floored so it never goes backward when a later stage starts at 0, and a reached stage with no work is marked complete so it cannot stall (for example at 60% / 67% after sizing). Mid-batch ticks keep it moving during long pools. With Reduce Motion on, the ring is static and the % still updates.

### 7.3 Animated splash — left out

The existing `AnimatedSplash` is an opaque overlay that waits 1.5s + 450ms after ready and intercepts touches, so it would delay reaching a usable home. A version of that intro cannot be guaranteed to add zero delay. Native splash now hides when the root shell mounts (and again when `ready` is set). Home / onboarding still mounts as soon as local prefs are loaded; no branded intro runs over them.

### Tests (this commit)

- `npx tsc --noEmit`: pass
- `npx expo lint`: pass
- `npx tsx --test scripts/scan-logic.test.ts scripts/iap-startup.test.ts scripts/scan-pipeline.test.ts`: **24/24 pass**, including the new listener-path assertion (no `getAvailablePurchases` / sync / restore in `verifyOnDevice`, `verifyAndFinish`, or `attachListeners`) and weighted-percent tests (monotonic across stages, empty stages do not stall, unknown 0/0 does not count as complete). The 30k `scanLibraryWithIO` run still gets a first Duplicate within 10s, progress at least every 2s, and a monotonic percent that finishes at 100.


## 8. Build 23 — exact dups and blurry stream earlier; progress copy; foreground resume

Samay’s device result on **1.1.0 (22)**: the launch prompt was gone, storage showed “68 GB free of 256 GB”, results streamed, and progress said “Matched 5,500 of 29,570”, but Duplicates and Blurry were still 0 at that point. He said GO at 5:33 PM Asia/Dhaka for one EAS iOS production build on top of `daafe8c`.

Commit (normal push to `klenzer/v2`, no force, no submit, no ASC): `a53ca894264b43071d6fd3b09458b05e6e1906a0` — Samay Vashsht <samayhuf@gmail.com>. Shipping binary is **1.1.0 (23)**.

### 8.1 What was wrong with Duplicates and Blurry on 22

The cheap metadata emit after enumerate did not confirm file size, and `groupExact` could not show real exact dups until sizes were known. Worse, the sizing queue ran **all screenshots, then all videos, then stills**, so at “Matched 5,500 of 29,570” the still-photo pass often had not started. Blurry waited until **every** asset was sized and similar hashing had finished, so it also stayed at 0 during that mid-scan window.

### 8.2 What changed

- Exact-dup **candidates** are pre-grouped with a cheap key (dimensions + capture second, or filename + dimensions). File size is fetched **only for those candidates**, newest first, and groups are emitted after each batch once two or more items share a confirmed size. The remaining library is sized after that, still newest-first for leftover stills, so a same-size pair in recent photos does not wait behind thousands of screenshots or videos.
- Blurry starts **immediately**, in parallel, at low priority (2 workers) on the newest photos, and streams its count after every batch. It no longer waits for the full sizing or hashing pass.
- A test on the real `scanLibraryWithIO` path with ~30,000 mocked assets asserts that the first exact Duplicate and the first Blurry each emit before sizing or hashing of the whole library completes (and the first Duplicate still arrives within 10s).

### 8.3 Progress copy

The radar % ring stays. Under it, “Matched X of Y” is replaced with Samay’s exact copy:

1. `Looking through {N} photos · {P}%` (N uses thousands separators, e.g. “Looking through 29,570 photos · 19%”)
2. `Start cleaning anytime while we finish up.`

Cards still stream. Reduce Motion is still a static ring plus the %.

### 8.4 No ellipses

Every user-facing ellipsis (`…` or `...`) was removed from app strings (progress labels, “Cleaning your device”, “Waiting for your confirmation”). `scripts/no-ellipsis.test.ts` walks string literals under `src/` and fails if one comes back.

### 8.5 Resume on foreground

If a scan is still marked incomplete when the app returns to the foreground (`AppState` active) and no scan is currently running, it resumes `scanLibrary` using the existing SQLite cache and does not wipe already-streamed results or reset the monotonic percent floor. If a scan is still in memory after a suspend, it is left alone to continue. There is no promise of background completion and no new notification.

### 8.6 Kept from `daafe8c`

`verifyOnDevice` still has no `getAvailablePurchases`. The live radar % remains. The animated splash is still out.

### Tests (this commit)

- `npx tsc --noEmit`: pass
- `npx expo lint`: pass
- `npx tsx --test scripts/scan-logic.test.ts scripts/iap-startup.test.ts scripts/scan-pipeline.test.ts scripts/no-ellipsis.test.ts`: **27/27 pass**, including cheap-key candidates that do not emit until sizes are confirmed, the looking-through copy, no-ellipsis, listener-path no-prompt coverage, and the 30k streaming path (first Duplicate within 10s, first Duplicate and first Blurry before the whole library is sized or hashed, progress at least every 2s, monotonic percent ending at 100).

### EAS

- Finished: `29462ef4-0906-4828-a6ce-fe100ef9c99f` — **1.1.0 (23)**, commit `a53ca894264b43071d6fd3b09458b05e6e1906a0`. Started 12 November 2026, 5:40 PM Asia/Dhaka; finished 5:46 PM Asia/Dhaka. Logs: https://expo.dev/accounts/krosz/projects/klenzer/builds/29462ef4-0906-4828-a6ce-fe100ef9c99f
- IPA: https://expo.dev/artifacts/eas/Q2Q5qcAIqY0YWmgjHCl9EKfTHbHKjCofjCgSMhQJwxc.ipa

Do not submit until QA.

