# Klenzer v2 — build 18 (look approved)

**Time:** 12 November 2026, 4:05:54 PM Asia/Dhaka (UTC+6)  
**Branch:** `klenzer/v2` (from `klenzer/ios-submit-fixes` @ `52b0724`)  
**Commit:** `02c024c3e6daf77863a18447809e9de0a6763def` — normal push to origin, not main, no force. Paywall and RevenueCat (including the production `appl_…` iOS public key in `eas.json`) were not changed.

## EAS iOS production build

- **Status:** FINISHED
- **ID:** `91f56420-0f76-44ba-a40b-2b462e7d3e57`
- **Version / number:** 1.1.0 (18). Remote `appVersionSource` + production `autoIncrement` incremented **17 → 18** at submit time.
- **Account / profile:** krosz, production, STORE distribution.
- **Git on the build:** `02c024c3e6daf77863a18447809e9de0a6763def`
- **Started:** 12 November 2026, 3:59:14 PM Asia/Dhaka  
- **Finished:** 12 November 2026, 4:05:54 PM Asia/Dhaka
- **Page:** https://expo.dev/accounts/krosz/projects/klenzer/builds/91f56420-0f76-44ba-a40b-2b462e7d3e57
- **Artifact (.ipa):** https://expo.dev/artifacts/eas/zlZ48UgA57Fgugl4s7hzj00H8xZlUsQrn6aHFpJJ6m0.ipa

No retry was needed. **Not submitted** (no `eas submit`, no App Store Connect changes). App Launch Bot uploads to TestFlight. Build 17 stays unsubmitted.

## Checks

- `npx tsc --noEmit` — passed
- `npx expo lint` — passed (ESLint was added with `eslint-config-expo` so the existing `lint` script actually runs)
- Temp `expo prebuild --platform ios --no-install` — passed; `ios/` was not committed
- Push entitlement: `expo-notifications` would add `aps-environment`; `plugins/withoutPushEntitlement` is listed **before** that plugin so its entitlements mod runs after and strips the key. Re-prebuild confirmed `Klenzer.entitlements` has no `aps-environment`. `enableBackgroundRemoteNotifications` is false (no `remote-notification` background mode).
- `expo-doctor` — 20/21 checks passed. The one failure is pre-existing patch-version drift on core Expo 57 packages (e.g. `expo` 57.0.27 vs latest 57.0.32). Those were left unchanged so this build stays on the same SDK line as builds 15–17. New deps (`expo-sqlite`, `expo-image-manipulator`, `expo-notifications`) were installed with `npx expo install`.

## What’s real vs Coming soon

| Surface | Status |
| --- | --- |
| Similar (dHash on small thumbnails) | **Real** |
| Duplicate (exact size + dimensions + capture time) | **Real** |
| Blurry (Laplacian variance on 32×32 thumbnails) | **Real** |
| Screenshots | **Real** |
| Large videos | **Real** |
| Split scan progress (Photos / Screenshots / Videos) and incremental SQLite cache | **Real** |
| Smart Clean (scan, or clean default duplicate + similar extras via the existing paywall gate) | **Real** |
| 3-day local storage reminders, Settings toggle, tap-to-scan | **Real** |
| Single batched `deleteAssetsAsync(ids[])` and no “go empty Recently Deleted” copy | **Real** |
| Contacts | **Coming soon** |
| Compress (home card and tab) | **Coming soon** |

## How to test (TestFlight, build 18)

1. Install the build, grant photo access (full library if possible; limited access will only scan what was selected).
2. Confirm Home matches the approved mockups: lavender background, storage card (used of total), Smart Clean, Photos/Videos/Contacts segment, 2×2 category cards, Compress “Coming soon”, gold PRO pill (opens the existing paywall), bottom tab bar.
3. Run a scan. Photos, Screenshots, and Videos should get their own progress; results should appear as each track finishes. A second scan should be faster (cache keyed by asset id + `modificationTime`).
4. Open Duplicate / Similar (grouped, BEST kept, extras preselected), Blurry, Screenshots, and Large videos. Delete should show **one** system confirmation. There should be no “Open Recently Deleted / empty it yourself” copy.
5. After the first scan, accept or decline reminders. If on, leave the app; a local notification is scheduled in 3 days with current used/total storage. The Settings toggle cancels all scheduled reminders. Tapping a reminder should open the app and start a scan.
6. Risks: limited photo access (banner still shown); iCloud-only originals are not measured or hashed (`shouldDownloadFromNetwork: false`); first scan of a very large library will still take time while the cache fills; memory is bounded by small thumbnails and a 4-worker pool.

Approved look mockups (unchanged): `/home/box/shared/app-monitor/reports/klenzer-v2-mockups/home.png`, `review-duplicates.png`, `done.png`.
