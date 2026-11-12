# Klenzer: store listing (ASO-optimised, policy-safe)

Every claim below is something the app actually does. Do not add "boost", "speed up", "RAM", "battery", "virus", "junk", "cache" or "system data" language: Apple 2.3.1/5.6 and Google Play's Deceptive Behavior / Misleading Claims policies treat those as fake-optimizer signals.

## Apple App Store

| Field | Value | Limit |
|---|---|---|
| Name | Klenzer - Phone Storage Cleaner | 31/30 (one over the App Store 30-character name limit; see note below) |
| Subtitle | Duplicate & Screenshot Cleaner | 30/30 |
| Category | Primary: Utilities · Secondary: Photo & Video | |
| Age rating | 4+ | |
| Price | Free to download. In-app purchases: yearly auto-renew (`com.krosz.klenzer.yearly`), monthly auto-renew (`com.krosz.klenzer.monthly`), and lifetime unlock (`com.krosz.klenzer.lifetime`). Prices are shown in the app from the store and are not hard-coded. | |


**Name-limit note:** Samay’s tagline is “Phone Storage Cleaner”. “Klenzer - Phone Storage Cleaner” is 31 characters, one over Apple’s 30-character name limit. At submit time use a 30-character form such as “Klenzer Storage Cleaner” (23) if App Store Connect rejects the 31-character name. The home-screen icon label stays “Klenzer”. Play’s 30-character title “Klenzer: Phone Storage Cleaner” fits exactly.

**Keywords (100 max):**
`duplicate,similar,screenshots,videos,storage,space,free up,declutter,gallery,large files,organizer,tidy`

**Promotional text (170 max):**
Find duplicate photos, old screenshots and huge videos in seconds. Review everything, delete only what you choose. 100% on-device and private.

**Description:**
Your camera roll is full of things you never meant to keep: the same photo taken three times, screenshots from months ago, a 2 GB video you forgot about. Klenzer finds them, shows them to you, and lets you clear them in a few taps.

**WHAT KLENZER DOES**
• Duplicates & near-identical photos: finds sets of photos taken at the same moment with the same dimensions, keeps the largest file by default, and lets you change your pick.
• Screenshots: see every screenshot, biggest first, and clear the ones you no longer need.
• Large videos: surface videos over 100 MB so you can reclaim the most space with the fewest taps.
• Live Photos: review photos that also store a short video clip and clear the ones you don't need.
• Temporary files: clear Klenzer's own temporary files in one tap.
• Quick clean: clear duplicates and temporary files together, with live progress as each step finishes.
• Real storage numbers: see your device's actual free and total space, straight from the system.

**YOU STAY IN CONTROL**
Nothing is ever deleted automatically. You review every item, choose what goes, and your iPhone asks you to confirm. Deleted items land in Recently Deleted, so you can change your mind.

**PRIVATE BY DESIGN**
Your photos are never uploaded, shared or analysed in the cloud. There is no account, no tracking and no ads. Purchase status for Klenzer Pro is handled by the Apple App Store or Google Play on the device.

**GOOD TO KNOW**
Klenzer cleans photos and videos, which are usually the biggest users of space. It does not and cannot clear other apps' data or system files. Photos stored only in iCloud are not measured. To free space after deleting, empty Recently Deleted in the Photos app: iOS doesn't allow apps to do this, so Klenzer shows how much is waiting there and opens Photos for you.

Optional reminders: if you turn them on, Klenzer sends a few occasional notifications (at most five over about six weeks). They are scheduled on your device; nothing is sent to us.

Klenzer needs access to your photo library to work. You can allow full access or just selected photos.

Questions? Contact us from Settings › Contact support.

**What's New (1.0):** Welcome to Klenzer! Find and clear duplicate photos, screenshots and large videos, privately and on-device.

**App Review notes:**
Klenzer is a native app (Expo/React Native) that uses PhotoKit via expo-media-library to scan the user's library on-device. No login required; no demo account needed. To test, allow Photos access and tap "Scan my library". Deletion uses the system confirmation dialog (PHPhotoLibrary performChanges). No data is transmitted off device. Photo access purpose is stated in NSPhotoLibraryUsageDescription. The app can optionally schedule local (on-device) reminder notifications if the user enables them in Settings or on the success screen; no push server or remote notifications are used.

### App Privacy ("nutrition label") answers
No data is collected by the app for purchases. Apple or Google processes the payment under their policies. The app checks store entitlements on the device only; it does not collect a user ID, and photos stay on the device. No Device ID and no advertising attribution.

## Google Play

| Field | Value | Limit |
|---|---|---|
| Title | Klenzer: Phone Storage Cleaner | 30/30 |
| Short description | Find duplicate photos, screenshots & big videos. Private, on-device. | 68/80 |
| Category | Tools (or Photography) | |
| Content rating | Everyone (complete IARC questionnaire: no UGC, no ads, no purchases) | |
| Price | Free, no ads, no purchases | |
| Target audience | 18+ / general (NOT children; avoids Families policy) | |

**Full description:**
Your gallery is full of things you never meant to keep: the same photo three times, old screenshots, a huge video you forgot about. Klenzer finds them, shows them to you, and helps you clear them in a few taps.

★ WHAT KLENZER DOES
• Duplicates & near-identical photos: finds sets of photos taken at the same moment with the same dimensions, keeps the largest by default, and lets you change your pick.
• Screenshots: review every screenshot, biggest first, and clear the ones you don't need.
• Large videos: surface videos over 100 MB to reclaim the most space fast.
• Temporary files: clear Klenzer's own temporary files in one tap.
• Quick clean: clear duplicates and temporary files together, with live progress.
• Real storage numbers: see your device's actual free and total space.

★ YOU STAY IN CONTROL
Nothing is deleted automatically. You review every item and choose what goes. Android asks you to confirm before anything is deleted. Deleted items can't be restored by Klenzer, so check your selection.

★ PRIVATE BY DESIGN
Photos are never uploaded or shared. There is no account, no tracking and no ads. Purchase status for Klenzer Pro is handled by the Apple App Store or Google Play on the device.

★ GOOD TO KNOW
Klenzer cleans photos and videos, typically the biggest users of space. It does not clear other apps' data or system files.

Optional reminders: if you turn them on, Klenzer sends a few occasional notifications (at most five over about six weeks), scheduled on your device. Nothing is sent to us.

Klenzer needs permission to read your photos and videos to find clutter. You can change this any time in Settings.

### Data safety answers
- Data collected: none by the app for purchases. Photos are not uploaded. No device identifiers, user ID, or tracking.
- Data shared: none. Apple or Google processes the payment under their own policies.
- Privacy policy URL: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html
- Terms URL: https://samayhuf-star.github.io/app-legal/klenzer/terms.html
- Support URL: https://samayhuf-star.github.io/app-legal/klenzer/support.html

### Photo & Video permissions declaration (REQUIRED, high rejection risk)
Play restricts `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`. In Play Console › App content › Photo and video permissions, declare:
- Core use case: **"Gallery / storage cleaner. The app's core purpose is scanning the user's full media library to find duplicates, screenshots and large videos."**
- Explain why the photo picker is insufficient: the app must enumerate and measure the whole library and delete selected items; a one-time picker cannot do that.
- Provide a short screen recording (scan → review → delete confirmation). Have this ready before submitting; without approval the build is rejected.

## Pre-submission compliance checklist
- [x] No fake/hardcoded device data; all numbers from the OS or computed from the user's library
- [x] No misleading optimizer claims
- [x] No ads or tracking SDKs. Purchases use StoreKit / Play Billing only. Device-identifier and AdServices collection are not enabled.
- [x] Permission strings explain exactly why (iOS) and permissions minimised (Android: audio/location/overlay blocked)
- [x] Deletion needs user selection + OS confirmation; never automatic
- [x] Privacy manifest included (iOS). Data Safety / App Privacy: the app does not collect a user ID or purchase history on its own servers; photos are not collected.
- [x] Not a thin web wrapper: native photo-library integration (Apple 4.2)
- [x] Reminders are opt-in, local-only (no push/APNs), capped at 5 over ~6 weeks, and reset on each open
- [x] Hosted privacy, terms and support at https://samayhuf-star.github.io/app-legal/klenzer/ (set in `src/lib/config.ts`)
- [ ] Capture screenshots on a real device/simulator (6.9" iPhone, 6.5" iPhone, iPad not required: supportsTablet=false; Android phone)
- [ ] Android Photo/Video declaration + video (above)
- [ ] Register bundle id `com.krosz.klenzer` (change in app.json if you prefer another)
