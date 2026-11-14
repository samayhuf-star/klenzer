# Klenzer iOS 1.1.0 (15) — submit gate

**Date:** 12 November 2026, Asia/Dhaka (UTC+6)  
**Method:** Read-only static check. No device run, Test Lab, IPA download, or edits. Code: `/workspace/7apps/klenzer` (also `/workspace/klenzer-ios-submit`) branch `klenzer/ios-submit-fixes` @ `3f1f8e5`. ASC listing from `klenzer-ios-asc-check-2026-11-12.md`. Legal/App Privacy from `klenzer-legal-and-app-privacy-2026-11-12.md`. Screenshots viewed at `/workspace/klenzer-store/screenshots/6.7/`.  
**Result:** **PASS**, with pre-submit steps and blockers (see Re-check 10:50). Original static FAIL is superseded by that re-check.

---

## Table

| Area | Result | Notes |
|---|---|---|
| (1) Listing placeholders / AI wording | **PASS** in ASC text and `store/listing.md` (no AI). | ASC privacy/support URLs are still the Vercel host (HTTP 402). Live legal pages have a placeholder date (issue 2–3). |
| (2) Screenshots (Guideline 2.3.3) | **FAIL** | All five 6.7" shots are 1290×2796 (correct size) but are marketing compositions: device frame, 9:41, and headlines that are not in the app. In-frame UI copy matches `3f1f8e5`. |
| (3) Paywall 3.1.1 / 3.1.2 (code) | **PASS** | `paywall.tsx` shows store `priceString` and term (lifetime vs monthly), monthly auto-renew/cancel copy, “Restore purchase”, and in-paywall Privacy + Terms (+ Support) links. Expected IDs `com.krosz.klenzer.lifetime` / `com.krosz.klenzer.monthly` match ASC; they are loaded from RevenueCat packages, not hard-coded. Entitlement `klenzer_pro`. |
| (4) Privacy 5.1.1 | **Partial** | Usage string and privacy manifest are in `app.json`. Legal-report App Privacy answers match the code (RC anonymous user ID + purchase history, no Device ID / tracking; photos stay on-device). Live privacy and terms are HTTP 200 and name **Samay Vashsht**, but still use `[EFFECTIVE DATE – LAUNCH DAY]`. ASC still points at the 402 URL. IPA not unpacked. |
| (5) README | **PASS** | `README.md` is present at `3f1f8e5`. |
| (6) Crash risks in code | **No obvious static crash** | Permission denied/limited have UI paths. `configurePurchases` no-ops without a key; null offerings show “Couldn’t load prices” / “Purchases aren’t available yet”. `hasPro` / restore / buy are guarded. Not device-tested. |
| (7) IAP review screenshot `6.7/02.png` | **Acceptable as a feature shot** | Duplicates review + “Delete 46 · 1.1 GB” is the paid clear action. ASC still has no IAP review screenshot (`MISSING_METADATA`). Prefer a frame-free crop of this UI. |

---

## Numbered issues

1. **P0 — Store screenshots fail Guideline 2.3.3.**  
   All five (`01` home, `02` Duplicates, `03` Screenshots, `04` Large videos, `05` All done) put the real UI inside an iPhone frame under marketing typography (“Free up space in minutes”, “Find duplicate photos fast”, etc.) and badges that are not in the app. In-frame labels and delete copy match `3f1f8e5`; thumbnails look like seeded illustrated stills.  
   **Fix:** Recapture or crop to the app UI only at 1290×2796. No device frame, no headline or badge outside the app.

2. **P0 — Live Privacy and Terms still have a placeholder date.**  
   `https://samayhuf-star.github.io/app-legal/klenzer/privacy.html` and `…/terms.html` (both HTTP 200, publisher Samay Vashsht): `Effective [EFFECTIVE DATE – LAUNCH DAY]`. (`[your name]` on Terms/Support is the “Settings › [your name] › Subscriptions” path, not a missing publisher.)  
   **Fix:** Put a real effective date on both pages and republish before submit.

3. **P0 — ASC privacy and support URLs still 402.**  
   ASC (morning check) has `https://klenzer-privacy-krosz.vercel.app` for both, which returns HTTP 402 / DEPLOYMENT_DISABLED. Code at `3f1f8e5` already uses `https://samayhuf-star.github.io/app-legal/klenzer/privacy.html` and `…/support.html` (200).  
   **Fix:** Point the App Store privacy policy and support URLs at those GitHub Pages links.

4. **P0 — IAP products are `MISSING_METADATA` and have no review screenshot in ASC.**  
   `com.krosz.klenzer.lifetime` ($14.99) and `com.krosz.klenzer.monthly` ($3.99). `02.png` is an acceptable feature shot of the purchasable delete flow; attach a frame-free crop and finish localization/review fields.  
   **Fix:** Complete IAP metadata in App Store Connect and attach the review screenshot.

5. **P1 — ASC still had build 12 attached; this gate is for 1.1.0 (15).**  
   **Fix:** Attach EAS build `741e35fa-2bf4-409b-9bdc-0143171252e9` (1.1.0 build 15) before submit.

6. **P2 — ASC listing is stale vs `store/listing.md`.**  
   ASC subtitle is “Storage or Space, File Cleaner” and keywords start with “storage, storage manager…”. The repo draft uses “Duplicate & Screenshot Cleaner” and a different keyword set. What’s New is empty. No AI wording in either.  
   **Fix:** Align ASC with the current listing draft if that is the intended copy; add What’s New for 1.1.0.

---

## Blockers (not FAILs)

- **Paid Apps agreement unsigned.** Paid products will not load in StoreKit until Samay signs it. Already flagged in the ASC check; not scored as a code/listing FAIL.
- **RevenueCat dashboard mapping unverified.** The paywall shows whatever lifetime/monthly packages are on the current offering. Confirm the dashboard maps those packages to `com.krosz.klenzer.lifetime` and `com.krosz.klenzer.monthly`, entitlement `klenzer_pro`.

This gate does **not** authorise a submit.

---

## Re-check 10:50 (Asia/Dhaka)

Read-only. Claims checked against the live ASC readout `/home/box/shared/app-monitor/reports/klenzer-ios-asc-live-2026-11-12.md` (read 10:47 AM Asia/Dhaka). Privacy and support URLs were curled once. Screenshots at `/workspace/klenzer-store/screenshots/6.7/` were re-judged against code at `3f1f8e5`. Device frames and caption text are allowed; a shot fails only if the UI inside the frame is not the real app, or a caption claims a feature the app lacks.

**Overall: PASS**, with the pre-submit steps and blockers below. No remaining P0/P1 product issues.

### Claim check (live readout)

| Claim | Verdict |
|---|---|
| Build 15 is attached | **Confirmed.** Version 1.1.0, build **15**, `processingState VALID`, not expired. The live readout does not print a git SHA; this re-check still treats `3f1f8e5` as the source for that build, as in the original gate brief. |
| Privacy and support URLs are on app-legal/klenzer and return 200 | **Confirmed.** ASC has `https://samayhuf-star.github.io/app-legal/klenzer/privacy.html` and `…/support.html`. This re-check: both **HTTP 200**, both name Samay Vashsht. Privacy still has `[EFFECTIVE DATE – LAUNCH DAY]` (pre-submit step, not a FAIL). |
| Both IAPs are READY_TO_SUBMIT with metadata and review screenshots | **Confirmed.** `com.krosz.klenzer.lifetime` ($14.99) and `com.krosz.klenzer.monthly` ($3.99), both `READY_TO_SUBMIT`, en-US name/description/review notes present, review screenshots `COMPLETE` at 1290×2796. |
| Subtitle, keywords, and description synced to `store/listing.md` | **Confirmed**, with one harmless trim: ASC subtitle is “Duplicate & Screenshot Cleaner”. Keywords match the draft except the trailing `tidy` (listing.md would be 103 characters; ASC is 98, under the 100-character cap). Description matches the app. What’s New is empty and is exempt on a first version. No AI wording. |

Previous issues **3, 4, and 5** (stale Vercel URLs, IAP `MISSING_METADATA`, build 12 attached) are **RESOLVED**. Previous issue **6** is **RESOLVED**.

### Screenshots (2.3.3, re-judged)

All five are 1290×2796. In-frame UI copy matches `3f1f8e5` (home hints, Duplicates “Best”/largest-file keep, Screenshots and Large videos help and “Select all”, All done Recently Deleted copy, delete CTAs). Numbers and layouts are producible by the app (including a seeded library of stylized stills). Captions describe features the app has. “We keep the best shot in every set” on `02` is looser than the in-app “largest file,” but it does not invent a feature.

| File | Screen | Result |
|---|---|---|
| `01.png` | Home | **PASS** |
| `02.png` | Duplicates (also acceptable as the IAP feature shot) | **PASS** |
| `03.png` | Screenshots | **PASS** |
| `04.png` | Large videos | **PASS** |
| `05.png` | All done | **PASS** |

No remaining screenshot FIX items.

### Pre-submit steps (not FAILs)

1. Set the effective date on the live Privacy and Terms pages to the submission day, then republish. They still show `[EFFECTIVE DATE – LAUNCH DAY]`.
2. Attach/submit with build 15 once the blockers below are cleared (already attached in ASC).

### Blockers (not FAILs)

- **Paid Apps agreement unsigned.** Every territory is `CANNOT_SELL` + `AVAILABLE_FOR_SALE_UNRELEASED_APP`. The unreleased flag is expected in `PREPARE_FOR_SUBMISSION`. `CANNOT_SELL` on all 175 territories is the live signal that paid items may not sell until Samay signs the Paid Apps agreement (tax/banking may also be involved). ASC agreement endpoints were not readable in the live readout.
- **RevenueCat `klenzer_pro` mapping unverified.** Still confirm the dashboard maps the current offering’s lifetime and monthly packages to `com.krosz.klenzer.lifetime` and `com.krosz.klenzer.monthly`.

This re-check does **not** authorise a submit until the date is set and the two blockers are cleared.
