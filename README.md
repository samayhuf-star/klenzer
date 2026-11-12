# Klenzer

Private, on-device photo clutter cleaner for iOS and Android. Klenzer finds duplicate or near-identical photos, screenshots, Live Photos, and large videos, then lets you review and delete only what you choose. Photos are never uploaded.

This branch is the 1.1.0 paywall build (git `8078b978` plus submit fixes). Scanning and reviewing are free. Deleting items and clearing Klenzer’s temporary files requires Klenzer Pro.

## Features

- Duplicate and near-identical photo sets (keeps the largest file by default)
- Screenshot, Live Photo, and large-video review
- Temporary-file cleanup for Klenzer’s own cache
- Real device free/total storage figures
- Confirm-before-delete (system dialog); on iOS, items go to Recently Deleted
- Optional local reminder notifications (no push server)
- Klenzer Pro: a one-time lifetime unlock or an auto-renewing monthly subscription, restored from Settings

## Tech stack

- Expo (SDK 57) + Expo Router + TypeScript
- `expo-media-library` for on-device PhotoKit / Android media access
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

Photo-library features and store purchases need a real device (or a development/simulator build), not just Expo Go. RevenueCat public keys are supplied as `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` in EAS profiles.

## Privacy and support

- Privacy: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html
- Terms: https://samayhuf-star.github.io/app-legal/klenzer/terms.html
- Support: https://samayhuf-star.github.io/app-legal/klenzer/support.html
- Contact: samayhuf@gmail.com (no phone number)

The in-app Privacy Policy screen matches that policy: photos stay on the device, and purchase status is handled by Apple or Google and RevenueCat using an anonymous ID. The app does not collect device identifiers or advertising attribution.
