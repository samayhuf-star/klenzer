# Klenzer iOS simulator QA

GitHub Actions workflow: `.github/workflows/sim-qa.yml`.

It runs on `macos-latest` for every push to `klenzer/v2` and on `workflow_dispatch`. The job:

1. Generates at least 2,000 fixture photos (`qa/scripts/generate-sim-photos.py`) with exact duplicates, near-duplicates, blurry shots and screenshot-sized PNGs. The binaries are not committed.
2. Runs `expo prebuild`, then a post-prebuild-only script (`qa/scripts/prepare-xcode-qa.rb`) that adds a UI-test target and points the scheme at `qa/Klenzer.storekit`.
3. Builds a Release `iphonesimulator` `.app`.
4. Boots an iPhone simulator, seeds the photos with `xcrun simctl addmedia`, and pre-grants Photos access so no permission dialog appears.
5. Records video with `simctl io recordVideo`.
6. Drives four pass/fail gates with XCUITest (`xcodebuild test -storeKitConfigurationPath`):
   1. Launch shows no Apple ID or system prompt, and home appears in under 2 seconds.
   2. The scan shows its first results within 10 seconds and then finishes.
   3. The paywall shows yearly $19.99, monthly $3.99 (auto-renew group "Klenzer Pro") and lifetime $29.99, from the `.storekit` file.
   4. A test monthly purchase unlocks Pro.
7. Uploads screenshots, the video and the logs as the `sim-qa-artifacts` artifact, and writes `$GITHUB_STEP_SUMMARY`.

## Why XCUITest in CI, not Maestro

Maestro flows live in `qa/maestro/` for local runs. CI uses XCUITest because a StoreKit Configuration file is only attached through `xcodebuild test -storeKitConfigurationPath` (or a scheme `StoreKitConfigurationFileReference`). A bare `simctl launch` of an EAS `.app` cannot do that, so prices and a test purchase would not work.

## The `.storekit` file must not ship in production

`qa/Klenzer.storekit` is a local StoreKit Configuration used only by the simulator QA scheme / `xcodebuild` flag. It is **not** an app-target resource, **not** an Expo config plugin, and **not** referenced from `eas.json` or `app.json`. EAS generates its own `ios/` and does not run `prepare-xcode-qa.rb`, so production / TestFlight builds are unaffected.

This is a valid pre-TestFlight gate. It is **not** an App Store sandbox purchase. A real-device Sandbox Apple ID buy is still required before App Review and is out of scope here.

## No secrets

The workflow needs no repository secrets. Simulator builds are unsigned (`CODE_SIGNING_ALLOWED=NO`).

## Live Photo seed probe

`qa/scripts/probe-live-photo-seed.sh` generates a few paired HEIC+MOV files with a shared Apple ContentIdentifier and passes each pair in a single `simctl addmedia` call. It then inspects the simulator Photos database. The step is `continue-on-error` and a negative or unconfirmed result is reported as such — it is never a PASS for Convert to still.
