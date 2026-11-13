#!/usr/bin/env bash
# Klenzer flow for .github/workflows/sim-qa.yml.
# Env from the workflow: UDID, BUNDLE_ID, SCHEME, WORKSPACE, DERIVED_DATA, OUT.
# Seeds sample photos (exact pairs, near pairs, Similar bursts, blurry, screenshots; Live Photos come from
# prepare.sh) and contacts, pre-grants full Photos and Contacts, then runs the KlenzerQATests
# XCUITest (launch, scan with partial counts, scan-complete notification, Home with counts, Duplicate,
# Blurry and Similar review, Swipe, Merge Contacts preview, Secret Album, paywall, StoreKit test
# purchase, restore). The UI test taps Allow Full Access on any Photos sheet (first prompt or the
# "additional access" sheet) and Allow on the notification prompt. Screenshots land in $OUT.
set -euo pipefail
: "${UDID:?}" "${BUNDLE_ID:?}" "${SCHEME:?}" "${WORKSPACE:?}" "${DERIVED_DATA:?}" "${OUT:?}"
mkdir -p "$OUT"
PHOTO_DIR="${PHOTO_DIR:-$PWD/qa/fixtures/photos}"

echo "==> Sample photos"
python3 -m pip install --user --quiet pillow 2>/dev/null || python3 -m pip install --user --quiet --break-system-packages pillow
python3 qa/scripts/generate-sim-photos.py --out "$PHOTO_DIR" --count "${PHOTO_COUNT:-400}" --exact-pairs 5 --blurry 8 --near-pairs 20 --similar-bursts 6 --screenshots 20
N=0; BATCH=()
while IFS= read -r f; do
  BATCH+=("$f"); N=$((N + 1))
  if [ "${#BATCH[@]}" -ge 80 ]; then xcrun simctl addmedia "$UDID" "${BATCH[@]}"; BATCH=(); fi
done < <(find "$PHOTO_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort)
[ "${#BATCH[@]}" -gt 0 ] && xcrun simctl addmedia "$UDID" "${BATCH[@]}"
echo "photos seeded: $N (5 exact pairs, 8 blurry, 20 near pairs, 6 similar bursts x3, 20 screenshots)" | tee "$OUT/seed.txt"
# Live Photos are seeded by prepare.sh (generate-live-photos.swift + paired addmedia); carry its result.
if [ -f "$OUT/live-photo-seed.env" ]; then echo "live photos: $(tr '\n' ' ' < "$OUT/live-photo-seed.env")" | tee -a "$OUT/seed.txt"; else echo "live photos: not seeded (prepare.sh did not run the probe)" | tee -a "$OUT/seed.txt"; fi

echo "==> Sample contacts"
if xcrun simctl addmedia "$UDID" qa/sim-qa/contacts.vcf; then
  echo "contacts seeded: $(grep -c BEGIN:VCARD qa/sim-qa/contacts.vcf)" | tee -a "$OUT/seed.txt"
else
  echo "contacts seeding failed" | tee -a "$OUT/seed.txt"
fi

echo "==> Install and grant"
APP=$(find "$DERIVED_DATA/Build/Products" -maxdepth 2 -name "$SCHEME.app" -path '*Release-iphonesimulator*' | head -n1)
echo "app: $APP"
xcrun simctl install "$UDID" "$APP"
# Full Photos access only (never photos-add: add-only makes iOS show the "additional access" sheet
# and the scan cannot read the library). prepare.sh already granted it; grant again after install.
# Notifications are not a simctl privacy service: the app asks at the first scan and the UI test taps Allow.
: > "$OUT/grants.txt"
for s in photos contacts; do
  if xcrun simctl privacy "$UDID" grant "$s" "$BUNDLE_ID" 2>>"$OUT/grants.txt"; then echo "grant $s: ok" | tee -a "$OUT/grants.txt"; else echo "grant $s: FAILED (the UI test taps Allow Full Access on any Photos sheet)" | tee -a "$OUT/grants.txt"; fi
done

echo "==> XCUITest flow"
mkdir -p /tmp/klenzer-sk && cp qa/Klenzer.storekit /tmp/klenzer-sk/Klenzer.storekit
set +e
TEST_RUNNER_SIM_QA_OUT="$OUT" TEST_RUNNER_STOREKIT_CONFIG="/tmp/klenzer-sk/Klenzer.storekit" \
xcodebuild test-without-building -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath "$DERIVED_DATA" \
  -resultBundlePath "$OUT/flow.xcresult" -only-testing:KlenzerQATests/SimQATests/testKlenzerFlow \
  > "$OUT/xcodebuild-test.log" 2>&1
RC=$?
set -e
tail -n 60 "$OUT/xcodebuild-test.log"
grep "\[klenzer-qa\]" "$OUT/xcodebuild-test.log" || true

# Fallback: export screenshot attachments from the result bundle if the runner could not write $OUT.
mkdir -p "$OUT/attachments"
xcrun xcresulttool export attachments --path "$OUT/flow.xcresult" --output-path "$OUT/attachments" >/dev/null 2>&1 || true

python3 - "$OUT" "$RC" <<'PY'
import json, os, sys
out, rc = sys.argv[1], int(sys.argv[2])
p = os.path.join(out, "results.json")
steps = json.load(open(p)).get("steps", []) if os.path.exists(p) else []
extra = []
for name in ("seed.txt", "permission-assert.txt", "grants.txt"):
    fp = os.path.join(out, name)
    if os.path.exists(fp):
        extra += [f"{name}:", "```", open(fp).read().strip(), "```", ""]
lines = ["# Klenzer iOS Simulator QA", "", f"xcodebuild test exit: {rc}", ""] + extra + ["| Step | Result | Detail |", "| --- | --- | --- |"]
for s in steps:
    lines.append(f"| {s['step']}. {s['name']} | {'PASS' if s['pass'] else 'FAIL'} | {str(s['detail']).replace('|', '/')} |")
if not steps:
    lines.append("| none | FAIL | results.json missing |")
open(os.path.join(out, "summary.md"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
PY
exit $RC
