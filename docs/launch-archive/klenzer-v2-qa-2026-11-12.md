# Klenzer v2 (iOS) — static QA, build 18

**Date:** 12 November 2026, 4:15 PM Asia/Dhaka (UTC+6)  
**Method:** Read-only static review at `/workspace/7apps/klenzer` commit `02c024c` (`klenzer/v2`). No app edits, no pushes, no App Store Connect changes, no device or Test Lab run. Scope: `klenzer-v2-build-2026-11-12.md`.  
**Build under test:** 1.1.0 (18), EAS `91f56420`, ASC `1884eeb8-18b0-46bb-b1e4-606e996e0d8f` (IN_BETA_TESTING).  
**Verdict:** **PASS pending device checks.**

Spot-check: `app.json` version is **1.1.0**. There is no `ios.buildNumber` in the repo (`eas.json` uses `appVersionSource: remote` and production `autoIncrement`; build 18 comes from EAS). Photo-library usage string is set on the `expo-media-library` plugin (`app.json:89`). Notifications: `expo-notifications` is present with `enableBackgroundRemoteNotifications: false`; iOS has no custom Info.plist notification usage key (the system prompt is used, which is normal).

---

## Item results

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Split scans + per-category progress + cached rescan | **PASS** (speed **NEEDS DEVICE**) | `scanner.ts` runs Screenshots, Videos, then Photos tracks and reports `onProgress` / `onCategory` (`scanner.ts:252–306`). Home spins Similar/Duplicate/Blurry until `scanCats.photos` is done, Screenshots and Videos independently (`index.tsx:62–64, 137–186`). Cache is SQLite keyed by asset id + `modificationTime` (`scan-cache.ts:19–36`, `scanner.ts:94–103`). |
| 2 | Smart Clean | **PASS** | `index.tsx:38–58`: no result → `scan()`; else `startClean` of default **duplicate + similar extras** only (matches the scope). Empty plan alerts the user. |
| 3 | Batched delete; no “Recently Deleted” UI | **PASS** for the delete path; see issue 1 | `clean()` flats all media into one `deleteItems(all)` (`store.tsx:336–341`). `deleteItems` is a single `MediaLibrary.deleteAssetsAsync(ids[])` (`scanner.ts:356–359`). Review/done/home have no “Recently Deleted” / “Open Recently Deleted” copy (review footnote: “Your iPhone will ask you to confirm before anything is deleted.” `review/[kind].tsx:148–151`; done: “removed from your library.” `done.tsx:48–51`). |
| 4 | 3-day reminder, late permission, Settings toggle, tap-to-scan | **PASS** (prompt timing and tap **NEEDS DEVICE**) | After a successful first scan, `askAboutReminders` runs once (`store.tsx:230–264`). OS permission is requested only in `enableReminders` when the user taps “Yes, remind me” (`reminders.ts:99–105`) — not on launch or notification tap (`store.tsx:287`). Interval is `3 * 24 * 60 * 60` with `data.action = 'scan'` (`reminders.ts:15, 68–78`). Settings “Cleanup reminders” `Switch` calls `setReminders` and cancels on off (`settings.tsx:55–58`, `reminders.ts:116–120`). Tap listener starts `scan()` (`store.tsx:287–292`). |
| 5 | Paywall prices, IDs, restore, paywall-on | **PASS** (localized prices / sandbox buy **NEEDS DEVICE**) | Prices are `product.priceString` only — no hardcoded `$` in `src` (`purchases.ts:11–12, 86–90`; `paywall.tsx:136–137, 183`). Entitlement `klenzer_pro` (`config.ts:13`). Products `com.krosz.klenzer.lifetime` / `.monthly` used to pick packages (`purchases.ts:11–12, 62–74`). “Restore purchase” on the paywall and in Settings (`paywall.tsx:143–144`, `settings.tsx:51`). `startClean` always opens `/paywall` unless `isPro` (`store.tsx:400–414`). Smart Clean and review `doDelete` both go through `startClean`. |
| 6 | Contacts and Compress “Coming soon”, not functional | **PASS** | Both call `comingSoon(...)` → `Alert.alert(label, 'Coming soon.')` (`index.tsx:60, 188–216`). Contacts segment and Compress card/tab show a **COMING SOON** pill; neither starts a scan or edit flow. |

---

## Numbered issues

1. **P2 — In-app privacy copy still mentions “Recently Deleted”.**  
   `src/lib/privacy.ts:22`: “On iPhone, deleted items go to Recently Deleted, where you can restore them for up to 30 days.” The product screens no longer say this. `store/listing.md` still describes emptying Recently Deleted, but that is store copy, not the app UI.  
   **Fix:** Drop or rephrase that sentence in the in-app privacy text (and the listing, if it should match v2) so it does not mention Recently Deleted, if that remains a hard rule.

No P0 or P1 issues from this static review.

---

## Samay phone checklist (TestFlight build 18)

Install from TestFlight, grant photo access (full library if possible), then:

1. Run a **first scan** and confirm Photos, Screenshots, and Videos each show their own progress, with category cards filling as each track finishes.
2. Run a **second scan** and confirm it is clearly faster (cache hit).
3. Tap **Smart Clean** (after a scan) and confirm it targets duplicate + similar extras and is paywall-gated if unlocked is off.
4. Delete several items (or Smart Clean) and confirm **one** iOS system confirmation, and that no screen says “Recently Deleted” or tells you to empty it.
5. Confirm the **reminder permission prompt appears only after the first scan completes** (after you accept “Yes, remind me”), not at launch.
6. Flip the Settings **Cleanup reminders** toggle (on schedules, off cancels).
7. If feasible, trigger or wait for a test reminder and confirm a tap opens the app and starts a scan.
8. Open the paywall and confirm **localized store prices** (not a hardcoded `$14.99` / `$3.99` string).
9. Sandbox **buy**, **restore**, and unlock persistence (`klenzer_pro`).
10. Confirm **Contacts** and **Compress** only show Coming soon and do nothing else.

This review does **not** authorise a store submit.

## Verdict update (16:18 BDT): FAIL
Samay's device test overrides the static PASS (screenshots in klenzer-b18-feedback/):
2. P0: On a large library (186.6 GB, Full access), the Home scan hangs at about 60%. All categories stay at 0, with spinners and lime placeholder thumbnails after about 1 minute.
3. P0: Settings "Space freed" shows 22.4 GB on a fresh install. It must show 0 or be hidden, and grow only by bytes actually deleted.
4. P1: The Settings plan label is wrong ("Klenzer: Free scan").

## Added checks for build 18 and next (large-library timed run on Samay's phone)
Before you start, note the library size from Settings > General > iPhone Storage > Photos. Fresh install, Full access.
A. Start a stopwatch when you tap Scan. Note the time until the first real count or size shows (target under 10 s).
B. Progress moves at least every 5 s. Note any stall over 10 s and the % where it happened.
C. The scan finishes. Note the total time and whether every category shows a real count and size.
D. The thumbnails are real photos, not lime placeholders.
E. Settings "Space freed" shows 0 or is hidden on a fresh install. After deleting N items it grows by about their size.
F. The Settings plan label matches the real entitlement (Free or Pro).
G. Rescan immediately after. It should be clearly faster.
H. Background the app for 10 s mid-scan, then return. The scan resumes or finishes.
Report: a screen recording plus the times for A–C.

5. **P0:** The paywall shows **“Couldn’t load prices”** on TestFlight (`klenzer-b18-feedback/paywall.jpg`, 3:55 PM). Restore / Terms / Privacy / Support are visible; no plan cards or store prices loaded.
6. **P1:** The same paywall hero says **“Free 852 MB now”** (“That is what Klenzer found on your phone”) while Home cards are still **0 MB** with placeholder thumbs (`home.jpg`). The header MB does not match the scan results on screen.
