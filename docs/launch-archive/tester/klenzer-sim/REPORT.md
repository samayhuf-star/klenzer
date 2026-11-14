# Klenzer build 27 (final 1.1.0): root cause, fix, sim QA prep, IAP review notes
Written 13 Nov 2026, 2:10 AM BDT (UTC+6).

## Root cause: Duplicate and Blurry show 0 on Samay's iPhone (build 26, ab0de08)
Confirmed in code and reproduced in a unit test. This was not gating, not a crash and not a hang.
1. **Live Photos were never checked for Duplicate, Similar or Blurry.** `itemFromAsset` (src/lib/scan-pipeline.ts) puts every Live Photo into `liveItems`. Exact-duplicate grouping (`buildScanResult` -> `groupExact(input.photos)`), the Blurry filter, `blurTargets`, `exactCandidateItems` and `similarHashCandidates` all used `photos` only, meaning non-Live, non-screenshot stills. On a modern iPhone nearly every camera shot is a Live Photo; Samay has 7,253. So Duplicate and Blurry saw almost nothing, and Similar found only 12.
   - Reproduced: the new test `scripts/live-photo-scan.test.ts` builds an all-Live library with 5 exact pairs and 5 blurry shots. At ab0de08 it gets **0 duplicates**. With the fix it gets 5 duplicates and 5 blurry.
2. **Cards spun and said "None yet" together.** The Photos category is marked done only at the very end of the pipeline: per-asset sizing of the whole library, then hashing and blur. While it ran, `CatCard` showed the spinner plus "None yet" whenever the count was 0.
3. **Remaining limit, not changed:** assets that exist only in iCloud ("Optimize iPhone Storage") return no local file with `shouldDownloadFromNetwork: false`. They get no size, hash or blur value, so they can't join exact or blurry groups. This is by design (no iCloud downloads), and it can still keep counts lower than the true number on a cloud-optimized library.

## Fix: klenzer/features commit 43280e4 (on top of ab0de08)
- `src/lib/scan-logic.ts`: Duplicate and Blurry now cover regular photos plus Live Photos ("stills"). Live Photos are still listed on their own card too.
- `src/lib/scan-pipeline.ts`: the exact-duplicate candidates, the Similar hash targets and the Blurry targets now include Live Photos. Blur runs with 4 workers (was 2). Partial results were already emitted after every batch, and the test now checks that.
- `src/app/index.tsx` and `src/lib/format.ts` (`tileNote`): a card with 0 items during a scan shows "Scanning N%" instead of "None yet". "None yet" appears only once the scan has finished. No other copy or design changed, and Reduce Motion handling is untouched.
- Checks: typecheck PASS (`tsc --noEmit`), lint PASS (`expo lint`, no output), tests **83/83 PASS** (`npx tsx --test scripts/*.test.ts`; that's 81 existing plus 2 new).

## Task A: simulator workflow
- **main**: commit a04226b adds ONLY `.github/workflows/sim-qa.yml`. It's a generic Expo workflow, manual dispatch only, with inputs `ref`, `flow_script`, `prepare_script` and `bundle_id`. It runs on free macos-latest runners with ad-hoc simulator signing and no secrets.
- **klenzer/sim-qa** (branched from ab0de08, then merged with the fix 43280e4, head e8cb70b):
  - `qa/Klenzer.storekit` was already in ab0de08 and its ids match the code: com.krosz.klenzer.monthly $3.99 and com.krosz.klenzer.yearly $19.99 in group "Klenzer Pro", plus com.krosz.klenzer.lifetime $29.99 (non-consumable).
  - `qa/scripts/prepare-xcode-qa.rb` now wires that file into both the Run (LaunchAction) and Test (TestAction) parts of the scheme, and the UI test also loads it through SKTestSession with dialogs off.
  - `qa/sim-qa/prepare.sh` adds the UI test target.
  - `qa/sim-qa/flow.sh` seeds 400 photos (5 exact pairs, 5 blurry, 20 near pairs, 20 screenshots, the rest normal) and 10 contacts (3 duplicate groups), pre-grants Photos and Contacts, and runs `KlenzerQATests/SimQATests/testKlenzerFlow`.
  - The flow covers: launch, home mid-scan, home after scan, the Duplicate and Blurry counts (at least 5 each) with their review screens, Similar, Swipe, the Merge Contacts preview, Secret Album (PIN setup), the paywall prices, a StoreKit test monthly purchase leading to Plan: Pro, and Restore purchases.
- **Run**: https://github.com/samayhuf-star/klenzer/actions/runs/43296488457 (dispatched once at about 1:58 AM BDT, before the hold message). It **failed in about 20 s before any step ran: "The job was not started because your account is locked due to a billing issue."** It was not retried, and nothing has been triggered since.
- **Screenshots: none.** The job never started, so every flow step is **NOT RUN**. Nothing in this report is a simulator PASS.
- **Prices shown in the sim:** not observed. When the run happens, the simulator will show the StoreKit config prices ($3.99 / $19.99 / $29.99), not a live ASC fetch, so it can't prove the Paid Apps agreement is live. That still needs a sandbox check on a device.
- Re-run once billing is clear: `gh workflow run sim-qa.yml -R samayhuf-star/klenzer --ref main -f ref=klenzer/sim-qa -f flow_script=qa/sim-qa/flow.sh -f prepare_script=qa/sim-qa/prepare.sh`. Then download the artifact `sim-qa-klenzer` to this folder.
- Not done, per the hold: no EAS build, submit, TestFlight or version attach.

## Task B: IAP review notes (ASC app 6820685404), read back after the update
Only `reviewNote` was changed. Names, prices and states are unchanged (all READY_TO_SUBMIT). Raw before and after: iap-review-notes-before.json and iap-review-notes-after.json.

**Before (identical on all 3):** "Scanning is free. The paywall opens when you tap Fix now or any Clear/Delete button, and from Settings by tapping the Klenzer row (it shows Free scan until unlocked). Lifetime is pre-selected. Restore purchase is on the paywall and in Settings."
(This was stale: 1.1.0 has no Fix now button or Klenzer row, and Yearly is the default plan, not Lifetime.)

**After: shared text:** "Scanning and reviewing are free, with no account or sign-in. To reach the paywall from the Home screen, tap the Pro button at the top right, next to the Settings icon. The paywall also opens from Settings (the icon at the top right of Home) by tapping the Plan: Free row, when a free user goes past the 10 free items per day for deleting photos, merging contacts or adding to Secret Album (tap Upgrade in the alert), and when tapping Convert to still on Live Photos. On the paywall, [plan sentence] Yearly is selected by default. Restore Purchases: tap Restore purchase under the plans on the paywall, or tap Restore purchases in Settings."

Plan sentences:
- Monthly (6833133616): "tap the Monthly plan card, then tap the Unlock button below the plans to buy this monthly subscription."
- Yearly (6833884989): "keep the Yearly plan card selected, then tap the Unlock button below the plans to buy this yearly subscription."
- Lifetime (6829830806): "tap the Lifetime plan card, then tap the Unlock button below the plans to buy this one-time lifetime purchase."

---

## Update 13 Nov 2026, 2:30 PM BDT (UTC+6): iCloud thumbnails + sim run attempts

### iCloud thumbnail change (Samay via COO, 2:18 PM BDT)
- klenzer/features **b9fe1a8** (on 43280e4), cherry-picked to klenzer/sim-qa as **5661d7c** (on e8cb70b). Both pushed normally.
- iCloud-only originals (no local file) now get a small thumbnail through the existing LivePhotoConvert native module (`scanThumb`, new `modules/live-photo-convert/ios/ScanThumb.swift`): `PHImageManager.default().requestImage`, targetSize 256x256 (clamped 32 to 300), contentMode .aspectFit, `isNetworkAccessAllowed = true`, `deliveryMode = .fastFormat`, `resizeMode = .fast`, `isSynchronous = false`, `version = .current`. No full-size API.
- 10 s native timeout cancels the request; the JS side adds an outer guard (11 s). A failed, cancelled or slow fetch skips the photo, and the temp JPEG is deleted after hashing. Local originals use the same path as before.
- Checks: tsc PASS, expo lint PASS, tests **89/89** (83 + 6 new in `scripts/icloud-thumb.test.ts`), on both branches.
- This closes limit 3 above for hashing and blur only. iCloud-only photos still have no size (the store text "Photos stored only in iCloud are not measured" stays true).

### Sim run: BLOCKED, account billing lock still active (NOT RUN, no screenshots)
| Run | Runner | Result |
|---|---|---|
| https://github.com/samayhuf-star/klenzer/actions/runs/43393034311 (attempt 1) | macos-latest | failure in 3 s: "The job was not started because your account is locked due to a billing issue." |
| same run, attempt 2 (re-run) | macos-latest | same billing-lock error |
| https://github.com/samayhuf-star/klenzer/actions/runs/43393179497 (fresh dispatch) | macos-latest | same billing-lock error |
| https://github.com/samayhuf-star/klenzer/actions/runs/43393261306 | macos-15 | same billing-lock error |
| https://github.com/samayhuf-star/klenzer/actions/runs/43393320591 | macos-14 | cancelled: "The configuration 'macos-14-arm64-us-default' is not supported" (image retired) |

- To try other images, main got workflow-file-only commits a78942e (new `runner` choice input) and 060f5cd (dropped the retired macos-14). No app code on main.
- **Verdict: no verdict.** Nothing ran, so there are no screenshots and nothing here is a PASS.
- Not tried, needs Samay: (a) a public repo in Samay's own org AI-Samay or AI-Samay-1 (free-plan orgs bill apart from the locked user account, so they may run), running this workflow against a checkout of samayhuf-star/klenzer@klenzer/sim-qa; (b) Codemagic, Bitrise or similar free macOS CI (each needs a browser sign-up); (c) clearing the billing issue at github.com/settings/billing.

---

## Update 13 Nov 2026, 4:25 PM BDT (UTC+6): runs on the free org runner (AI-Samay/sim-qa-runner)
Runner repo: https://github.com/AI-Samay/sim-qa-runner (public, manual-only, no secrets; checks out the target public repo). Commits bd4027f, then a fix that checks the target is public using the run token.
Klenzer revert for the 7-day trial: **not needed** (the trial was never coded or committed).

### Run 43394696605 (klenzer/sim-qa @ 4761d19 = e8cb70b + 5661d7c iCloud thumbs + QA product-name fix): **FAIL (QA harness), with mixed app results**
https://github.com/AI-Samay/sim-qa-runner/actions/runs/43394696605. The job succeeded. The Release simulator build compiled, **including ScanThumb.swift** (no compile errors). XCUITest exit 0. Files are in `run-43394696605/sim-qa-43394696605/`.
- PASS: 01 launch (splash screen, then home), 05 Merge Contacts preview (group of 3, Chris Park), 06 Secret Album (PIN set, album open), 07 paywall ($19.99 yearly / $3.99 monthly / $29.99 lifetime from .storekit, **no trial copy**), 08 StoreKit monthly purchase leading to Plan: Pro, 09 Restore ("Restored" alert).
- FAIL: 02 home after scan, 22 Duplicate (0), 23 Blurry (0), 03 Similar (0), 04 Swipe not reached.
- **Cause (seen in `02-home.png`):** the system sheet "Klenzer is requesting additional access to your Photo Library" (Limit / Allow Full Access / Keep Add Only) sat over Home for the whole 300 s scan wait. The flow granted `photos` and then `photos-add`, which left add-only access. The XCUITest interruption monitor does not fire while the test only polls. So the scan never ran, and the zero counts say nothing about the app. `02a-home-mid-scan.png` shows "None yet" because no scan had started, so step 21 passed only because nothing was checked.
- Settings later showed "Full access" and "Klenzer 1.1.0 (25)". The sim branch app.json still says 25; build 27 comes from the EAS remote counter.
- Fix pushed (QA files only, klenzer/sim-qa **36308b1**): grant `photos` last in flow.sh, and tap SpringBoard "Allow Full Access" after Smart Clean and inside the scan wait loop.

### Run 43404323924 (klenzer/sim-qa @ 36308b1): **NO VERDICT, cancelled**
https://github.com/AI-Samay/sim-qa-runner/actions/runs/43404323924. "The run was canceled by @samayhuf-star" at 10:19 UTC (4:19 PM BDT), during "Build Release simulator app" (0 compile errors up to that point). The flow never ran and there are no screenshots. Only logs are in `run-43404323924/sim-qa-43404323924/` (prepare.log confirms PRODUCT_NAME=KlenzerQATests).

**Overall Klenzer sim verdict: not yet PASS.** Duplicate, Blurry, the scan finishing and "Scanning N%" mid-scan are still unproven in the sim. Handed over to Team Lead. No new runs, EAS builds or ASC/TestFlight writes were made.
