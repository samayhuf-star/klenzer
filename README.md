# Klenzer

Private, on-device photo clutter cleaner for iOS and Android. Klenzer finds duplicate or near-identical photos, screenshots, Live Photos, and large videos, then lets you review and delete only what you choose. Nothing is uploaded.

This README is a draft (the GitHub repo `samayhuf-star/klenzer` has no root README.md). It is based on the public `main` branch plus a read-only Expo/store audit on 12 Nov 2026. It has not been committed or pushed.

## Features (as implemented on `main`)

- Duplicate and near-identical photo sets (keeps the largest file by default)
- Screenshot and large-video review
- Live Photos review
- Temporary-file cleanup for Klenzer’s own cache
- Real device free/total storage figures
- Confirm-before-delete (system dialog); on iOS, items go to Recently Deleted
- Optional local reminder notifications (no push server)
- In-app privacy policy screen

Later EAS builds from branches such as `revenuecat-integration` and `feat/lifetime-paywall` add a RevenueCat paywall (entitlement id `klenzer_pro`, including a one-time lifetime unlock). Those changes are **not** on `main` as of this draft (`main` `package.json` has no RevenueCat dependency, and `store/listing.md` still says “free, no in-app purchases (v1)”). Confirm which branch you are shipping before writing store copy.

## Tech stack

- Expo (SDK 57) + Expo Router + TypeScript
- `expo-media-library` for on-device PhotoKit / Android media access
- EAS Build profiles: `production`, `simulator`, `testflight` (plus development/preview in `eas.json`)

## Identifiers

- Expo project: `@krosz/klenzer` (`c6034b7f-62d6-487e-aff1-f013636ae0b5`)
- iOS bundle ID: `com.krosz.klenzer`
- Android package: `com.krosz.klenzer`
- `supportsTablet`: false
- `ITSAppUsesNonExemptEncryption`: false
- Owner account: `krosz`

## Run locally

```bash
npm install
npm run typecheck
npx expo start
```

Photo-library features need a real device (or a development/simulator build), not just Expo Go.

## Build and submit (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
# Only after a go-ahead and working store credentials:
# npx eas-cli@latest submit --platform ios --latest
# npx eas-cli@latest submit --platform android --latest
```

iOS distribution certificate and an App Store provisioning profile are already on the Expo project, and an App Store Connect API key is attached for submissions. There is **no** Google Play service account key on the Expo account, so Android EAS Submit will not work until one is added with Play access. ASC app id used in prior iOS submissions: `6820685404`.

## Paywall / RevenueCat

- On `main`: none.
- On later build branches: RevenueCat, entitlement `klenzer_pro`. Do not put API keys in this file. If you use EAS environment variables, keep values in Expo (not in git).

## Privacy and support

- In-app policy: `src/lib/privacy.ts` (last updated October 15, 2026). Source HTML: `store/privacy-policy.html`.
- Published site (GitHub Pages, folder `/docs`, custom domain file `docs/CNAME`):
  - Privacy: https://klenzer.online/privacy
  - Terms: https://klenzer.online/terms
  - Support: https://klenzer.online/support
- App constants in `src/lib/config.ts`: `PRIVACY_URL`, `TERMS_URL`, `SUPPORT_URL`.
- Support email: `samayhuf@gmail.com`

### GitHub Pages and klenzer.online

Pages publishes the `/docs` folder on `main`. After this branch is merged:

1. GitHub → `samayhuf-star/klenzer` → Settings → Pages.
2. Build and deployment → Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/docs`. Save.
4. Custom domain: `klenzer.online`. Save. `docs/CNAME` already contains that hostname. Enforce HTTPS once the certificate is ready (can take up to 24 hours after DNS is correct).

GoDaddy DNS for the apex and `www` (remove any parking A record or domain forwarding first):

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `samayhuf-star.github.io` |

`www` must point at `samayhuf-star.github.io`, not at the repository path. GitHub also accepts these AAAA records on `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

## Store status (public, 12 Nov 2026)

- App Store Connect record exists (name “Klenzer - Clean Photo Clutter”). The public US and India App Store listings were **not** found (iTunes lookup count 0). ASC icon was still a placeholder asset. Review/draft/rejected state is unknown without App Store Connect.
- Latest submitted iOS binary: 1.1.0 (12), EAS submission finished 11 Nov 2026. A newer iOS production build 1.0.0 (14) (RevenueCat branch) has not been submitted.
- Google Play public listing: not found (HTTP 404). Finished Android production builds exist (latest 1.0.0 (5)); none have been submitted via EAS. Play Console draft/testing state is unknown.
