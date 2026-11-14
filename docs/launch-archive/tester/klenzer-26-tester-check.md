# Klenzer 1.1.0 build 26 — independent tester check

- **Verdict (excluding the pending simulator run):** **NOT READY**
- **Read at:** 13 Nov 2026, 1:37–1:41 AM Asia/Dhaka (BDT). ASC GETs started 2026-11-12T19:37:17Z.
- **Scope:** Read-only. Live App Store Connect API GETs plus HTTP GETs of the hosted legal pages, a read-only `app.json` fetch from `samayhuf-star/klenzer` @ `ab0de08`, and read-only GitHub Actions lookups. No PATCH/POST/DELETE, no builds, no App Review submission, no commits, no workflow triggers.
- **App:** ASC `6820685404`, bundle `com.krosz.klenzer`, name **Klenzer: Phone Storage Cleaner**.
- **Version:** 1.1.0, id `ae1fd46c-a8c2-427f-a487-0da13e20c39c`.
- **Build:** 26, ASC id `d47de19b-857f-4fa1-a66b-5a7c77c57a2d`.
- **Checked against:** `presubmission-audit-2026-11-12.md` (checklist + Klenzer section), `klenzer-26/FINAL.md`, and `klenzer-26/planned-asc-changes.md`.
- **Not printed:** ASC key material, JWT, and the review contact phone (present; redacted).

ASC listing and product metadata for items 1–11 are in good shape. The version is not ready to submit because the Paid Apps agreement cannot be confirmed Active, and build 26 has not been QA'd (TestFlight still says NOT RUN; Samay's device still has build 25). The iOS simulator run is pending and is excluded from this verdict, as requested.

---

## 1. Version and attached build — PASS

Live `GET /v1/appStoreVersions/ae1fd46c-a8c2-427f-a487-0da13e20c39c`:

- `versionString` **1.1.0**, platform `IOS`
- `appStoreState` **PREPARE_FOR_SUBMISSION**
- `appVersionState` **PREPARE_FOR_SUBMISSION**
- `releaseType` `AFTER_APPROVAL`
- `reviewType` `APP_STORE`
- This is the only iOS App Store version on the app.

Live `GET .../appStoreVersions/{id}/build` and `GET /v1/builds/d47de19b-857f-4fa1-a66b-5a7c77c57a2d` agree:

- Attached build id **`d47de19b-857f-4fa1-a66b-5a7c77c57a2d`**, version **26**
- `processingState` **VALID**
- `usesNonExemptEncryption` **false**
- `expired` **false**
- `buildAudienceType` `APP_STORE_ELIGIBLE`
- `minOsVersion` 16.4
- Uploaded 12 Nov 2026, 11:00:27 PM Asia/Dhaka (BDT) (source `2026-11-12T09:00:27-08:00`)
- Expires 10 Feb 2027, 11:00:27 PM Asia/Dhaka (BDT) (source `2027-02-10T09:00:27-08:00`)
- Pre-release version relationship: 1.1.0 / IOS
- Beta detail: `internalBuildState` **IN_BETA_TESTING**, `externalBuildState` `READY_FOR_BETA_SUBMISSION` (no external group has this build)

Matches FINAL.md. Build 15 is no longer attached.

---

## 2. Localization — PASS

One localization only: **en-US**, id `b7019074-6dba-42cb-a16e-3fd9ba214bad`. No other locales.

| Field | Live value | Notes |
|---|---|---|
| description | 2,852 chars | Exact match of the approved text in `planned-asc-changes.md` |
| promotionalText | 156 chars | Exact match |
| keywords | 99 chars | Exact match: `duplicate,similar,photo cleaner,screenshots,videos,storage,merge contacts,secret album,blurry,swipe` |
| whatsNew | **null** | Not required: 1.1.0 has never been released (`PREPARE_FOR_SUBMISSION` is the only version) |
| supportUrl | `https://samayhuf-star.github.io/app-legal/klenzer/support.html` | HTTP **200** (5,387 bytes; title "Support — Klenzer") |
| marketingUrl | **null** | Optional; not a block |

Grep of description, promotional text, keywords, What's New (empty), support URL, and review notes:

- RevenueCat: none
- Compress / compress: none
- Word-boundary `AI`: none
- Ellipsis character (U+2026): none
- "Coming soon": none
- lorem / ipsum / TODO / FIXME / placeholder / TBD: none
- Hard-coded prices (`$…`, USD/INR/EUR/GBP amounts): none. The description says "Prices are shown in the app."

Terms URL inside the description (`https://samayhuf-star.github.io/app-legal/klenzer/terms.html`) also returns HTTP **200**.

---

## 3. App info, name, subtitle, privacy policy — PASS

App attributes + `appInfoLocalizations` en-US id `abcbe24b-3f12-4d80-8cd6-2dd4a800cbcb`:

- Name: **Klenzer: Phone Storage Cleaner** (30 characters)
- Subtitle: **Duplicate & Screenshot Cleaner** (30 characters)
- `privacyPolicyUrl`: `https://samayhuf-star.github.io/app-legal/klenzer/privacy.html`
- `primaryLocale`: en-US
- `bundleId`: `com.krosz.klenzer`

Live privacy page: HTTP **200**, 9,157 bytes. Headings include **Contacts**, **Secret Album and Face ID**, **Photos and videos**, and **Free daily limit**. Counts (case-insensitive): Contacts 11, Face ID 3, Photos 17, Secret Album 11, RevenueCat **0**. The stale "does not ask for location, camera, contacts, or tracking permission" sentence is **gone**. Purchases are described as handled by the Apple App Store or Google Play, with no third-party purchase SDK.

---

## 4. Age rating — PASS

`GET /v1/appStoreVersions/{id}/ageRatingDeclaration` is 404 (`PATH_ERROR`: that relationship does not exist). The declaration is on the app info.

`GET /v1/appInfos/6af1a0db-4f30-4457-a971-128d45318be7/ageRatingDeclaration` returned the declaration (same id). `appStoreAgeRating` on the app info is **FOUR_PLUS**.

Every content descriptor is `NONE` or `false`:

- `alcoholTobaccoOrDrugUseOrReferences`, `contests`, `gamblingSimulated`, `gunsOrOtherWeapons`, `medicalOrTreatmentInformation`, `profanityOrCrudeHumor`, `sexualContentGraphicAndNudity`, `sexualContentOrNudity`, `horrorOrFearThemes`, `matureOrSuggestiveThemes`, `violenceCartoonOrFantasy`, `violenceRealisticProlongedGraphicOrSadistic`, `violenceRealistic`: **NONE**
- `advertising`, `gambling`, `healthOrWellnessTopics`, `lootBox`, `messagingAndChat`, `parentalControls`, `ageAssurance`, `socialMedia`, `socialMediaAgeRestricted`, `unrestrictedWebAccess`, `userGeneratedContent`: **false**
- `ageRatingOverride` / `ageRatingOverrideV2` / `koreaAgeRatingOverride`: **NONE**
- `kidsAgeBand`: null

Brazil is `L` / `SELF_RATED_L`, which fits 4+.

---

## 5. Screenshots — PASS

Only en-US has screenshot sets. No other display types are present (no iPad, no 5.5", no leftover 1290×2796 APP_IPHONE_67 shots). No preview (video) sets.

| Set | Type | Count | Size | `assetDeliveryState` |
|---|---|---:|---|---|
| `777d434c-ee88-4ba5-a49b-477df6096774` | **APP_IPHONE_67** (6.9" / 6.7" slot) | 7 | 1320×2868 | all **COMPLETE** |
| `2d731ebb-a507-46c6-8732-b6deccf0052a` | **APP_IPHONE_65** | 7 | 1284×2778 | all **COMPLETE** |

Filenames follow the approved caption order: 01-home, 02-similar, 03-swipe, 04-contacts-preview, 05-secret, 06-duplicates, 07-videos. Matches FINAL.md (Apple documents 1320×2868 as a valid APP_IPHONE_67 size; there is no APP_IPHONE_69 type).

---

## 6. Review details — PASS

`appStoreReviewDetails` (`GET /v1/appStoreVersions/{id}/appStoreReviewDetail`):

- Contact first name: Samay
- Contact last name: **Vashsht**
- Contact email: samayhuf@gmail.com
- Contact phone: **present** (not printed)
- `demoAccountRequired`: **false** (correct: no login)
- `demoAccountName` / `demoAccountPassword`: null
- Notes: **present**, 3,138 characters, exact match of the body of `klenzer-26/review-notes.md` (the file's markdown header is not in ASC, as expected)
- Review attachments: 0 (none required)

Notes have no RevenueCat, Compress, "AI", ellipsis, or "Coming soon". They describe Photos, Contacts, Face ID, Secret Album, Convert to still, the 10/day limit, StoreKit 2, and Restore.

---

## 7. Subscriptions and IAPs — PASS (metadata); prices readable

None are `MISSING_METADATA`. All three products are **READY_TO_SUBMIT**, have en-US display names and descriptions, review notes, a COMPLETE review screenshot (1290×2796), and availability in **175 / 175** territories with `availableInNewTerritories: true`. They can go with the first version submission.

| Product | Type | State | USA customer price | Notes |
|---|---|---|---|---|
| `com.krosz.klenzer.lifetime` (`6829830806`) | NON_CONSUMABLE | READY_TO_SUBMIT | **$29.99** (proceeds $25.49) | Base territory USA; 1 manual price (USA) + 174 automatic. Samples: GBR 29.99 GBP, DEU/FRA 34.99 EUR, IND 2999 INR. |
| `com.krosz.klenzer.monthly` (`6833133616`) | Auto-renew, `ONE_MONTH`, group level 2 | READY_TO_SUBMIT | **$3.99** (proceeds $3.39) | 175 current prices. Samples: GBR 3.99 GBP, DEU/FRA 3.99 EUR, IND 399 INR. |
| `com.krosz.klenzer.yearly` (`6833884989`) | Auto-renew, `ONE_YEAR`, group level 1 | READY_TO_SUBMIT | **$19.99** (proceeds $16.99) | 175 current prices. Samples: GBR 19.99 GBP, DEU/FRA 22.99 EUR, IND 1999 INR. |

Subscription group **Klenzer Pro** (`22565864`), en-US group name "Klenzer Pro", group localization state `PREPARE_FOR_SUBMISSION` (normal before first submit).

The listing does not name dollar amounts, so there is no price-copy mismatch. Note: an earlier 12 Nov 2026 pricing report had lifetime USA at $14.99; the **live** USA lifetime price is **$29.99**. Report the live figure.

IAP review notes still say the paywall opens from "Fix now" / a "Klenzer row" and that "Lifetime is pre-selected". Version review notes now say to tap the dark "Pro" button. That is stale IAP-note wording, not `MISSING_METADATA`, and is not marked as a submission-blocking FAIL.

---

## 8. App Privacy — not readable via API; recorded as verified by COO in web: Data Not Collected

Probed and all 404 (`PATH_ERROR` or `NOT_FOUND`):

- `/v1/apps/6820685404/appDataUsages` (and several name variants)
- `/v1/apps/6820685404/privacyDetails`, `appPrivacy`, `dataPrivacy`, `nutritionLabel`, `privacyNutritionLabels`
- `/v2/apps/6820685404/appDataUsages`

The public ASC API still cannot read the nutrition label. Per COO relay of 13 Nov 2026, 12:23 AM Asia/Dhaka (BDT), this was already **Data Not Collected** in the ASC web UI. That matches the intended answers (no analytics, no third-party SDKs, purchases via StoreKit). This item is not a FAIL, but it was not independently re-read from the API this turn.

---

## 9. Export compliance and content rights — PASS (with one unreadable sub-resource)

- App `contentRightsDeclaration`: **DOES_NOT_USE_THIRD_PARTY_CONTENT**
- Build 26 `usesNonExemptEncryption`: **false**
- `app.json` @ `ab0de08` also sets `ITSAppUsesNonExemptEncryption: false`
- `GET .../appEncryptionDeclarations` and the version `appEncryptionDeclaration` relationship: **404** (not readable as a separate resource). Export compliance is evidenced on the build, not on that missing path.
- Version `usesIdfa`: **null** (age rating `advertising` is false)

---

## 10. Copyright — PASS

Version copyright: **2026 Samay Vashsht**. Matches the audit expectation.

---

## 11. TestFlight — PASS (groups and tester); build 26 is not yet the installed build

`GET /v1/builds/{26}/betaGroups` returned **403**, so group membership was read from `GET /v1/apps/6820685404/betaGroups` and each group's builds.

Internal groups that include build 26:

| Group id | Name | Internal | `hasAccessToAllBuilds` | Build 26 |
|---|---|---|---|---|
| `1b0304f4-7907-4661-bd96-e8cbe61a5c49` | Team (Expo) | yes | false | yes (also 25, 24, 23, 22, 21, 18) |
| `df2bc14e-10ac-4e5a-9186-1b46cdaf947a` | Internal list | yes | true | yes (automatic) |
| `71fb37c4-fa11-49a0-94a8-20f9ce8223d0` | Team (Expo) all builds (deprecated) | yes | true | yes (automatic; pre-existing, left alone) |
| `7f7672c0-37f5-4ef1-a4a8-cc1b8db74c0f` | Krosz Personal Group | yes | true | yes (automatic; pre-existing, left alone) |

External groups do **not** include 26:

- `eaebfff9-5014-4709-aef5-31e21fff3d06` External Group — only build 7
- `c4195889-a325-42be-8a0b-2906b0248079` Internal list (this one is `isInternalGroup: false`) — only build 8

Samay tester, `GET /v1/betaTesters?filter[email]=samayvashisht@icloud.com&filter[apps]=6820685404`:

- id `aa1763bd-bf7c-432d-8e2f-5b27fa5e3baa`
- state **INSTALLED**, `inviteType` EMAIL
- Groups: Internal list + Team (Expo)
- Device: `iPhone18_1`, iOS 26.6, **`appBuildVersion` 1.1.0 (25)** — not 26

en-US What to Test on build 26 starts: **"NOT RUN by QA."**

---

## 12. Other submission gates

### iPad / device family

- `GET /v1/builds/26/buildBundles` returned **403**, so ASC device-family on the binary is **not readable**.
- Read-only `app.json` at `samayhuf-star/klenzer` @ `ab0de08` (the claimed build 26 source): `ios.supportsTablet` is **false**, `bundleIdentifier` `com.krosz.klenzer`, `version` 1.1.0. (`buildNumber` in that file is still `"25"`; EAS autoIncrement produced 26, as FINAL.md said.)
- Build icons include an App Store icon whose source name contains `U007ephone`.
- No iPad screenshot sets exist. **No iPad shots are required** while `supportsTablet` is false.

### Prior App Review submission — not blocking

One review submission exists: `eb7c61f5-9055-4a34-865b-9267036fc0f6`, submitted 2 Nov 2026, 6:24:26 PM Asia/Dhaka (BDT) (source `2026-11-02T12:24:26.036Z`), state **COMPLETE**. Its only item is **REMOVED**. The current 1.1.0 version is again `PREPARE_FOR_SUBMISSION`. No open review, no `UNRESOLVED_ISSUES`. Nothing was submitted this turn.

### App availability

`availableInNewTerritories: true`. **175 / 175** territories `available: true`. Every territory has `contentStatuses` = `CANNOT_SELL` + `AVAILABLE_FOR_SALE_UNRELEASED_APP`. **0** `MISSING_CONTRACT`. That pair is the expected pre-release state, not proof that the Paid Apps agreement is Active.

### Paid Apps agreement — not readable (remaining blocker)

Re-probed `/v1/agreements`, `/v1/contracts`, `/v1/taxForms`, `/v1/bankAccounts`: all **404**. The API still cannot say whether Paid Apps or banking is Active. The 12 Nov 2026 audit recorded Samay's report that Paid Apps and the bank were **Processing**; that status was **not re-verified** this check. Until the agreement is confirmed Active in the ASC website, a paid app can be rejected or blocked at submit time. **This keeps the app NOT READY.**

**Fix:** In App Store Connect (Business / Agreements, Tax, and Banking), confirm Paid Apps is **Active** and banking is not still Processing. Then do a paywall price check on a device. Do not submit 1.1.0 until that is confirmed.

### Real-device / QA of the attached binary — remaining blocker (separate from the pending simulator run)

Build 26's What to Test still starts with "NOT RUN by QA." Samay's tester record still shows **1.1.0 (25)** installed on `iPhone18_1`. Checklist item C14 from the 12 Nov audit is still open for this binary.

**Fix:** Install TestFlight build 26 on an iPhone and run launch, core clean-up flows, paywall prices, and a sandbox purchase if possible, with screenshots. Then update the TestFlight label. The GitHub Actions simulator run, once billing is clear, can support this but does not replace a real-device pass for lock screen / Face ID / Photos permissions.

### Other

- Game Center: none
- App Clips: none
- Phased release: none
- Version experiments: none
- `isOrEverWasMadeForKids`: false

---

## GitHub Actions billing lock (read-only)

**Current lock state: not confirmable as cleared.** Last direct evidence still points to a billing lock, and no later Actions run exists to prove it was lifted.

Evidence (no workflows were triggered this check):

- `samayhuf-star/klenzer` workflow "iOS Simulator QA" (`.github/workflows/sim-qa.yml`) has 3 runs. Newest: run `43231997861`, 12 Nov 2026, **7:55:43 PM Asia/Dhaka (BDT)** (source `2026-11-12T13:55:43Z`), conclusion **failure**, completed in about 4 seconds, `runner_id` 0, empty steps, job logs **404** (no log blob). That timestamp matches the 7:55 PM BDT lock report.
- `samayhuf-star/playsz` has an earlier 4-second failure at 6:48:00 PM Asia/Dhaka (BDT) (`2026-11-12T12:48:00Z`).
- `samayhuf-star/lulla` now has workflow "Lulla iOS Simulator QA" (`.github/workflows/sim-qa.yml`, id `416415480`, state **active**), created 13 Nov 2026, 12:54:22 AM Asia/Dhaka (BDT) (source `2026-11-13T00:24:22+05:30`). **0 workflow runs.** Adding the file does not prove Actions billing is clear; only a run would.
- There is no public read-only billing API on this account to re-check the lock without starting a run. Job logs for the failed Klenzer run were not stored, so the exact "account is locked due to a billing issue" string could not be re-read from the log this turn.

Do not trigger the Lulla (or Klenzer) simulator workflow until the account billing page shows the lock is gone, or a later run is observed that actually starts on a `macos-latest` runner.

---

## Comparison with 7 Apps' FINAL.md claims

| Claim | Live check |
|---|---|
| Version 1.1.0 PREPARE_FOR_SUBMISSION with build 26 attached, VALID, encryption false | Confirmed |
| en-US description / promo / keywords match approved text; no Compress / RevenueCat / AI / ellipsis | Confirmed exact match |
| Review notes written; last name Vashsht | Confirmed |
| Screenshots 7+7 COMPLETE at 1320×2868 and 1284×2778 | Confirmed; no leftover old 6.7" 1290×2796 set |
| Age rating 4+ / all NONE | Confirmed |
| Privacy page 200, covers Contacts / Face ID / Secret Album, 0 RevenueCat | Confirmed |
| Build 26 in Team (Expo) and Internal list; also in two older all-builds groups; externals untouched | Confirmed |
| Samay tester INSTALLED in those two groups | Confirmed, but installed binary is still **build 25** |
| App Privacy not API-readable; COO says Data Not Collected | Confirmed unreadable; COO web verification recorded as instructed |
| Not submitted for App Review | Confirmed (prior submission COMPLETE with item REMOVED) |

---

## Overall

**NOT READY** to submit to App Review, even excluding the pending simulator run.

ASC metadata for the version, build, listing, screenshots, review details, age rating, copyright, content rights, export flag, and IAP/subscription records is in place and matches the approved copy. The remaining blockers are:

1. **Paid Apps agreement / banking not confirmed Active** (API not readable). Fix: confirm Active in the ASC website, then recheck paywall prices.
2. **Build 26 not QA'd.** Fix: install 26 from TestFlight (the device still has 25) and complete the pre-submission run with screenshots; then clear the "NOT RUN by QA" label.

Ambiguous / not independently re-readable this turn: App Privacy nutrition label (use COO web: Data Not Collected); ASC `buildBundles` device family (403; rely on `supportsTablet: false`); GitHub billing lock (last evidence 7:55 PM BDT on 12 Nov 2026; not re-verified as cleared).
