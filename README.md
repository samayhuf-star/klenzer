# Klenzer

Private, on-device photo clutter cleaner for iOS and Android. Klenzer finds duplicate and similar photos, screenshots, blurry shots, Live Photos, and large videos, then lets you review and delete only what you choose. Photos are never uploaded.

Scanning and reviewing are free. Deleting items and clearing Klenzer’s temporary files requires Klenzer Pro.

## Features

- Exact duplicates (same file size, dimensions, and capture time) and basic similar photos (dHash on small thumbnails)
- Screenshot, blurry-photo, Live Photo, and large-video review
- Incremental scans: an on-device SQLite cache keyed by asset id and modification date, so unchanged items are not remeasured
- Split progress for Photos, Screenshots, and Videos — results appear as each category finishes
- Confirm-before-delete (a single system dialog for the whole selection)
- Optional local reminder every 3 days (no push server)
- Klenzer Pro: a one-time lifetime unlock or an auto-renewing monthly subscription, restored from Settings

## Reminders

Reminders are local only: no server, no push token, and no remote push entitlement.

- After the first scan completes, Klenzer may ask for notification permission. It never asks on launch.
- If you turn them on, a notification is scheduled 3 days out with your current used and total storage, for example: “You've used 128.4 GB of 256 GB. Time to run Klenzer”.
- Every time the app opens or returns to the foreground, that reminder is cancelled and rescheduled with fresh numbers.
- Tapping the notification opens Klenzer and starts a scan.
- The Settings toggle is persisted. Turning it off cancels all scheduled reminders.

## Tech stack

- Expo (SDK 57) + Expo Router + TypeScript
- `expo-media-library` for on-device PhotoKit / Android media access
- `expo-sqlite` for the scan cache; `expo-image-manipulator` for thumbnail hashing
- `expo-notifications` for local reminders
- RevenueCat (`react-native-purchases`) for offerings, purchases, and restore

## Identifiers

- Expo project: `@krosz/klenzer` (`c6034b7f-62d6-487e-aff1-f013636ae0b5`)
- iOS bundle ID / Android package: `com.krosz.klenzer`
- App version on this branch: 1.1.0
- `supportsTablet`: false
- RevenueCat entitlement: `klenzer_pro`
- Expected store product IDs (loaded from RevenueCat offerings, not hard-coded in the paywall): `com.krosz.klenzer.lifetime`, `com.krosz.klenzer.monthly`

## Run locally

```bash
npm ci
npm run typecheck
npx expo start
```

Photo-library features and store purchases need a development or production build, not Expo Go (the scan cache and reminder plugins are native). RevenueCat public keys are supplied as `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` in EAS profiles.

## Privacy and support

- Privacy: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html
- Terms: https://samayhuf-star.github.io/app-legal/klenzer/terms.html
- Support: https://samayhuf-star.github.io/app-legal/klenzer/support.html
- Contact: samayhuf@gmail.com (no phone number)

The in-app Privacy Policy screen matches that policy: photos stay on the device, scan cache (sizes and tiny hashes) stays on the device, and purchase status is handled by Apple or Google and RevenueCat using an anonymous ID. The app does not collect device identifiers or advertising attribution.
