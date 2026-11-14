# Klenzer - Clean Photo Clutter — iOS App Store Connect check

- Date: 12 Nov 2026 (Asia/Dhaka)
- Scope: read-only. Nothing was edited or submitted.
- Bundle: `com.krosz.klenzer`
- ASC app id: `6820685404`

## 1. Version and build
- iOS version **1.1.0** — appStoreState `PREPARE_FOR_SUBMISSION`, appVersionState `PREPARE_FOR_SUBMISSION`
- Copyright: 2026 Klenzer
- Release type: AFTER_APPROVAL
- usesIdfa: not set (null)
- Version created: 09 Oct 2026, 02:13 AM Asia/Dhaka (source: 2026-10-08T13:13:45-07:00)
- Attached build **12** — processingState `VALID`, expired=False, usesNonExemptEncryption=False, min iOS 16.4
- Uploaded: 11 Nov 2026, 03:01 AM Asia/Dhaka (source: 2026-11-10T13:01:37-08:00)
- Expires: 09 Feb 2027, 03:01 AM Asia/Dhaka (source: 2027-02-08T13:01:37-08:00)
- EAS iOS build match: version 1.1.0 (12), git `8078b978f49d36a071fd533e301b38353eb3f567` — Bump version to 1.1.0
- EAS created: 11 Nov 2026, 02:07 AM Asia/Dhaka (source: 2026-11-10T20:07:10.103Z)
- Newer finished EAS iOS build exists: 1.0.0 (14) at `951f7ed972f41edef51644c59e48b8c6cd398b8c` — Match RevenueCat entitlement id klenzer_pro (11 Nov 2026, 01:15 PM Asia/Dhaka)
- GitHub `samayhuf-star/klenzer` main is `0c10f20e1ced` (Add README, 12:56 AM Asia/Dhaka on 12 Nov 2026, source 2026-11-11T18:56:37Z). Compare against the EAS build-12 commit `8078b978f49d` is **diverged**: main is 1 commit ahead and 4 commits behind (merge-base `5ac902272dd6`). The attached binary is not the commit at the tip of main.
- The later finished EAS iOS build 1.0.0 (14) is `951f7ed972f4` (Match RevenueCat entitlement id klenzer_pro).

## 2. Screenshots
- Sets present: APP_IPHONE_67

| File | Display type | Declared | PNG | State | Source name |
|---|---|---|---|---|---|
| `/workspace/klenzer-store/screenshots/6.7/01.png` | APP_IPHONE_67 | 1290×2796 | 1290×2796 | COMPLETE | klenzer-ios-6.9-1_1.png |
| `/workspace/klenzer-store/screenshots/6.7/02.png` | APP_IPHONE_67 | 1290×2796 | 1290×2796 | COMPLETE | klenzer-ios-6.9-2_1.png |
| `/workspace/klenzer-store/screenshots/6.7/03.png` | APP_IPHONE_67 | 1290×2796 | 1290×2796 | COMPLETE | klenzer-ios-6.9-3_1.png |
| `/workspace/klenzer-store/screenshots/6.7/04.png` | APP_IPHONE_67 | 1290×2796 | 1290×2796 | COMPLETE | klenzer-ios-6.9-4_1.png |
| `/workspace/klenzer-store/screenshots/6.7/05.png` | APP_IPHONE_67 | 1290×2796 | 1290×2796 | COMPLETE | klenzer-ios-6.9-5_1.png |

## 3. en-US listing metadata
- Name (app info): Klenzer - Clean Photo Clutter
- Subtitle (app info): Storage or Space, File Cleaner
- Keywords: storage, storage manager, storage full, duplicate, iphone space, space problem, storage fix
- Promotional text: Find duplicate photos, old screenshots and huge videos in seconds. Review everything, delete only what you choose. 100% on-device and private.
- Support URL: https://klenzer-privacy-krosz.vercel.app
  - HTTP 402 final `https://klenzer-privacy-krosz.vercel.app/` title=— usable=False
- Marketing URL: —
- What's New: —

### Description

Your camera roll is full of things you never meant to keep: the same photo taken three times, screenshots from months ago, a 2 GB video you forgot about. Klenzer finds them, shows them to you, and lets you clear them in a few taps.

WHAT KLENZER DOES
• Duplicates & near-identical photos: finds sets of photos taken at the same moment with the same dimensions, keeps the largest file by default, and lets you change your pick.
• Screenshots: see every screenshot, biggest first, and clear the ones you no longer need.
• Large videos: surface videos over 100 MB so you can reclaim the most space with the fewest taps.
• Live Photos: review photos that also store a short video clip and clear the ones you don't need.
• Temporary files: clear Klenzer's own temporary files in one tap.
• Quick clean: clear duplicates and temporary files together, with live progress as each step finishes.
• Real storage numbers: see your device's actual free and total space, straight from the system.

YOU STAY IN CONTROL
Nothing is ever deleted automatically. You review every item, choose what goes, and your iPhone asks you to confirm. Deleted items land in Recently Deleted, so you can change your mind.

PRIVATE BY DESIGN
Klenzer works entirely on your device. Your photos are never uploaded, shared or analysed in the cloud. No account, no tracking, no ads.

GOOD TO KNOW
Klenzer cleans photos and videos, which are usually the biggest users of space. It does not and cannot clear other apps' data or system files. Photos stored only in iCloud are not measured. To free space after deleting, empty Recently Deleted in the Photos app: iOS doesn't allow apps to do this, so Klenzer shows how much is waiting there and opens Photos for you.

Optional reminders: if you turn them on, Klenzer sends a few occasional notifications (at most five over about six weeks). They are scheduled on your device; nothing is sent to us.

Klenzer needs access to your photo library to work. You can allow full access or just selected photos.

Questions? Contact us from Settings › Contact support.

## 4. Privacy policy and App Privacy labels
- privacyPolicyUrl: https://klenzer-privacy-krosz.vercel.app
- HTTP 402 — final `https://klenzer-privacy-krosz.vercel.app/` — 78 bytes — type `text/plain; charset=utf-8` — title: —
- Page signals: payment required, deployment_disabled
- Body preview: Payment required

DEPLOYMENT_DISABLED

hkg1::cspx4-1794456491890-d854f9711841

- App Privacy data-usage declarations: not exposed by the public App Store Connect API (probed appDataUsages / appPrivacy / nutritionLabel-style paths return PATH_ERROR / 404)

## 5. Review details
- Contact: Samay Vashisht — [phone redacted] — samayhuf@gmail.com
- Demo account required: False
- Notes:

Klenzer is a native app (Expo/React Native) that uses PhotoKit via expo-media-library to scan the user's library on-device. No login required; no demo account needed. To test, allow Photos access and tap "Scan my library". Deletion uses the system confirmation dialog (PHPhotoLibrary performChanges). No data is transmitted off device. Photo access purpose is stated in NSPhotoLibraryUsageDescription. The app can optionally schedule local (on-device) reminder notifications if the user enables them in Settings or on the success screen; no push server or remote notifications are used.

## 6. Age rating, price, availability, copyright, encryption
- App Store age rating: FOUR_PLUS
- Age rating declaration notables: all standard questions NONE/false
- Categories: UTILITIES, PHOTO_AND_VIDEO
- App price (USA): 0.0 (base territory USA) free
- Availability: 175 of 175 catalog territories; availableInNewTerritories=True; missing=none
- Territory contentStatuses: {'["CANNOT_SELL", "AVAILABLE_FOR_SALE_UNRELEASED_APP"]': 175}
- Copyright: 2026 Klenzer
- usesNonExemptEncryption (build): False

## 7. IAPs and subscriptions
- Non-consumable/IAP `com.krosz.klenzer.lifetime` — Lifetime unlock — type NON_CONSUMABLE — **state MISSING_METADATA** — USA price: 14.99
  - en-US: Lifetime unlock — Clear photos and videos. Pay once, keep forever. (loc state PREPARE_FOR_SUBMISSION)
  - Review note: Lifetime unlock is a one-time, non-consumable purchase. Scanning and reviewing results are free. To test: open Klenzer, allow Photos access, tap Scan my library, then tap Fix now (or Delete on any review screen). The payment sheet appears and the purchase unlocks all clearing features. Restore purchase is in the same sheet.
  - App Store review screenshot: none / not returned
- Subscription group **Klenzer Pro** (id 22565864)
  - `com.krosz.klenzer.monthly` — Klenzer Monthly — ONE_MONTH — **state MISSING_METADATA** — USA price: 3.99
    - en-US: Klenzer Pro Monthly — Clear photos, videos and junk. Renews monthly. (loc state PREPARE_FOR_SUBMISSION)

**Flag: this app has IAPs, subscriptions, and/or a non-free price. The Paid Apps agreement is not signed, so paid products will not load in StoreKit until Samay signs it.**

## 8. Text-field scan (AI, placeholders, lorem, TODO, example.com)
- No matches in ASC text fields.

## What's OK / missing
### Missing or blocking
- Privacy URL HTTP 402
- Support URL is not a working page (HTTP 402)
- IAP com.krosz.klenzer.lifetime state is MISSING_METADATA
- Subscription com.krosz.klenzer.monthly state is MISSING_METADATA

### Other flags
- Has IAP com.krosz.klenzer.lifetime (MISSING_METADATA) — Paid Apps agreement is not signed
- Has subscription com.krosz.klenzer.monthly (MISSING_METADATA) — Paid Apps agreement is not signed

Nothing was submitted or changed in App Store Connect.
