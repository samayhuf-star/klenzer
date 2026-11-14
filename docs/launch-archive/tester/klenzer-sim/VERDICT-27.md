# Klenzer build 27 — simulator + read-only presubmission verdict

Written 13 November 2026, 3:59 PM Asia/Dhaka (BDT, UTC+6).
Scope: review of the finished simulator run and a live, GET-only App Store Connect readout. No EAS build, no ASC writes, no submission, no messages to other bots.

**Overall: FAIL. Do not submit build 27.**

Primary blocker: the simulator run never produced non-zero Duplicate, Similar or Blurry results, because a Photos “additional access” prompt blocked the scan. The scan-fix SHA was in the binary, but the flow did not grant Full Access in time, so criterion 2 is not evidenced.

---

## What was tested

| Item | Value |
|---|---|
| App | Klenzer (ASC `6820685404`, bundle `com.krosz.klenzer`) |
| Features branch (app code) | `klenzer/features` **b9fe1a832940e6c7961f0c8230261d06e66a2e9a** (iCloud thumbnail-only fetch on top of 43280e4) |
| Sim branch checked out | `klenzer/sim-qa` **4761d19d6a8edf85357dd33f81b51b13a4268635** |
| Relation to 5661d7c | 4761d19 is 5661d7c (cherry-pick of b9fe1a8) plus a QA-only commit that names the UI test product. No app source change. |
| Not in this run | **36308b1162c0b12c07edd549a3985ea48a8aca54** (“Grant full Photos access last and tap Allow Full Access…”), committed 3:48 PM BDT, after this run had already started |
| Runner | AI-Samay/sim-qa-runner, workflow `sim-qa.yml`, run **43394696605** (success, 1h09m). Started 2:37 PM BDT, finished 3:47 PM BDT. |
| Artifact | `/home/box/shared/app-monitor/reports/tester/klenzer-sim/run-43394696605/sim-qa-43394696605/` |
| Seed | 400 photos, 10 contacts (`seed.txt`) |
| Sim binary version shown | Klenzer 1.1.0 **(25)** in Settings. EAS build 27 has not been created. |
| xcodebuild | test exit 0, but that only means the XCTest case did not XCTAssert the failed steps. `results.json` and the screenshots are the source of truth. |

**Exact SHA tested: `4761d19d6a8edf85357dd33f81b51b13a4268635`.**

### Second run 43404323924

Still **in progress** as of 3:59 PM BDT (job was on “Build Release simulator app”). It was dispatched at 3:48 PM BDT and almost certainly includes 36308b11 (current `klenzer/sim-qa` HEAD). Per the 10-minute cap this verdict is based on run 43394696605 only. No artifact was downloaded for 43404323924.

`REPORT.md` in this folder is older (last update 2:30 PM BDT) and predates both successful runner jobs. It is not used as a pass/fail source.

---

## SIM verdict

**SIM: FAIL** (criterion 2).

### 1. Launch without a crash — PASS

- `01-launch.png`: splash with the K logo, no crash UI.
- Test step 1 PASS: “home shown directly”.
- `app.log`: no Fatal Exception / SIGABRT / “Terminating app due to uncaught exception” / panic.

### 2. Duplicate, Similar and Blurry show non-zero (or partial) results; never a final “0 None yet” when seeded items exist — FAIL

400 photos were seeded (including 5 exact pairs and 5 blurry). The cards never showed a non-zero count, and the scan never finished.

- `02a-home-mid-scan.png`: Similar, Duplicate, Blurry and Screenshots all read **“0 None yet”**. No “Scanning N%”. Ready-to-review still says “Scan to see”.
- `02-home.png`, `02b-duplicate.png`, `02c-blurry.png`, `03-similar.png`: the system dialog “Klenzer is requesting additional access to your Photo Library” (406 Photos, Limit Access / Allow Full Access / Keep Add Only) is on top of Home. The UI test found the tiles as “Duplicate, 0 items”, “Blurry, 0 items”, “Similar, 0 items” and did not open the review screens.
- `04-swipe.png`: “Scan your library first” / “Scan now” — swipe was not reached with a scanned library.
- `results.json`: Home after scan FAIL (`scanFinished=false firstNonZero=none`); Duplicate FAIL (`count=0 min=5`); Blurry FAIL (`count=0 min=5`); Similar FAIL (`zero items, not opened`).

Root cause of this run: Full Photos access was not granted before the scan checks. A later QA-only commit (36308b11, not in this SHA) changes the flow to tap Allow Full Access. That is unproven until run 43404323924 (or a later run) finishes and the screenshots are reviewed.

The mid-scan step in `results.json` is marked PASS (`scanningNote=false noneYetWhileScanning=false`) only because the test did not treat a scan as in progress. The screenshot still shows “0 None yet” with seeded items present, which fails this criterion.

### 3. Paywall prices $3.99 / $19.99 / $29.99, with no trial text — PASS

- `07-paywall.png`: Yearly **$19.99** (selected, “BEST VALUE”), Monthly **$3.99**, Lifetime **$29.99**. Copy: “Scanning is free. Unlock Klenzer to clear what it finds.” Auto-renew disclosure at the bottom. No “7 days free”, “free trial”, or similar.
- `08-paywall-monthly-selected.png`: Monthly selected at **$3.99**, same three prices, still no trial text.
- Test step 7 PASS: `yearly $19.99=true monthly $3.99=true lifetime $29.99=true unavailable=false`.

### 4. StoreKit test purchase and Restore — PASS

- `08-purchase-settings.png`: Settings shows **Plan: Pro** after the monthly StoreKit test purchase. Photo access later reads “Full access” (granted after the scan checks had already failed).
- `09-restore.png`: alert **“Restored”** / “Klenzer is unlocked on this device.”
- Test steps 8 and 9 PASS (`session=true paywallClosed=true; Settings shows Plan: Pro`; `alert: Restored`).

### 5. No debug or placeholder text — PASS (with notes)

Inspected screens: launch, mid-scan home, paywall, Settings, Restore, Merge Contacts, Secret Album, Swipe. No lorem, TODO, Test, paywall debug line, dummy prices, or default Expo chrome.

Notes, not fails for this criterion:

- Merge preview uses the seeded fixture `chris.park@example.com` (test contacts, not shipping copy).
- Settings footer is “Klenzer 1.1.0 (25)”. Expected until an EAS build 27 exists.

Other flow screens that did work (not in the five SIM criteria, recorded for completeness): Merge Contacts preview PASS (`05-contacts-list.png`, `05-contacts-preview.png`); Secret Album PIN + empty album PASS (`06-secret-album-pin.png`, `06-secret-album-confirm.png`, `06-secret-album.png`).

---

## CHECKLIST verdict (live ASC, read-only, 3:56–3:58 PM BDT)

Version id: **`ae1fd46c-a8c2-427f-a487-0da13e20c39c`** (1.1.0, iOS, `PREPARE_FOR_SUBMISSION`). Copyright: 2026 Samay Vashsht. Release type currently `AFTER_APPROVAL` (not changed this turn). Attached build is still **26** (`d47de19b-857f-4fa1-a66b-5a7c77c57a2d`, VALID, `usesNonExemptEncryption: false`). Build 27 does not exist in ASC.

**CHECKLIST: FAIL**, because the live Terms of Use page still has a placeholder effective date, and App Privacy’s published state cannot be confirmed via the API.

### Version metadata — PASS, with two notes

- en-US name: Klenzer: Phone Storage Cleaner. Subtitle: Duplicate & Screenshot Cleaner.
- Description, keywords and promotional text are present and within normal limits.
- Support URL: https://samayhuf-star.github.io/app-legal/klenzer/support.html — HTTP 200.
- Privacy URL (app info localization): https://samayhuf-star.github.io/app-legal/klenzer/privacy.html — HTTP 200, “Effective 12 November 2026.”
- Copyright: 2026 Samay Vashsht.
- Screenshots present and COMPLETE for the required iPhone sizes: APP_IPHONE_67, 7×1320×2868; APP_IPHONE_65, 7×1284×2778. No iPad sets (app is iPhone).
- Notes (not metadata fails): What’s New is empty (only iOS version on this app is 1.1.0, still unreleased, so this is acceptable). The listing description links Terms of Use; that page’s placeholder is scored below, not here.

### Review contact — PASS

`appStoreReviewDetails` `e99443ac-…`: **Samay Vashsht**, samayhuf@gmail.com, [phone redacted]. Demo account not required. Review notes are present and describe Photos access, the Pro button path, Restore, Contacts, Face ID and free vs Pro.

### IAPs — PASS

| ID | Product | Period / type | US price | State | Intro offers | Review screenshot | Review notes |
|---|---|---|---|---|---|---|---|
| 6833133616 | com.krosz.klenzer.monthly | ONE_MONTH | **$3.99** | READY_TO_SUBMIT | **0** | COMPLETE, 1290×2796 | Present, monthly plan sentence |
| 6833884989 | com.krosz.klenzer.yearly | ONE_YEAR | **$19.99** | READY_TO_SUBMIT | **0** | COMPLETE, 1290×2796 | Present, yearly plan sentence |
| 6829830806 | com.krosz.klenzer.lifetime | NON_CONSUMABLE | **$29.99** (current USA manual price) | READY_TO_SUBMIT | n/a | COMPLETE, 1290×2796 | Present, lifetime plan sentence |

No introductory offers on either subscription. Prices match the approved Klenzer set (unchanged: $3.99 / $19.99 / $29.99, no trial).

### App Privacy — UNVERIFIED (possible submission blocker)

Every nutrition-label / data-usage path probed returned 404 PATH_ERROR or NOT_FOUND (`appDataUsages`, `appPrivacy`, `privacyDetails`, `dataUsage`, `nutritionLabel`, and v2 variants). The public ASC API still cannot say whether the declaration is saved or **published**.

Prior web report (COO, 13 Nov 2026, 12:23 AM BDT): already “Data Not Collected” in the ASC web UI. That was not independently re-read this turn. **Confirm in the ASC web UI that App Privacy is published before any submit.** If it is only saved and not published, Apple will block submission.

### Age rating, export compliance, content rights — PASS

- Age rating declaration `6af1a0db-…`: **FOUR_PLUS**. All standard questions NONE or false, including `medicalOrTreatmentInformation: NONE` and `healthOrWellnessTopics: false`.
- Export compliance: attached build 26 has `usesNonExemptEncryption: false`. (Build 27 is not uploaded yet; the same flag must be set on that build.)
- `contentRightsDeclaration`: **DOES_NOT_USE_THIRD_PARTY_CONTENT**.

### Listing: no AI, no medical claims — PASS

Live en-US description, keywords, promotional text and subtitle were scanned. No matches for AI / A.I. / artificial intelligence / machine learning / GPT, or medical / diagnosis / treatment / health / HIPAA / therapy.

### Other checklist / P0 note — FAIL (placeholder on Terms)

https://samayhuf-star.github.io/app-legal/klenzer/terms.html is live (HTTP 200) and is linked from the App Store description. The page still opens with **“Effective [EFFECTIVE DATE – LAUNCH DAY].”** Privacy was updated to a real date; Terms was not. This is placeholder text in a listing-linked legal page (qa-checklist P0 #2).

---

## Submission blockers

1. **SIM criterion 2 FAIL.** Run 43394696605 at SHA `4761d19d6a8edf85357dd33f81b51b13a4268635` never showed non-zero Duplicate, Similar or Blurry results. Seeded library was 400 photos; cards stayed at “0 None yet”; the Photos additional-access dialog sat on Home during the scan checks. Do not build or submit 27 until a later sim run (likely 43404323924 at 36308b11, once it finishes) shows non-zero card counts and no final “0 None yet”.
2. **App Privacy published state not confirmed via API.** Check the ASC web UI and publish if needed (intended answer: Data Not Collected).
3. **Terms of Use placeholder date** still live on the page linked from the listing. Replace `[EFFECTIVE DATE – LAUNCH DAY]` with a real date before submit.

No EAS, ASC write, or submit was performed.
