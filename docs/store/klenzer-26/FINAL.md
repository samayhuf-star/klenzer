# Klenzer 1.1.0 build 26: FINAL (12 Nov 2026, ~11:15 PM BDT)

Approved by Samay 10:49 PM BDT (via Team Lead). NOT submitted for App Review. App Privacy NOT touched.

## Build 26
- Source: samayhuf-star/klenzer klenzer/features @ ab0de08 (no extra bump commit; EAS remote autoIncrement gave 26).
- EAS build 93e5d277-940f-4eba-9a37-20e52896f547 FINISHED (no other EAS build was queued or running on krosz before start). EAS submission 700ec8f7-cf28-4947-9e87-d5f7fba4fa89 succeeded.
- ASC build d47de19b-857f-4fa1-a66b-5a7c77c57a2d, version 26, processingState VALID, usesNonExemptEncryption false (PATCH returned 409 already set; read back false), internalBuildState IN_BETA_TESTING, externalBuildState READY_FOR_BETA_SUBMISSION (no external group touched).
- What to Test (en-US) starts "NOT RUN by QA."
- Groups on build 26: Team (Expo) 1b0304f4 (added via API, 204 after propagation 404s; group builds now 26, 25), Internal list df2bc14e (has access to all builds, so it is in automatically; explicit add returns 422 "Cannot add internal group to a build"). Also auto-included by their own all-builds setting: 71fb37c4 "Team (Expo) all builds (deprecated)" and 7f7672c0 "Krosz Personal Group" (both internal, pre-existing since Oct, not created by this submit, left alone). eaebfff9 and c4195889 not touched.
- Samay tester (GET /v1/betaTesters?filter[email]=samayvashisht@icloud.com&filter[apps]=6820685404): aa1763bd-bf7c-432d-8e2f-5b27fa5e3baa, state INSTALLED, inviteType EMAIL, groups Internal list + Team (Expo).
- Version 1.1.0 (ae1fd46c) build relationship PATCH 204; read back: 1.1.0 PREPARE_FOR_SUBMISSION, build d47de19b = 26 (replaced build 15 ea8b96b3).
Evidence: build26-post.json, build26-groups.json, build26-groups-final.txt.

## Screenshots (screenshots-readback.txt, screenshots-upload-log.json)
- APP_IPHONE_67 set 777d434c: old 5 (1290x2796) deleted; 7 new 1320x2868 uploaded in caption order, all COMPLETE. 1320x2868 is a valid APP_IPHONE_67 size (Apple spec: 6.9" sizes 1260x2736, 1290x2796, 1320x2868 all go in APP_IPHONE_67; there is no APP_IPHONE_69 type in the API).
- APP_IPHONE_65 set 2d731ebb (new): 7 x 1284x2778, all COMPLETE.

## ASC text (asc-text-readback.json)
- en-US localization b7019074: description, promotionalText, keywords PATCH 200; read back matches approved text exactly; no Compress, RevenueCat, AI or ellipsis.
- appStoreReviewDetails e99443ac: notes PATCH 200, read back matches review-notes.md; contactLastName read back "Vashsht".

## Checklist
1. Paywall debug line removed: PASS (ab0de08; grep-evidence.txt; in build 26).
2. Compress Coming soon tile removed: PASS (see Compress line).
3. Live privacy policy updated and published: PASS (app-legal 447ade6; privacy-live-check.txt, HTTP 200, Contacts / Secret Album and Face ID / Free daily limit sections, RevenueCat 0).
4. RevenueCat removed: ASC description PASS (read back). App Privacy: PENDING SAMAY WEB STEP (not readable via API; answers in app-privacy-answers.md: Data Not Collected).
5. Age rating: PASS (declaration 6af1a0db, all NONE/false, FOUR_PLUS; asc-before.json).
6. Screenshots 6.9" and 6.5": PASS (7 + 7 COMPLETE, real Klenzer UI, demo data disclosed in CHECKPOINT.md).
7. Review notes: PASS (written and read back; review-notes.md).
8. Build 26 on TestFlight and attached to 1.1.0: PASS (VALID, IN_BETA_TESTING, both groups, attached, read back).
- Compress removed everywhere: PASS. No match for compress in src/app or src/components, no route, no tab; ASC description, promotional text and keywords read back with no Compress; captions have none.
- Purpose strings: PASS (purpose-strings-introspect.txt: Photos, Add Photos, Contacts, Face ID match the code. Note: Location string present but never prompted, Local Network string comes from expo-dev-client).
- Description accuracy: PASS (Merge copies phone numbers and email addresses only; Secret Album photos only; no temp-files or Compress claims).

## Still open
- Samay: App Privacy in the ASC web UI -> "No, we do not collect data from this app", then Publish.
- C6 (Paid Apps agreement Active, prices showing) and C14 (real-device QA) from the audit are outside these 8 and still open. Build 26 is labelled NOT RUN by QA.
- Not submitted for App Review.


## Update 13 Nov 2026, 12:24 AM BDT
App Privacy was already "Data Not Collected" (Team Lead relay from Samay). Item 4 is now a full PASS: there is no RevenueCat in the ASC description or in App Privacy.
