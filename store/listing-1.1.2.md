# Klenzer 1.1.2 — App Store listing draft (22 Nov 2026)

Draft only. Nothing here has been entered in App Store Connect or submitted.

| Field | Current (1.1.1) | Proposed (1.1.2) | Length |
|---|---|---|---|
| Name | Klenzer: Photo Storage Cleaner | Klenzer: Photo Storage Cleaner (unchanged) | 30/30 |
| Subtitle | Recordings & Large Videos | Duplicate & Similar Photos | 26/30 |
| Keywords | screen recordings,large videos,similar,screenshots,live photos,blurry,on device,free trial,declutter | cleanup,clean,phone,iphone,space,free,screenshots,videos,large,delete,gallery,swipe,contacts,merge | 98/100 |
| Promotional text | Find screen recordings, large videos and similar photos. Review before you delete. 7-day trial when eligible. 100% on-device. | Find duplicate and similar photos, old screenshots and large videos. Review first, then clear what you choose. Scans on your iPhone; photos are never uploaded. | 159/170 |

The "Current" column is from store/listing.md in the repo; check it against App Store Connect before editing.

## Why these changes
- The live listing got 142 impressions in 30 days. Its subtitle and keywords target narrow phrases (recordings, large videos). The proposal moves to the words people type for this kind of app: duplicate, similar, cleanup, clean, phone, space.
- Keywords no longer repeat words already in the name or subtitle (photo, storage, cleaner, duplicate, similar), and use single words so Apple can combine them.
- "free trial" is removed from keywords and promo text: the app offers Lifetime and Monthly, and trial wording must match what the store shows.
- These are judgement calls, not measured search volumes. Check them against an ASO tool before release.

## What's New (1.1.2)
• Fresh blue look across the app.
• Optional Tips and updates notifications, off until you turn them on in Settings.
• Manage or restore your Ai Klenzer Pro purchase from Settings.
• Fixes for accessibility labels and the privacy link.

## Description changes
- Replace "Yearly and monthly can start with a 7-day free trial..." with: "Ai Klenzer Pro is a one-time Lifetime unlock or a Monthly subscription. Monthly shows a free trial only when the App Store says you are eligible."
- Replace "Purchase status for Ai Klenzer Pro is handled by the Apple App Store or Google Play on the device." with: "Purchases are made through the App Store. RevenueCat confirms purchase status using a random ID; it never receives your photos."
- Replace "There is no account, no tracking and no ads." with: "There is no account and no ads. Notifications from us are off unless you turn on Tips and updates."

## App Privacy label changes needed before submission
- Purchases: Purchase History (RevenueCat), not linked to identity, App Functionality.
- Identifiers: Device ID (OneSignal push token), collected only if Tips and updates is on.
- Usage Data: Product Interaction (notification opens via OneSignal), only if Tips and updates is on.

## Screenshots (6.9 inch, 1320x2868)
1. See what fills your iPhone
2. Clear look-alike photos
3. Find exact duplicates
4. Swipe to sort a month
5. Old screenshots, gone
6. Merge duplicate contacts
7. A private Secret Album
8. Scans on your device

Plus one paywall screenshot for in-app purchase review.
