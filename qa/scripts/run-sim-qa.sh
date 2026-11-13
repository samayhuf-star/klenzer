#!/usr/bin/env bash
# Drive the simulator QA gates on a macOS GitHub Actions runner (or a local Mac).
# Assumes: expo prebuild already ran, prepare-xcode-qa.rb already ran, pods installed,
# photos already generated under $PHOTO_DIR, and a simulator is booted ($UDID).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BUNDLE_ID="${BUNDLE_ID:-com.krosz.klenzer}"
UDID="${UDID:?UDID is required}"
PHOTO_DIR="${PHOTO_DIR:-$ROOT/qa/fixtures/photos}"
OUT="${SIM_QA_OUT:-/tmp/klenzer-sim-qa}"
DERIVED="${DERIVED_DATA:-$ROOT/ios/DerivedData}"
STOREKIT="$ROOT/qa/Klenzer.storekit"
SCHEME="${SCHEME:-Klenzer}"
WORKSPACE=$(ls -d ios/*.xcworkspace 2>/dev/null | head -n1)
mkdir -p "$OUT"
mkdir -p /tmp/klenzer-sim-qa-storekit
cp "$STOREKIT" /tmp/klenzer-sim-qa-storekit/Klenzer.storekit

echo "==> Install app, grant Photos, seed media"

# Prefer the already-built .app from build-for-testing when present.
APP_PATH="$(find "$DERIVED" -name 'Klenzer.app' -path '*iphonesimulator*' | head -n1 || true)"

# Privacy grants must be issued against the installed bundle.
if [[ -n "$APP_PATH" ]]; then
  xcrun simctl install "$UDID" "$APP_PATH"
fi

# Brief launch so the data container exists, then terminate before the timed test.
xcrun simctl launch "$UDID" "$BUNDLE_ID" || true
sleep 2
xcrun simctl terminate "$UDID" "$BUNDLE_ID" || true

# Full Photos access last: granting photos-add after photos leaves the app on add-only access.
xcrun simctl privacy "$UDID" grant photos-add "$BUNDLE_ID"
xcrun simctl privacy "$UDID" grant contacts "$BUNDLE_ID" || true
xcrun simctl privacy "$UDID" grant photos "$BUNDLE_ID"
xcrun simctl privacy "$UDID" grant notifications "$BUNDLE_ID" || true
xcrun simctl privacy "$UDID" grant notification "$BUNDLE_ID" || true
# Some runtimes also honor this alias:
xcrun simctl privacy "$UDID" grant all "$BUNDLE_ID" || true

if [ "${SKIP_ADDMEDIA:-0}" = "1" ]; then
  echo "SKIP_ADDMEDIA=1 — photos were seeded earlier in the workflow"
else
# Seed photos in batches so we stay under ARG_MAX. (bash 3.2-safe: no mapfile)
PHOTO_COUNT=0
BATCH=()
BATCH_SIZE=80
while IFS= read -r f; do
  BATCH+=("$f")
  PHOTO_COUNT=$((PHOTO_COUNT + 1))
  if [ "${#BATCH[@]}" -ge "$BATCH_SIZE" ]; then
    xcrun simctl addmedia "$UDID" "${BATCH[@]}"
    BATCH=()
  fi
done <<FIND
$(find "$PHOTO_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort)
FIND
if [ "${#BATCH[@]}" -gt 0 ]; then
  xcrun simctl addmedia "$UDID" "${BATCH[@]}"
fi
echo "seeding done: $PHOTO_COUNT photos onto $UDID"
if [ "$PHOTO_COUNT" -lt 2000 ]; then
  echo "expected at least 2000 photos, found $PHOTO_COUNT" >&2
  exit 1
fi
fi

# Start video recording (h264, no audio to keep the file small).
VIDEO_PID=""
VIDEO_OUT="$OUT/sim-qa.mp4"
rm -f "$VIDEO_OUT"
xcrun simctl io "$UDID" recordVideo --codec h264 --force "$VIDEO_OUT" >"$OUT/record-video.log" 2>&1 &
VIDEO_PID=$!
echo "recording pid $VIDEO_PID -> $VIDEO_OUT"
# Give recordVideo a moment to attach.
sleep 1

# Run the four-gate XCUITest (StoreKit configuration injected here).
set +e
xcodebuild test-without-building \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -destination "id=$UDID" \
  -derivedDataPath "$DERIVED" \
  -storeKitConfigurationPath "$STOREKIT" \
  -resultBundlePath "$OUT/SimQA.xcresult" \
  -only-testing:"KlenzerQATests/SimQATests/testSimulatorQAGates" \
  SIM_QA_OUT="$OUT" \
  STOREKIT_CONFIG="/tmp/klenzer-sim-qa-storekit/Klenzer.storekit" \
  | tee "$OUT/xcodebuild-test.log"
TEST_STATUS=${PIPESTATUS[0]}
set -e

# Stop the recording.
if [[ -n "$VIDEO_PID" ]]; then
  kill -INT "$VIDEO_PID" 2>/dev/null || true
  # recordVideo exits on SIGINT and finalizes the file
  wait "$VIDEO_PID" 2>/dev/null || true
fi
# Also try simctl's documented shutdown of the recorder if the pid already exited.
sleep 1

# One last home screenshot from simctl (independent of XCTest).
xcrun simctl io "$UDID" screenshot "$OUT/simctl-final.png" || true

# Collect logs.
xcrun simctl spawn "$UDID" log collect --output "$OUT/sim-log.logarchive" 2>/dev/null || true
xcrun simctl spawn "$UDID" log show --style compact --last 10m >"$OUT/sim-log.txt" 2>/dev/null || true

# Step summary
python3 - "$OUT" "$TEST_STATUS" <<'PY'
import json, os, sys
out, status = sys.argv[1], int(sys.argv[2])
path = os.path.join(out, "results.json")
steps = []
if os.path.exists(path):
    with open(path) as f:
        steps = json.load(f).get("steps", [])

lines = ["# Klenzer iOS Simulator QA", ""]
if not steps:
    lines += [f"- XCTest exited `{status}` without writing results.json. See artifacts.", ""]
overall = all(s.get("pass") for s in steps) and status == 0 and bool(steps)
lines.append(f"**Overall:** {'PASS' if overall else 'FAIL'}")
lines.append("")
lines.append("| Step | Result | Time | Detail |")
lines.append("| --- | --- | --- | --- |")
for s in steps:
    flag = "PASS" if s.get("pass") else "FAIL"
    ms = s.get("ms") or 0
    if ms >= 1000:
        timing = f"{ms/1000:.1f}s ({ms} ms)"
    else:
        timing = f"{ms} ms"
    detail = str(s.get("detail") or "").replace("|", "\\|")
    lines.append(f"| {s.get('step')}. {s.get('name')} | {flag} | {timing} | {detail} |")
lines.append("")
lines.append("Driver: XCUITest (`xcodebuild test` with `-storeKitConfigurationPath`). Maestro flows live under `qa/maestro/` for local runs; they cannot attach a StoreKit Configuration file on their own.")
summary = os.environ.get("GITHUB_STEP_SUMMARY")
text = "\n".join(lines) + "\n"
if summary:
    with open(summary, "a") as f:
        f.write(text)
print(text)
sys.exit(0 if overall else 1)
PY
STATUS=$?
exit $STATUS
