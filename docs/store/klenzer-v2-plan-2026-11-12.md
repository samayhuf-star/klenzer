# Klenzer v2 plan (scan, speed, UI, delete)

**Basis:** `/workspace/7apps/klenzer` at `52b0724` (`klenzer/ios-submit-fixes`). Plan only; no code, commit, push, build, or ASC changes. Mobbin search was attempted but the connector requires a paid Mobbin plan, so UI notes below follow common AI Cleaner / Cleanup patterns, not live Mobbin screens.

Today `scanLibrary` (`src/lib/scanner.ts`) is one blocking pass: `getAssetsAsync` pages of 400 (cap 60k), then classify, then `getAssetInfoAsync` size measurement (8 workers, cap 4,000 per list). Progress is only `reading` | `measuring`. Duplicates are same pixel size + same capture second (not a perceptual hash). Results appear on Home only when the whole scan finishes. iOS already has Live Photos and a temp-cache row besides the three categories Samay named.

## 1. Split scan into sections

**Scope:** Home and the scan engine report **Photos** (exact duplicates + basic similar), **Screenshots**, and **Videos (large)** as three tracks, each with its own progress and results that can appear as soon as that track finishes. Keep Live Photos as a compact iOS-only secondary row, and temp files as a one-tap cache row, not a fourth equal scan track.

**Files:** `src/lib/scanner.ts` (split work, per-category progress callbacks), `src/lib/store.tsx` (partial `result` + per-kind progress), `src/app/index.tsx` (sectioned progress/results), `src/app/review/[kind].tsx`, `src/lib/kinds.ts`, `src/lib/reclaim.ts`, `src/components/ScanPulse.tsx`.

## 2. Faster scanning

**Scope:** Incremental / in-app “background” scan (continue after the first category paints; resume on next launch from cache). No iOS background-processing entitlement in this pass. Fetch assets in PHAsset pages (already `getAssetsAsync` → `getAssetsWithAfter` / `PHAsset.fetchAssets` in expo-media-library 57). Measure and hash only new or changed assets.

**Approach:**
- Exact dups first: `width` × `height` + creation time, confirmed with on-disk size when known (stronger than today’s key, still cheap).
- Basic similar only: **dHash** on a tiny thumbnail (~9×8 or 16×16), Hamming-distance bucket. Do not hash full-resolution images. Deeper similar-photo AI is out of scope.
- Size via `getAssetInfoAsync(..., { shouldDownloadFromNetwork: false })` only on cache miss. Never pull iCloud originals for measure or hash.
- **Cache:** `expo-sqlite` table keyed by `asset.id` + `modificationTime` (the Asset type already has this field; unused today). Store size, optional dHash, and subtype flags. Drop rows whose ids are gone. AsyncStorage stays for prefs only; it is the wrong store for tens of thousands of rows. MMKV is an alternative if we want lower overhead, also a native dep.

**Native:** No config plugin required for caching. A **small autolinked Expo native module** (e.g. `modules/klenzer-thumbs`) is recommended for `PHImageManager` thumbnails with `networkAccessAllowed = false` + in-native dHash. JS `ImageManipulator` is a fallback but will be slower and heavier on memory. The existing `plugins/withoutPushEntitlement.js` is unrelated.

## 3. UI upgrade

**Scope:** One visual pass so Home, scan progress, review, cleaning, and done feel closer to shipping cleaners: large storage hero, category cards with count + reclaimable bytes + a few preview thumbs, per-category progress (not one global bar), review grid with a clearer “keep” badge, sticky delete CTA, tighter type and motion. Stay inside the current Expo Router screens and `src/theme.ts`; no new product surfaces.

**Files:** `src/app/index.tsx`, `src/app/review/[kind].tsx`, `src/app/cleaning.tsx`, `src/app/done.tsx`, `src/theme.ts`, `src/components/*`.

## 4. Deletion

**Scope:** Remove every “go to Recently Deleted / empty it by hand” prompt. Keep a single system confirmation for the user’s selection.

**Already true in this build (do not regress):** `deleteItems` in `scanner.ts` already calls `MediaLibrary.deleteAssetsAsync(ids[])`. In installed `expo-media-library` ~57.0.5, `ios/MediaLibraryModule.swift` `deleteAssetsAsync` runs **one** `PHPhotoLibrary.shared().performChanges` and **one** `PHAssetChangeRequest.deleteAssets(fetched)` on the full id list. `store.tsx` `clean()` already flattens all selected media kinds into that one call. **No native module or config plugin is needed for batched delete.** Do not loop per asset.

**Copy/UX to change:** `src/app/index.tsx` pending notice, `src/app/done.tsx` (body, total, “Open Recently Deleted” button), `src/app/review/[kind].tsx` `barNote`, `src/lib/reminders.ts` pending notification, plus in-app privacy lines in `src/lib/privacy.ts` if they still instruct emptying the album. iOS still cannot let the app empty Recently Deleted; space on disk may lag. Count items as cleared, and optionally settle `pending` silently when free space later grows—do not send the user to Photos.

## Risks

- **Limited library (iOS 14+):** already surfaced (`access === 'limited'`, `presentPermissionsPickerAsync`). Cache and counts must reflect only visible assets, and the limited-access banner stays.
- **Permissions:** scan still no-ops until `granted` or `limited`.
- **Memory:** thumbnails only, small worker pool, do not retain 60k full Asset records longer than needed; keep the measure cap or stream by category.
- **iCloud-only assets:** size 0 today; hashing must also refuse network download or they will stall and use data.
- **Expo Go vs dev build:** this app already uses `expo-dev-client`. Expo Go cannot ship `expo-sqlite` or a custom hash module. Plan on a **dev-client / production build**, not Expo Go.

## Effort, builds, out of scope

About **8–12 engineering days** (split scan + progress ~2, cache + incremental + exact/dHash ~4–5, UI pass ~3, delete copy / pending ~0.5, plus a privacy note if the cache is persisted on device).

**EAS builds: one** (the production TestFlight build that includes sqlite and, if used, the thumbnail/hash module). No extra preview/EAS cycle in this plan.

**Out of scope until Samay picks extras:** similar photos beyond this basic dHash, a video compressor, swipe-to-clean, contacts merge, a storage dashboard.
