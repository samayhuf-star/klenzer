# Ai Klenzer

Private, on-device photo clutter cleaner for iOS and Android. Ai Klenzer finds duplicate and similar photos, screenshots, blurry shots, Live Photos, screen recordings, and large videos, then lets you review and delete only what you choose. Photos are never uploaded.

Scanning and reviewing are free. Without Ai Klenzer Pro you can clear 10 items a day, shared across deletes, contact merges, and Secret Album. Pro removes that limit. Yearly and monthly show a 7-day free trial when the store says the user is eligible.

App version in `app.json`: 1.1.1. EAS production builds take the version and build number from the remote source (`eas.json` `appVersionSource: remote`), so set 1.1.1 there before the next store build.

## Features

- Exact duplicates and similar photos (native thumbnail analysis, including iCloud-only photos)
- Screenshot, blurry-photo, Live Photo, screen-recording, and large-video review
- Scan progress with a prominent percent, per-category bars, and a note that you can leave the app running
- A local notification when the scan finishes, after the notification prompt is answered
- The scan starts once full Photos access is granted
- Swipe to Organize, Merge Contacts, and Secret Album
- Confirm-before-delete (a single system dialog for the whole selection)
- Optional local reminder (no push server)
- Ai Klenzer Pro: yearly, monthly (7-day trial when eligible), or a one-time lifetime unlock

## Tech stack

- Expo (SDK 57) + Expo Router + TypeScript
- `expo-media-library` for on-device PhotoKit / Android media access
- `expo-sqlite` for the scan cache; native thumbnail hashing for Duplicate, Similar, and Blurry
- `expo-notifications` for local reminders and the scan-complete notification (no push server)
- StoreKit 2 / Play Billing via `expo-iap` (no RevenueCat)
- EAS Build profiles: `production`, `simulator`, `preview`, `development`

## Identifiers

- Expo project: `@krosz/klenzer` (`c6034b7f-62d6-487e-aff1-f013636ae0b5`)
- iOS bundle ID / Android package: `com.krosz.klenzer`
- Display name: Ai Klenzer
- `supportsTablet`: false
- `ITSAppUsesNonExemptEncryption`: false
- Store product IDs (prices come from the store’s localized displayPrice): `com.krosz.klenzer.yearly`, `com.krosz.klenzer.monthly`, `com.krosz.klenzer.lifetime`
- App Store Connect app id used by EAS Submit: `6820685404`

## Run locally

```bash
npm ci
npm run typecheck
npx expo start
```

Photo-library features and store purchases need a development or production build, not Expo Go.

Dev-only web screenshots (never active in production):

```bash
EXPO_PUBLIC_DEMO=1 npx expo start --web
```

## Privacy and support

- Privacy: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html
- Terms: https://samayhuf-star.github.io/app-legal/klenzer/terms.html
- Support: https://samayhuf-star.github.io/app-legal/klenzer/support.html
- Contact: samayhuf@gmail.com

Do not run `eas build` or `eas submit` from a release-candidate branch until the remote version is set to 1.1.1 and build 27 has finished App Store review.
