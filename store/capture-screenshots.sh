#!/usr/bin/env bash
# Klenzer: unattended simulator screenshot capture.
# Run on a Mac with Xcode installed:   bash capture-screenshots.sh
# It builds the REAL app (Release), seeds the simulator photo library, drives the UI with Maestro,
# saves screenshots and pushes them to the `screenshots` branch of samayhuf-star/klenzer.
# The only interactive moments: `gh auth login` (once, if needed) and a possible sudo for xcode-select.
set -uo pipefail

REPO="samayhuf-star/klenzer"
BUNDLE_ID="com.krosz.klenzer"
WORK="$HOME/klenzer-shots"
SEED="$WORK/_seed"
OUT_REL="store/screenshots"
LOG="$WORK/capture.log"
mkdir -p "$WORK" "$SEED"
exec > >(tee -a "$LOG") 2>&1

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mFAILED: %s\033[0m\n' "$*"; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

###############################################################################
say "1/9 Preflight"
###############################################################################
if ! xcrun simctl help >/dev/null 2>&1; then
  if [ -d /Applications/Xcode.app ]; then
    echo "Pointing xcode-select at Xcode (may ask for your password)..."
    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer || die "xcode-select failed"
    sudo xcodebuild -license accept 2>/dev/null || true
    sudo xcodebuild -runFirstLaunch 2>/dev/null || true
  else
    die "Xcode not found in /Applications"
  fi
fi
have node || die "node is required (brew install node)"
have git  || die "git is required"
if ! have brew; then echo "WARNING: Homebrew not found; automatic installs of ffmpeg/exiftool/cocoapods/java will be skipped."; fi

if ! have gh; then have brew && brew install gh; fi
have gh || die "GitHub CLI (gh) required: https://cli.github.com"
if ! gh auth status >/dev/null 2>&1; then
  say "GitHub login needed (one time) so screenshots can be sent back"
  gh auth login || die "gh auth login failed"
fi
gh auth setup-git >/dev/null 2>&1 || true

have pod       || { have brew && brew install cocoapods; }
have exiftool  || { have brew && brew install exiftool; }
have ffmpeg    || { have brew && brew install ffmpeg; }
if ! have java && ! /usr/libexec/java_home >/dev/null 2>&1; then
  have brew && brew install openjdk@17 && export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home" && export PATH="$JAVA_HOME/bin:$PATH"
fi
if ! have maestro; then
  curl -fsSL "https://get.maestro.mobile.dev" | bash
fi
export PATH="$HOME/.maestro/bin:$PATH"
have maestro || die "Maestro install failed (https://maestro.mobile.dev)"

###############################################################################
say "2/9 Get the code"
###############################################################################
if [ -d "$WORK/app/.git" ]; then
  git -C "$WORK/app" fetch -q origin && git -C "$WORK/app" checkout -q main && git -C "$WORK/app" pull -q origin main
else
  gh repo clone "$REPO" "$WORK/app" || die "could not clone $REPO"
fi
cd "$WORK/app" || die "no app dir"
npm ci --no-audit --no-fund || die "npm ci failed"

###############################################################################
say "3/9 Pick + boot the newest iPhone Pro Max simulator"
###############################################################################
cat > "$WORK/pick.py" <<'PY'
import json, re, sys
d = json.load(sys.stdin)["devices"]
best = None
for rt, devs in d.items():
    if "iOS" not in rt:
        continue
    ver = [int(x) for x in re.findall(r"\d+", rt.split("iOS-")[-1])] or [0]
    for dev in devs:
        m = re.match(r"iPhone (\d+) Pro Max$", dev["name"])
        if m and dev.get("isAvailable", True):
            key = (ver, int(m.group(1)))
            if not best or key > best[0]:
                best = (key, dev["udid"], dev["name"].replace(" ", "_"))
print(best[1] + " " + best[2] if best else "NONE NONE")
PY
PICK="$(xcrun simctl list devices available -j | python3 "$WORK/pick.py")"
UDID="${PICK%% *}"; DEVICE_NAME="${PICK#* }"
[ "$UDID" = "NONE" ] && die "No iPhone Pro Max simulator available. Open Xcode > Settings > Components and install an iOS Simulator runtime."
DEVICE_NAME="${DEVICE_NAME//_/ }"
echo "Using: $DEVICE_NAME ($UDID)"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID"
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1
# Clean, consistent status bar for store screenshots
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState charged --batteryLevel 100 --cellularMode active --cellularBars 4 --wifiBars 3 2>/dev/null || true

###############################################################################
say "4/9 Generate seed media (synthetic images: no copyrighted content)"
###############################################################################
cd "$SEED" && rm -rf ./* && npm init -y >/dev/null 2>&1 && npm i sharp --no-audit --no-fund >/dev/null 2>&1 || die "could not install sharp"
cat > gen.mjs <<'JS'
import sharp from 'sharp';
const W = 3024, H = 4032;
const rnd = (s) => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
for (let i = 1; i <= 36; i++) {
  const r = rnd(i * 7919);
  const h1 = Math.floor(r() * 360), h2 = (h1 + 40 + Math.floor(r() * 120)) % 360;
  let shapes = '';
  for (let k = 0; k < 14; k++) {
    shapes += `<circle cx="${r() * W}" cy="${r() * H}" r="${80 + r() * 520}" fill="hsl(${(h1 + r() * 90) % 360} 70% ${40 + r() * 35}%)" opacity="${0.25 + r() * 0.5}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 75% 55%)"/><stop offset="1" stop-color="hsl(${h2} 70% 35%)"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${shapes}</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(`photo_${String(i).padStart(2, '0')}.jpg`);
}
// 6 fake "screenshots" (iPhone-sized PNGs)
for (let i = 1; i <= 6; i++) {
  const r = rnd(i * 104729);
  const bg = `hsl(${Math.floor(r() * 360)} 30% 96%)`;
  let rows = '';
  for (let k = 0; k < 9; k++) rows += `<rect x="90" y="${300 + k * 270}" width="${700 + r() * 1800}" height="70" rx="30" fill="hsl(${Math.floor(r() * 360)} 20% 80%)"/><rect x="90" y="${390 + k * 270}" width="${400 + r() * 1200}" height="46" rx="22" fill="hsl(0 0% 88%)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1290" height="2796"><rect width="1290" height="2796" fill="${bg}"/><rect width="1290" height="220" fill="hsl(0 0% 100%)"/>${rows}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`Screenshot_${i}.png`);
}
console.log('generated');
JS
node gen.mjs || die "seed generation failed"

# Deterministic capture dates (one photo per day) so only the intended sets are "duplicates".
if have exiftool; then
  d=1
  for f in photo_*.jpg; do
    day=$(printf "%02d" $(( (d % 27) + 1 )))
    exiftool -q -overwrite_original "-DateTimeOriginal=2026:09:${day} 1$((d % 9)):1$((d % 6)):2$((d % 9))" "-CreateDate=2026:09:${day} 1$((d % 9)):1$((d % 6)):2$((d % 9))" "$f"
    d=$((d+1))
  done
else
  echo "WARNING: exiftool missing: duplicate detection in the seed may be unreliable."
fi

# Videos > 100 MB so the "Large videos" card has content
VIDEOS=()
if have ffmpeg; then
  ffmpeg -loglevel error -y -f lavfi -i testsrc2=duration=70:size=1920x1080:rate=60 -b:v 28M -pix_fmt yuv420p -metadata creation_time="2026-09-05T10:00:00Z" big_1.mp4 && VIDEOS+=(big_1.mp4)
  ffmpeg -loglevel error -y -f lavfi -i testsrc=duration=60:size=1920x1080:rate=60 -b:v 30M -pix_fmt yuv420p -metadata creation_time="2026-09-12T10:00:00Z" big_2.mp4 && VIDEOS+=(big_2.mp4)
else
  echo "WARNING: ffmpeg missing: no large videos will be seeded."
fi

###############################################################################
say "5/9 Seed the simulator photo library"
###############################################################################
xcrun simctl addmedia "$UDID" $(ls photo_*.jpg | sed -n '1,22p')   # singles
for i in 23 24 25; do   # three duplicate sets: same file imported 3x / 3x / 2x
  f="photo_$i.jpg"
  xcrun simctl addmedia "$UDID" "$f" "$f" "$f"
done
for i in 26 27; do f="photo_$i.jpg"; xcrun simctl addmedia "$UDID" "$f" "$f"; done
xcrun simctl addmedia "$UDID" $(ls photo_*.jpg | sed -n '28,36p')
xcrun simctl addmedia "$UDID" Screenshot_*.png
[ "${#VIDEOS[@]}" -gt 0 ] && xcrun simctl addmedia "$UDID" "${VIDEOS[@]}"
echo "Seeded."

###############################################################################
say "6/9 Build the real app (Release) and install it"
###############################################################################
cd "$WORK/app"
export CI=1
npx expo run:ios --configuration Release --device "$UDID" --no-bundler 2>&1 | tail -40
xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || die "app did not install: check the build output above"
xcrun simctl privacy "$UDID" grant photos "$BUNDLE_ID" || true

###############################################################################
say "7/9 Drive the UI with Maestro and capture screenshots"
###############################################################################
SHOTS="$WORK/app/$OUT_REL"
rm -rf "$SHOTS" && mkdir -p "$SHOTS"
FLOW="$WORK/flow.yaml"
cat > "$FLOW" <<YAML
appId: $BUNDLE_ID
---
- launchApp:
    clearState: true
- extendedWaitUntil:
    visible: "Continue"
    timeout: 40000
- tapOn: "Continue"
- tapOn: "Continue"
- tapOn: "Get started"
- extendedWaitUntil:
    visible: "Scan my library"
    timeout: 30000
- tapOn: "Scan my library"
- extendedWaitUntil:
    visible: "What we found"
    timeout: 240000
- takeScreenshot: $SHOTS/ios-1-home
- tapOn: "Duplicates.*"
- extendedWaitUntil:
    visible: "Delete.*"
    timeout: 20000
- takeScreenshot: $SHOTS/ios-2-duplicates
- tapOn: "Back"
- tapOn: "Screenshots.*"
- extendedWaitUntil:
    visible: "Select all.*"
    timeout: 20000
    optional: true
- takeScreenshot: $SHOTS/ios-3-screenshots
- tapOn: "Back"
- tapOn: "Large videos.*"
- extendedWaitUntil:
    visible: "Select all.*"
    timeout: 20000
    optional: true
- takeScreenshot: $SHOTS/ios-4-videos
- tapOn: "Back"
# "All done" screen: deleting inside the simulator is safe (it is a throwaway photo library)
- tapOn: "Duplicates.*"
- tapOn:
    text: "Delete.*"
- tapOn:
    text: "Delete"
    optional: true
- extendedWaitUntil:
    visible: "All done"
    timeout: 20000
    optional: true
- waitForAnimationToEnd
- takeScreenshot: $SHOTS/ios-5-done
YAML
maestro --device "$UDID" test "$FLOW"
MAESTRO_RC=$?

###############################################################################
say "8/9 Report"
###############################################################################
{
  echo "device: $DEVICE_NAME ($UDID)"
  echo "ios: $(xcrun simctl list runtimes | grep -i ios | tail -1)"
  echo "app commit: $(git -C "$WORK/app" rev-parse --short HEAD)"
  echo "maestro exit code: $MAESTRO_RC (0 = every step passed)"
  echo "files:"; ls -la "$SHOTS"
  echo; echo "Image sizes:"; for f in "$SHOTS"/*.png; do [ -f "$f" ] && sips -g pixelWidth -g pixelHeight "$f" | tr '\n' ' ' && echo; done
} > "$SHOTS/REPORT.txt" 2>&1
cat "$SHOTS/REPORT.txt"
cp "$LOG" "$SHOTS/capture.log" 2>/dev/null || true

###############################################################################
say "9/9 Send the screenshots back (git push to branch 'screenshots')"
###############################################################################
cd "$WORK/app"
git checkout -q -B screenshots
git add -f "$OUT_REL"
git -c user.name="Klenzer Screenshot Bot" -c user.email="noreply@users.noreply.github.com" commit -q -m "Add real simulator screenshots" || echo "nothing new to commit"
git push -f -q origin screenshots && echo "PUSHED: https://github.com/$REPO/tree/screenshots/$OUT_REL" || die "git push failed (check gh auth)"
echo; echo "DONE. Tell Claude: the screenshots branch is pushed."
exit 0
