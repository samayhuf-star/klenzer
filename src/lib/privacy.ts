export const PRIVACY_UPDATED = '12 November 2026';

export const PRIVACY_SECTIONS: { h: string; p: string }[] = [
  {
    h: 'The short version',
    p: 'Your photos and videos stay on this device and are never uploaded. There is no account and no sign-in. Purchase status for Klenzer Pro is handled by the Apple App Store or Google Play on your device. The app does not collect a name, email address, payment card details, or an account ID.',
  },
  {
    h: 'What Klenzer accesses',
    p: 'With your permission, Klenzer reads your photo and video library on-device to detect duplicate or near-identical photos, screenshots, Live Photos and large videos, and to measure their file sizes. It also reads your device’s total and free storage to show it on the home screen. That media is processed on the device only and is never uploaded.',
  },
  {
    h: 'What is stored on your device',
    p: 'Klenzer stores a few small preferences locally: whether you have finished the intro, the running total of space you have cleared, and whether you turned reminders on. It also keeps an on-device scan cache (file sizes and tiny perceptual hashes, keyed by photo id and modification date) so later scans can skip unchanged items, plus temporary thumbnails you can clear in the app. None of that cache is uploaded. Deleting the app removes this local data.',
  },
  {
    h: 'Purchases',
    p: 'Scanning and reviewing your library is free. Deleting items and clearing temporary files requires Klenzer Pro, sold as a one-time lifetime unlock or an auto-renewing yearly or monthly subscription. Apple or Google processes the payment and the app checks those store entitlements on the device — it does not create an account or send a name or email. You can restore a previous purchase from Settings. Prices are shown in the app at the time of purchase and are not hard-coded.',
  },
  {
    h: 'Deleting photos',
    p: 'Klenzer only deletes items you select, and only after your phone’s own confirmation prompt. On iPhone, deleted items go to Recently Deleted, where you can restore them for up to 30 days. On Android, items you confirm are deleted by the system and Klenzer cannot restore them.',
  },
  {
    h: 'Reminders',
    p: 'If you choose to turn them on (after your first scan), Klenzer schedules a local reminder every 3 days with your current used and total storage. The reminder is created and delivered by your phone itself: no server is involved, nothing is sent to us, and no push token is collected. Opening the app cancels and reschedules it with fresh numbers. Turn them off any time in Klenzer Settings, which cancels all scheduled reminders.',
  },
  {
    h: 'Permissions',
    p: 'Photo and video library access is the only sensitive permission Klenzer requires. Notification permission is optional and only requested if you choose reminders. You can change or revoke either at any time in your device Settings; Klenzer will still open but cannot scan without photo access.',
  },
  {
    h: 'Children',
    p: 'Klenzer is not directed at children under 13. Photos stay on the device. Purchase status, if you buy Pro, is checked with the store on this device as described above.',
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
