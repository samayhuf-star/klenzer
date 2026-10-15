# Google Play Console: answers to paste (Klenzer)

Cannot be submitted by automation: these are forms in Play Console › App content. Copy the text below.

## Photo and video permissions declaration
Permissions: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` (and `READ_MEDIA_VISUAL_USER_SELECTED`).

**Core functionality (select):** Gallery / media manager, storage cleaner.

**Why the photo picker is not enough:**
Klenzer's single purpose is to find duplicate photos, screenshots, Live Photos and large videos across the user's whole library and let them delete the ones they choose. This requires enumerating and measuring every item in MediaStore and deleting selected items after a system confirmation. The Android photo picker only returns items the user hand-picks one session at a time, cannot scan the library, and cannot delete, so it cannot provide this feature.

**How the data is handled:** Media is read on-device only. Nothing is uploaded, shared or stored off-device. Deletion always requires explicit user selection plus the system confirmation dialog.

**Video demo (required):** record ~30-60 s on a real device or emulator showing: (1) permission prompt, (2) tap "Scan my library", (3) the three result categories, (4) open Duplicates, select items, (5) tap Delete, (6) the Android system confirmation, (7) the success screen. Upload as an unlisted YouTube link.

## Data safety
- Collects or shares user data: **No** (all processing on device; local notifications are scheduled on the device and send nothing).
- Data encrypted in transit / deletion request: not applicable.
- Privacy policy URL: https://klenzer-privacy-krosz.vercel.app

## Other App content forms
- Ads: **No**. Target audience: **18+**, not designed for children. News app / government / financial / health: **No**.
- Content rating (IARC): Utility; no UGC, no violence, no purchases → expect **Everyone**.
- Permissions notice: `POST_NOTIFICATIONS` is optional and only requested if the user turns on reminders.
