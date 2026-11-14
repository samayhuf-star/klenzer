# Klenzer iOS simulator QA — 12 November 2026

All times are Asia/Dhaka (UTC+6).

Approved by Samay at 6:27 PM BDT (via COO, relayed by Monitoring). Later the same next-build also took Convert to still (6:32 PM), Photos/Videos grid order (6:33 PM), and the Recently Deleted sheet (6:34 PM).

## Blocker (stopped CI)

**The GitHub Actions macOS job never started.** Both runs failed in about 3 seconds with:

> The job was not started because your account is locked due to a billing issue.

The repo `samayhuf-star/klenzer` is **public** (`visibility: public`, `private: false`), so standard `macos-latest` minutes would normally be $0. The lock is at the **samayhuf-star account** level, so even a public-repo workflow cannot get a runner. There are no job steps, no artifacts, and no billable Actions minutes.

This Linux box has no iOS simulator, so the four QA gates, the Live Photo seed probe, Convert to still, and the requested screenshots could not be run here either.

Per the brief (stop early on Actions billing; never mark PASS for anything that was not run), CI was not retried beyond the second push, and **no EAS iOS production build was started**.

Unlocking billing on the samayhuf-star GitHub account is required before the workflow can run.

## Runs

### Run 1 — workflow only (build 23 code + harness)

- URL: https://github.com/samayhuf-star/klenzer/actions/runs/43219355718
- Event: push to `klenzer/v2`
- Workflow commit: `094b228e5859f19c1849a0f6f8dffd874b088a52` (“Add iOS simulator QA workflow.”)
- Parent: `a53ca89` (TestFlight build 23)
- Started: 6:35:51 PM Asia/Dhaka (2026-11-12T12:35:51Z)
- Job: Simulator QA, 3s, conclusion failure, 0 steps
- Actions minutes used: **0** (runner never assigned)
- Artifacts: **none** (upload step never ran)

### Run 2 — same workflow plus Convert / Photos card / RD sheet

- URL: https://github.com/samayhuf-star/klenzer/actions/runs/43220331090
- Event: push to `klenzer/v2`
- Head SHA: `d20c1cffd240968c9153f74e4d66968143cb2457` (“Add Convert to still, a Photos home card, and a Recently Deleted sheet.”)
- Started: 6:42:13 PM Asia/Dhaka (2026-11-12T12:42:13Z)
- Same billing lock, 3s, 0 steps, **0** Actions minutes, **no artifacts**

## Pass/fail per step (with timings)

None of these ran on a simulator. They are **not run**, not PASS, not a functional FAIL.

| Step | Result | Time | Detail |
| --- | --- | --- | --- |
| 1. Launch: no Apple ID or system prompt, home under 2s | **not run** | — | Job never started |
| 2. Scan: first results within 10s, then finishes | **not run** | — | Job never started |
| 3. Paywall shows yearly $19.99, monthly $3.99, lifetime $29.99 | **not run** | — | Job never started |
| 4. Test monthly purchase unlocks Pro | **not run** | — | Job never started |
| Live Photo seed probe (`simctl addmedia` paired HEIC+MOV) | **not run** | — | See below |
| Convert to still (date, location, favourite, album; originals gone; storage) | **not run** | — | Must not be marked PASS |
| Home grid screenshot | **not captured** | — | Path reserved below |
| Recently Deleted sheet screenshot | **not captured** | — | Path reserved below |

Artifact names expected once a run actually executes: `sim-qa-artifacts` (screenshots, `sim-qa.mp4`, xcodebuild logs, `results.json`, `live-photo-seed.md`). None were produced.

## Live Photo seeding (early check)

Research (Apple `simctl addmedia` usage and Live Photo pairing docs): `xcrun simctl addmedia` **can** import a Live Photo when the still and the MOV are passed in the **same** call and share Apple’s ContentIdentifier (still maker-note tag `0x0011` / `17`, movie `com.apple.quicktime.content.identifier`, plus a `still-image-time` track).

A generator (`qa/scripts/generate-live-photos.swift`) and a probe (`qa/scripts/probe-live-photo-seed.sh`) are in the repo and wired as a `continue-on-error` workflow step. They were **never executed**, because no macOS runner started. Until that probe (or PhotoKit in the app) observes a live playback style / `photoLive` subtype in the simulator library, Convert to still **cannot** be marked as tested.

Parts that can run once billing is unlocked: fixture generation on macOS, `addmedia` of the pair, Photos.sqlite / in-app Live Photos card check, then the Convert UI and PhotoKit change. Parts that cannot run today: all of the above.

## What landed on `klenzer/v2`

### Simulator QA harness — `094b228`

- `.github/workflows/sim-qa.yml`: `macos-latest`, `workflow_dispatch` + push to `klenzer/v2`, prebuild, Release `iphonesimulator` build, node_modules + Pods cache, `simctl addmedia` of ≥2,000 generated photos, privacy grants, `recordVideo`, XCUITest four gates, StoreKit Configuration via `xcodebuild -storeKitConfigurationPath` / scheme (CI post-prebuild script only; not an app resource, not an Expo plugin, does not affect EAS), artifacts + `$GITHUB_STEP_SUMMARY`. No secrets.
- Driver is XCUITest because a StoreKit Configuration file only attaches through `xcodebuild test`. Maestro flows are under `qa/maestro/` for local use.
- Minimal testIDs only (`home-screen`, `smart-clean`, `open-paywall`, `plan-*`, `unlock`, onboarding, `open-settings`). No behaviour change in that commit.

### Next-build features — `d20c1cf` (on top of the harness)

1. **Convert to still** (iOS PhotoKit module `modules/live-photo-convert`):
   - Primary action on the Live Photos screen; Delete is secondary.
   - Reads the `PHAssetResource` `.photo` data, creates a new asset with `PHAssetCreationRequest` using the photo resource only, sets `creationDate`, `location` and `isFavorite`, adds the still to the same user albums, and deletes the originals with `PHAssetChangeRequest.deleteAssets` in the **same** `performChanges` block.
   - Chunks of 250. A failed or cancelled chunk does not delete originals whose stills were not created. Remaining IDs are persisted for resume.
   - Estimated space saved is the sum of paired-video resource sizes. Copy is honest: originals go to Recently Deleted; space is freed after it is emptied, or after 30 days. One system confirmation per chunk. Needs full photo library access.
   - Converting uses the existing pulse animation; Reduce Motion shows a static ring and icon.
   - Gated like other clearing: Klenzer Pro. iPhone only.

2. **Home grid order** — the **Photos card was added** (it did not exist before). The existing **Videos** card (duplicate videos, already titled “Videos”) was moved to second. New order: Photos, Videos, Similar, Duplicates, Blurry, Screenshots, Large videos (if present), Live Photos (if present), Contacts (Coming soon) last. Photos shows all stills (regular + screenshots + Live Photos), count and size, largest first, same card style, distinct `image` icon, thumbnails, multi-select delete on the review screen with nothing selected by default.

3. **Recently Deleted sheet** after every iOS delete or convert (not after temp-only cleans). Copy: “{size} is in Recently Deleted. Empty it to free the space now.” Primary **Open Photos** uses `photos-redirect://` after `Linking.canOpenURL`, with `photos-redirect` in `LSApplicationQueriesSchemes`, and a graceful fallback alert if Photos cannot be opened. Steps: `Albums > Recently Deleted > Select > Delete All`. Secondary **Later**. **Don't show again** toggle, persisted as `klenzer.rdSheet.hide.v1`. The copy does not claim a deep link to Recently Deleted. This is the single post-clean note (not shown twice with Convert).

## Local checks that did run (Linux box, not the simulator)

- `tsc --noEmit`: pass
- `expo lint`: pass
- Unit tests: **29/29 pass** (including Photos-card sort, Recently Deleted copy with no ellipses and no claimed RD deep link, existing 30k scan stream, no-ellipsis scan of `src/`)

These do **not** stand in for the simulator gates, Convert verification, or visual screenshots.

## Screenshots (not captured)

Reserved paths, empty of images:

- `/home/box/shared/app-monitor/reports/klenzer-live-convert/home-grid.png` — **not captured**
- `/home/box/shared/app-monitor/reports/klenzer-live-convert/recently-deleted-sheet.png` — **not captured**

A note file is in that folder explaining why.

## EAS

**Not started.** The brief required the simulator Convert test (and the new screenshots) to actually run before an EAS production build, or to report what could not run. Nothing in that list ran. No krosz EAS build was queued, and no submission / ASC work was done.

Once GitHub billing is unlocked, re-run the workflow on `klenzer/v2` at `d20c1cf` (or later), take `home-grid.png` and `recently-deleted-sheet.png` from the artifacts, and only then start the one EAS iOS production build after confirming no other krosz build is in progress.

## SHAs

| What | SHA |
| --- | --- |
| Build 23 app code | `a53ca894264b43071d6fd3b09458b05e6e1906a0` |
| Workflow / first QA harness | `094b228e5859f19c1849a0f6f8dffd874b088a52` |
| Convert + Photos card + RD sheet (current `klenzer/v2`) | `d20c1cffd240968c9153f74e4d66968143cb2457` |
