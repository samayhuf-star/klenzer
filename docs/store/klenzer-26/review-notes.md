# Klenzer 1.1.0 (build 26) App Review notes: DRAFT, not yet written to ASC

Target: appStoreReviewDetails e99443ac-a605-4b67-874d-a14492e060a4 `notes` (version ae1fd46c, 1.1.0). Plain text below is exactly what will be pasted.

---
Klenzer is a phone storage cleaner. No login, account or demo account is needed. Everything runs on the device; nothing is uploaded.

PHOTO ACCESS
Klenzer asks for Photos access on first launch (NSPhotoLibraryUsageDescription) because it has to read the library on the device to find similar and duplicate photos, blurry photos, screenshots, Live Photos, short and screen recordings, and large videos, and to measure their sizes. It also needs access to delete the items the user selects (always through the iOS confirmation dialog, so items go to Recently Deleted), to convert a Live Photo to a still (saved with NSPhotoLibraryAddUsageDescription), and to move a picked photo into Secret Album. Limited access works; results then cover only the selected photos.

HOW TO REACH THE PAYWALL
1. Launch the app and allow Photos access (full or limited).
2. On the home screen, tap the dark "Pro" button at the top right. The Klenzer Pro screen opens with the yearly, monthly and lifetime options loaded from the App Store (StoreKit 2).
Other ways in: Settings (top-right sliders icon) > "Plan: Free", or use up the 10 free items for the day (deleting, merging contacts or adding to Secret Album), or tap Convert to still on a Live Photo, which is Pro only.

RESTORE
Restore is on the Pro screen ("Restore purchase" link at the bottom) and in Settings > "Restore purchases". It asks StoreKit for the Apple ID's existing transactions (AppStore.sync plus current entitlements), verifies them on the device and unlocks Pro if a lifetime purchase or an active yearly or monthly subscription is found. It shows "Restored", "Nothing to restore" or "Restore didn't finish" and never charges again. There is no account or server; purchase status is only checked with the App Store on the device.

CONTACTS (optional)
Contacts access (NSContactsUsageDescription) is requested only when the user opens the Contacts tab on the home screen and taps Merge duplicate contacts. Klenzer reads names, phone numbers and email addresses on the device to group likely duplicates. The user taps a group to preview, then taps Merge: missing phone numbers and emails are copied onto the contact that stays, and the duplicates are deleted from the address book. No contact data leaves the device.

FACE ID (optional)
Face ID (NSFaceIDUsageDescription) is used only to unlock Secret Album, through LocalAuthentication. A PIN is set first; Face ID can then be turned on. Secret Album holds photos only, encrypted on the device (AES-256-GCM, key in the Keychain, this device only). Klenzer never receives face data.

FREE VS PRO
Scanning, reviewing and Swipe to Organize browsing are free, with 10 free items per day across deleting, merging contacts and adding to Secret Album. Klenzer Pro (com.krosz.klenzer.yearly, com.krosz.klenzer.monthly, com.krosz.klenzer.lifetime) removes the limit and adds Convert to still.

OTHER
Optional local reminders (every 3 days) are scheduled on the device only if the user turns them on; no push server is used. The app has no analytics, ads or tracking. Privacy policy: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html
---
