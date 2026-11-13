#!/usr/bin/env bash
# Klenzer prepare step for .github/workflows/sim-qa.yml (runs after pod install, before the build).
# Adds the KlenzerQATests UI test target and wires qa/Klenzer.storekit into the shared scheme
# (Run and Test actions). Only touches the generated ios/ folder on the CI runner. EAS never runs this.
# Also: asserts the app only ever asks Photos for read-write access, and pre-grants FULL Photos
# access to the QA bundle on the booted simulator before the app is installed or launched.
set -euo pipefail
gem list -i xcodeproj >/dev/null 2>&1 || gem install xcodeproj --no-document
ruby qa/scripts/prepare-xcode-qa.rb | tee -a "$OUT/prepare.log"
grep -n "StoreKitConfigurationFileReference" -A1 ios/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme | tee -a "$OUT/prepare.log"

echo "==> Photos permission request is read-write" | tee -a "$OUT/prepare.log"
bash qa/sim-qa/assert-photo-permission.sh 2>&1 | tee "$OUT/permission-assert.txt" | tee -a "$OUT/prepare.log"

echo "==> Pre-grant full Photos access to ${BUNDLE_ID:-?} on ${UDID:-?}" | tee -a "$OUT/prepare.log"
if [ -n "${UDID:-}" ] && [ -n "${BUNDLE_ID:-}" ]; then
  # Full access only. Never photos-add: an add-only grant makes iOS show the "additional access" sheet.
  xcrun simctl privacy "$UDID" grant photos "$BUNDLE_ID" 2>&1 | tee -a "$OUT/prepare.log" \
    && echo "grant photos (prepare): ok" | tee -a "$OUT/prepare.log" \
    || echo "grant photos (prepare): FAILED, flow.sh grants again after install" | tee -a "$OUT/prepare.log"
fi

# Live Photos: generate a few paired HEIC+MOV fixtures with generate-live-photos.swift and add each
# pair in one simctl addmedia call so Photos imports it as a single Live Photo. The probe records
# the outcome in $OUT/live-photo-seed.md / .env and never fails the run.
echo "==> Seed Live Photos on ${UDID:-?}" | tee -a "$OUT/prepare.log"
if [ -n "${UDID:-}" ]; then
  UDID="$UDID" SIM_QA_OUT="$OUT" LIVE_DIR="$PWD/qa/fixtures/live" \
    bash qa/scripts/probe-live-photo-seed.sh 2>&1 | tee -a "$OUT/prepare.log" || echo "live photo seed: probe error (non-fatal)" | tee -a "$OUT/prepare.log"
fi
