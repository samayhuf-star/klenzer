export const PRIVACY_UPDATED = 'October 15, 2026';

export const PRIVACY_SECTIONS: { h: string; p: string }[] = [
  { h: 'The short version', p: 'Klenzer works entirely on your device. We do not collect, upload, sell or share your photos, videos or any personal data. There is no account, no analytics and no advertising.' },
  { h: 'What Klenzer accesses', p: 'With your permission, Klenzer reads your photo and video library on-device to detect duplicate or near-identical photos, screenshots, Live Photos and large videos, and to measure their file sizes. It also reads your device’s total and free storage to show it on the home screen.' },
  { h: 'What leaves your device', p: 'Nothing. Scan results are kept in memory on your device and discarded when you close the app. Your photos and videos are never transmitted to us or to anyone else.' },
  { h: 'What is stored on your device', p: 'Klenzer stores a few small preferences locally: whether you have finished the intro, the running total of space you have cleared, whether you turned reminders on, and (on iPhone) how much space is still waiting in Recently Deleted. Klenzer also keeps temporary files such as image thumbnails, which you can clear from the home screen. Deleting the app removes all of this.' },
  { h: 'Deleting photos', p: 'Klenzer only deletes items you select, and only after your phone’s own confirmation prompt. On iPhone, deleted items go to Recently Deleted, where you can restore them for up to 30 days; the space is freed once that album is emptied. iOS does not let apps empty it, so Klenzer offers a shortcut to Photos for you to do it. On Android, items you confirm are deleted by the system and Klenzer cannot restore them.' },
  { h: 'Reminders', p: 'If you choose to turn them on, Klenzer schedules a few occasional reminder notifications (at most five over about six weeks, restarted whenever you open the app). They are created and delivered by your phone itself: no server is involved, nothing is sent to us, and no push token is collected. Turn them off any time in Klenzer Settings or your device Settings.' },
  { h: 'Permissions', p: 'Photo and video library access is the only sensitive permission Klenzer requires. Notification permission is optional and only requested if you choose reminders. You can change or revoke either at any time in your device Settings; Klenzer will still open but cannot scan without photo access.' },
  { h: 'Children', p: 'Klenzer collects no personal information from anyone, including children.' },
  { h: 'Changes', p: 'If this policy changes, the updated version will be shown here and in the store listing, with a new date.' },
  { h: 'Contact', p: 'Questions about this policy? Email samayhuf@gmail.com.' },
];
