# Klenzer

Private, on-device photo clutter cleaner for iOS and Android. Klenzer finds duplicate and similar photos, screenshots, blurry shots, Live Photos, and large videos, then lets you review and delete only what you choose. Photos are never uploaded.

Scanning and reviewing are free. Deleting items and clearing Klenzer’s temporary files requires Klenzer Pro.

## Features

- Exact duplicates (same file size, dimensions, and capture time) and basic similar photos (dHash on small thumbnails)
- Screenshot, blurry-photo, Live Photo, and large-video review
- Incremental scans: an on-device SQLite cache keyed by asset id and modification date, so unchanged items are not remeasured
- Split progress for Photos, Screenshots, and Videos — results appear as each category finishes
- The Videos tab shares that same scan: large videos and duplicate videos fill in when the video pass finishes
- Scan steps time out if a file hangs, so Home spinners always stop; an error banner lets you retry
- Space freed only counts items this install actually deleted in Klenzer, and starts at 0
- Confirm-before-delete (a single system dialog for the whole selection)
- Optional local reminder every 3 days (no push server)
- Klenzer Pro: a one-time lifetime unlock or an auto-renewing monthly subscription, restored from Settings

## Reminders

Reminders are local only: no server, no push token, and no remote push entitlement.

- When the first scan starts, Klenzer may ask for notification permission. It never asks on launch.
- When that scan finishes, a local notification with the default sound reports the real reclaimable size, for example: “Scan complete: 2.4 GB can be freed”. If nothing can be freed it says “Scan complete: your library looks clean”. The banner also appears if the app is in the foreground. If permission is denied, nothing is shown and the scan is unaffected.
- If you turn them on, a notification is scheduled 3 days out with your current used and total storage, for example: “You've used 128.4 GB of 256 GB. Time to run Klenzer”.
- Every time the app opens or returns to the foreground, that reminder is cancelled and rescheduled with fresh numbers.
- Tapping the notification opens Klenzer and starts a scan.
- The Settings toggle is persisted. Turning it off cancels all scheduled reminders.

## Tech stack

- Expo (SDK 57) + Expo Router + TypeScript
- `expo-media-library` for on-device PhotoKit / Android media access
- `expo-sqlite` for the scan cache; `expo-image-manipulator` for thumbnail hashing
- `expo-notifications` for local reminders and the scan-complete notification (no push server)
- StoreKit 2 / Play Billing via `expo-iap` for products, purchases, restore, and entitlements (no RevenueCat)

## Identifiers

- Expo project: `@krosz/klenzer` (`c6034b7f-62d6-487e-aff1-f013636ae0b5`)
- iOS bundle ID / Android package: `com.krosz.klenzer`
- App version on this branch: 1.1.0
- `supportsTablet`: false
- Store product IDs (loaded by ID from Apple or Google; prices come from the store’s localized displayPrice, never hard-coded): `com.krosz.klenzer.yearly` (auto-renew, default-selected, Best value), `com.krosz.klenzer.monthly` (auto-renew), `com.krosz.klenzer.lifetime` (non-consumable). Yearly and monthly are in the “Klenzer Pro” subscription group. If a product is missing from the store, the paywall shows the ones that load. Yearly and monthly each show a 7-day free trial when the store reports an eligible introductory offer (“7 days free, then <store price>/month” or “/year”, “cancel anytime”). Lifetime has no trial.
- Pro is a verified lifetime purchase or an active yearly or monthly subscription, checked from StoreKit / Play entitlements on launch and when transactions update.

## Run locally

```bash
npm ci
npm run typecheck
npx expo start
```

Photo-library features and store purchases need a development or production build, not Expo Go (the scan cache, reminder, and IAP plugins are native).

## Privacy and support

- Privacy: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html
- Terms: https://samayhuf-star.github.io/app-legal/klenzer/terms.html
- Support: https://samayhuf-star.github.io/app-legal/klenzer/support.html
- Contact: samayhuf@gmail.com (no phone number)

The in-app Privacy Policy screen matches that policy: photos stay on the device, scan cache (sizes and tiny hashes) stays on the device, and purchase status is handled by Apple or Google on the device. The app does not collect device identifiers, an account ID, or advertising attribution.
