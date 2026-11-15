#!/usr/bin/env bash
# Install the built simulator app, run the Maestro flows, and collect screenshots.
# A failed flow does not stop the later flows. The step fails only when no
# numbered screenshot was captured.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
: "${UDID:?}"
: "${APP:?}"
: "${DEVICE_NAME:?}"
: "${FOLDER:?}"
BUNDLE="${BUNDLE_ID:-com.krosz.klenzer}"
DEST="$REPO/qa/sim-gate/out/klenzer/$FOLDER"
mkdir -p "$DEST/maestro" "$DEST/debug" "$DEST/backup" "$DEST/progress-poll"

case "$DEVICE_NAME" in
  *SE*) SWITCH_POINT="88%,51%" ;;
  *) SWITCH_POINT="90%,40%" ;;
esac
export SWITCH_POINT

echo "device=$DEVICE_NAME udid=$UDID folder=$FOLDER switch=$SWITCH_POINT"
echo "app=$APP"
plutil -extract CFBundleIdentifier raw -o - "$APP/Info.plist" || true

install_fresh() {
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  xcrun simctl install "$UDID" "$APP"
}

privacy() {
  local action="$1" service="$2"
  echo "simctl privacy $action $service $BUNDLE"
  xcrun simctl privacy "$UDID" "$action" "$service" "$BUNDLE"
}

POLL_PID=""
poll_start() {
  (
    i=0
    while [ "$i" -lt 30 ]; do
      xcrun simctl io "$UDID" screenshot "$DEST/progress-poll/$(printf '%02d' "$i").png" >/dev/null 2>&1 || true
      i=$((i + 1))
      sleep 3
    done
  ) &
  POLL_PID=$!
}
poll_stop() {
  if [ -n "$POLL_PID" ]; then
    kill "$POLL_PID" >/dev/null 2>&1 || true
    pkill -P "$POLL_PID" >/dev/null 2>&1 || true
    wait "$POLL_PID" >/dev/null 2>&1 || true
    POLL_PID=""
  fi
}

: > "$DEST/flow-results.tsv"
run_flow() {
  local name="$1" code=0
  echo "===== maestro ${name} ====="
  maestro test \
    --format JUNIT \
    --output "$DEST/junit-${name}.xml" \
    --test-output-dir "$DEST/maestro/${name}" \
    --debug-output "$DEST/debug/${name}" \
    -e "SWITCH_POINT=${SWITCH_POINT}" \
    "$REPO/qa/sim-gate/${name}.yaml" || code=$?
  printf '%s\t%s\n' "$name" "$code" | tee -a "$DEST/flow-results.tsv"
  xcrun simctl io "$UDID" screenshot "$DEST/backup/${name}-end.png" >/dev/null 2>&1 || true
}

open -a Simulator --args -CurrentDeviceUDID "$UDID" || true
xcrun simctl boot "$UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$UDID" -b

install_fresh
privacy reset photos || true
privacy reset photos-add || true

poll_start
run_flow 01-fresh-onboarding
poll_stop

# Later flows need a readable library even if the system sheet was not tapped.
privacy grant photos || true

poll_start
run_flow 02-scan-home
poll_stop
run_flow 03-relaunch
run_flow 04-smart-clean
run_flow 05-tiles-tools
run_flow 06-paywall
run_flow 07-settings

install_fresh
if ! privacy revoke photos; then
  echo "revoke photos failed" | tee "$DEST/privacy-revoke.txt"
fi
privacy revoke photos-add || true
run_flow 08-denied

python3 - "$DEST" "$DEVICE_NAME" <<'PY'
import shutil, subprocess, sys
from pathlib import Path
import re
dest = Path(sys.argv[1])
device = sys.argv[2]
shots = []
maestro = dest / "maestro"
if maestro.exists():
    for path in maestro.rglob("*.png"):
        if "takeScreenshot" not in path.parts:
            continue
        match = re.match(r"^(\d+)-(.+)$", path.stem)
        if not match:
            extra = dest / "extra"
            extra.mkdir(exist_ok=True)
            shutil.copy2(path, extra / f"{path.parts[-3]}-{path.name}")
            continue
        shots.append((int(match.group(1)), match.group(2), path))
shots.sort()
lines = []
seen = set()
for num, desc, path in shots:
    if num in seen:
        extra = dest / "extra"
        extra.mkdir(exist_ok=True)
        shutil.copy2(path, extra / f"{num:02d}-{desc}.png")
        continue
    seen.add(num)
    target = dest / f"{num:02d}-screen.png"
    shutil.copy2(path, target)
    lines.append(f"{target.name}\t{desc}\t{path}")
(dest / "manifest.tsv").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
print(f"collected {len(lines)} screenshots")

def sheet(images, title, output):
    if not images:
        return
    tmp = dest / f".sheet-{output.stem}"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir()
    labeled = []
    for i, (img, label) in enumerate(images):
        out = tmp / f"{i:03d}.png"
        subprocess.check_call([
            "magick", str(img), "-resize", "280x",
            "-gravity", "south", "-background", "#111318", "-fill", "white",
            "-splice", "0x44", "-pointsize", "18", "-annotate", "+0+12", label[:48],
            str(out),
        ])
        labeled.append(str(out))
    subprocess.check_call([
        "magick", "montage", *labeled, "-tile", "4x", "-geometry", "+10+10",
        "-background", "#0e1116", "-fill", "white", "-pointsize", "22",
        "-title", title, str(output),
    ])
    shutil.rmtree(tmp, ignore_errors=True)

sheet(
    [(dest / line.split("\t", 1)[0], line.split("\t", 2)[1]) for line in lines],
    device,
    dest / "contact-sheet.png",
)
polls = sorted((dest / "progress-poll").glob("*.png"))
sheet([(p, p.stem) for p in polls], f"{device} scan poll", dest / "progress-sheet.png")
if not lines:
    raise SystemExit("no Maestro screenshots were captured")
PY
collect_status=$?
if [ "$collect_status" -ne 0 ]; then
  echo "screenshot collection failed ($collect_status)" >&2
  exit "$collect_status"
fi

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### ${DEVICE_NAME}"
    echo
    echo '```'
    cat "$DEST/flow-results.tsv"
    echo '```'
    echo
    echo "Screenshots: $(find "$DEST" -name '??-screen.png' | wc -l | tr -d ' ')"
  } >> "$GITHUB_STEP_SUMMARY"
fi

echo "gate output: $DEST"
