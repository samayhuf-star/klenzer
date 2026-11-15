export const PRIVACY_UPDATED = '15 November 2026';

export const PRIVACY_SECTIONS: { h: string; p: string }[] = [
  {
    h: 'The short version',
    p: 'Your photos, videos and contacts stay on this device and are never uploaded. There is no account and no sign-in. Purchase status for Ai Klenzer Pro is handled by the Apple App Store or Google Play on your device. The app does not collect a name, email address, payment card details, or an account ID.',
  },
  {
    h: 'What Ai Klenzer accesses',
    p: 'With your permission, Ai Klenzer reads your photo and video library on-device to find duplicate or near-identical photos, blurry photos, screenshots, Live Photos, recordings and large videos, and to measure their file sizes. If a photo is only in iCloud, the scan can use a small thumbnail on the device. When you convert a Live Photo to a still, it copies that photo’s existing date, location, favourite state and album membership onto the new still. It does not track where you are. It also reads your device’s total and free storage for the home screen. That media is processed on the device only and is never uploaded.',
  },
  {
    h: 'Contacts',
    p: 'If you open Merge Contacts and allow access, Ai Klenzer reads the names, phone numbers and email addresses in your address book on the device to find likely duplicates. When you confirm a merge, it copies the missing numbers and emails onto the contact that stays and deletes the duplicates from your address book. Contacts are never uploaded, copied off the device, or stored by Ai Klenzer outside your address book.',
  },
  {
    h: 'Secret Album',
    p: 'Photos you move into Secret Album are encrypted on the device with AES-256-GCM and stored inside Ai Klenzer’s private storage. The encryption key is created on your phone and kept in the system Keychain, for this device only. Your PIN is never stored, only a salted hash of it, also in the Keychain. If you turn on Face ID, iOS checks your face and only tells Ai Klenzer whether it matched; Ai Klenzer never receives face data. After a photo is added, Ai Klenzer can delete the original from Photos if you confirm. Ai Klenzer cannot recover a forgotten PIN, and deleting the app deletes Secret Album.',
  },
  {
    h: 'What is stored on your device',
    p: 'Ai Klenzer stores a few small preferences locally: whether you have finished the intro, how many free items you have used today, the running total of space you have cleared, whether cleanup reminders are on, and whether you chose not to see the Recently Deleted reminder again. It also keeps the last scan result and an on-device scan cache (file sizes and tiny perceptual hashes, keyed by photo id and modification date) so the next launch can show what it already found and later scans can skip unchanged items, plus temporary thumbnails you can clear in the app. None of that cache is uploaded. Deleting the app removes this local data.',
  },
  {
    h: 'Purchases',
    p: 'Scanning and reviewing your library is free. Without Ai Klenzer Pro you get 50 free items each day, shared across deleting photos and videos, merging contacts and adding photos to Secret Album, counted on the device only. Ai Klenzer Pro removes that limit and adds Convert Live Photo to still. Pro is a one-time lifetime unlock or an auto-renewing yearly or monthly subscription. Yearly and monthly show a 7-day free trial in the app only when the store says this account is eligible. The lifetime unlock has no trial. Payment is handled on the device by the Apple App Store (StoreKit) or Google Play Billing. Ai Klenzer does not use RevenueCat, and it does not collect a name, email, or payment card. You can restore a previous purchase from Settings or the Ai Klenzer Pro screen. Prices come from the store and are not hard-coded.',
  },
  {
    h: 'Deleting photos',
    p: 'Ai Klenzer only deletes or converts items you select, and only after your phone’s own confirmation prompt. Converting a Live Photo keeps the still (with its date, location, favourite state and albums) and removes the original Live Photo. On iPhone, originals go to Recently Deleted, where you can restore them for up to 30 days. Space is freed after you empty Recently Deleted, or after those 30 days. On Android, items you confirm are deleted by the system and Ai Klenzer cannot restore them. Convert to still is available on iPhone.',
  },
  {
    h: 'Reminders',
    p: 'Cleanup reminders are on unless you turn them off. Ai Klenzer schedules a local notification every 3 days at 8:00 AM, with the amount ready to review when a scan has measured one. Buying Ai Klenzer Pro does not turn them off. The reminder is created and delivered by your phone itself: no server is involved, nothing is sent to us, and no push token is collected. Opening the app reschedules the next ones with a fresh size. Turn them off any time with the Cleanup reminders switch in Settings, which cancels the scheduled reminders. That switch works whether or not you have bought Pro.',
  },
  {
    h: 'Permissions',
    p: 'Photo and video library access is the only permission Ai Klenzer needs to scan. It is requested when you tap Get started or Scan, not on a later cold launch. Contacts access is optional and only requested when you open Merge Contacts. Face ID is optional and only used to unlock Secret Album. Notification permission is requested when you start a scan or turn Cleanup reminders on, so the phone can say when a scan finishes and deliver the local reminder. You can change or revoke any of these at any time in your device Settings; Ai Klenzer will still open but cannot scan without photo access.',
  },
  {
    h: 'Children',
    p: 'Ai Klenzer is not directed at children under 13. Photos stay on the device. Purchase status, if you buy Pro, is checked with the store on this device as described above.',
  },
  {
    h: 'Changes',
    p: 'If this policy changes, the updated version will be shown here and at the public privacy policy URL, with a new date.',
  },
  {
    h: 'Contact',
    p: 'Questions about this policy? Email samayhuf@gmail.com.',
  },
];
