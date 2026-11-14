# Klenzer 1.1.0: planned App Store Connect writes (NOT applied; waiting for approval)

App 6820685404. Version 1.1.0 = appStoreVersions ae1fd46c-a8c2-427f-a487-0da13e20c39c (PREPARE_FOR_SUBMISSION).
Snapshot of current values: asc-before.json in this folder (read-only GETs, 12 Nov 2026 ~10:10 PM BDT).

## 1. appStoreVersionLocalizations b7019074-6dba-42cb-a16e-3fd9ba214bad (en-US): PATCH description, promotionalText, keywords

### description (new)
Your photo library fills up with things you never meant to keep: the same shot taken five times, blurry photos, old screenshots, a forgotten 2 GB video. Klenzer finds them on your iPhone, shows them to you, and lets you clear only what you choose.

CLEAN UP PHOTOS
• Similar photos: groups near-identical shots, keeps the largest file by default, and lets you change your pick.
• Duplicates: finds photos with the same size and capture time.
• Blurry photos: spots photos that are out of focus.
• Screenshots: every screenshot in one place, so you can clear the ones you no longer need.
• Live Photos: review photos that also store a short video, and convert a Live Photo to a still photo (Klenzer Pro). The still keeps its date, location, favourite and albums.

CLEAN UP VIDEOS
• Duplicate videos, short recordings, screen recordings and videos over 100 MB.

SWIPE TO ORGANIZE
Go through your gallery month by month. Swipe left to mark a photo for deletion, right to keep it, then confirm once.

MERGE CONTACTS
Finds contacts with the same name, phone number or email. Preview the result, then merge: missing phone numbers and email addresses are copied onto the contact that stays, and the duplicates are removed. Other details such as addresses and notes are not copied.

SECRET ALBUM
Move photos into an encrypted album that lives only on your iPhone, unlocked with Face ID or a PIN. Secret Album holds photos only.

YOU STAY IN CONTROL
Nothing is deleted automatically. You review every item and your iPhone asks you to confirm. Deleted photos go to Recently Deleted, so you can change your mind.

PRIVATE BY DESIGN
Photos, videos and contacts are processed on your iPhone and never uploaded. No account, no tracking, no ads and no analytics.

FREE AND PRO
Scanning and reviewing are free, with 10 free items a day for deleting, merging contacts and adding to Secret Album. Klenzer Pro removes the daily limit and adds Convert to still. Pro is available as a monthly or yearly auto-renewing subscription or a one-time lifetime purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel them in your App Store account settings. Prices are shown in the app.

GOOD TO KNOW
Klenzer cleans photos, videos and contacts. It cannot clear other apps' data or system files. Photos stored only in iCloud are not measured. To free space after deleting, empty Recently Deleted in the Photos app. iOS doesn't let apps do this, so Klenzer shows how much is waiting and opens Photos for you.

Optional reminders: if you turn them on, Klenzer schedules a local reminder every few days with your storage numbers. Nothing is sent to us.

Terms of Use: https://samayhuf-star.github.io/app-legal/klenzer/terms.html
Privacy Policy: https://samayhuf-star.github.io/app-legal/klenzer/privacy.html

### What changed in the description and why
- Removed "Purchase status for Klenzer Pro is handled by the store and RevenueCat using an anonymous ID." (no RevenueCat; app uses StoreKit 2 via expo-iap).
- Removed "Temporary files" and "Quick clean ... temporary files" bullets: no temp-files control is reachable in the 1.1.0 UI.
- Reminders: was "at most five over about six weeks"; code schedules one every 3 days (src/lib/reminders.ts INTERVAL_SECONDS).
- Added only features that work in build 26: Similar, Duplicates, Blurry, Screenshots, Live Photos + Convert, video groups, Swipe, Merge Contacts (phones and emails only), Secret Album (photos only), 10/day free limit, auto-renew terms.
- No Compress, no "AI", no ellipsis character.

### promotionalText (new, 156 chars)
Clear look-alike photos, blurry shots, old screenshots and big videos. Merge duplicate contacts and keep private photos in Secret Album. All on your iPhone.
(current text has no Compress or RevenueCat; changed to cover the 1.1.0 features)

### keywords (new, 99 chars)
duplicate,similar,photo cleaner,screenshots,videos,storage,merge contacts,secret album,blurry,swipe
(current: duplicate,similar,screenshots,videos,storage,space,free up,declutter,gallery,large files,organizer; neither contains compress)

## 2. appInfoLocalizations abcbe24b (en-US)
No change. name "Klenzer: Phone Storage Cleaner", subtitle "Duplicate & Screenshot Cleaner", privacyPolicyUrl https://samayhuf-star.github.io/app-legal/klenzer/privacy.html (now republished, see privacy-live-check.txt).

## 3. Age rating: ageRatingDeclarations 6af1a0db-4f30-4457-a971-128d45318be7
Already declared, all content NONE / false, appStoreAgeRating FOUR_PLUS (read 12 Nov 2026). Values fit Klenzer (no UGC, no web access, no messaging, no gambling, no ads). No write needed; will re-read after build 26 to confirm.

## 4. appStoreReviewDetails e99443ac-a605-4b67-874d-a14492e060a4
- notes: replace with review-notes.md text (3,139 chars, limit 4,000).
- contactLastName: currently "Vashisht". Proposed "Vashsht" to match Samay's legal name rule. Needs Samay's OK (it is his contact record for Apple).
- contactPhone is set (Apple-only, not public). demoAccountRequired false (no login).

## 5. Build attach (after build 26 is VALID)
PATCH /v1/appStoreVersions/ae1fd46c-a8c2-427f-a487-0da13e20c39c/relationships/build -> build 26 id (replaces build 15, ea8b96b3-ab1c-49dd-8d43-3b15537035db).

## 6. Screenshots
NOT uploaded. Previews for Samay: store-shots/6.9 (1320x2868, APP_IPHONE_69) and store-shots/6.5 (1284x2778, APP_IPHONE_65). After approval, upload both sets and remove the 5 old APP_IPHONE_67 shots (they show the pre-redesign UI).

## 7. App Privacy
Not writable by API. See app-privacy-answers.md (Samay does it in the web UI).
