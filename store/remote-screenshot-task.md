# Task for the Claude session on the MacinCloud Mac: capture real Klenzer screenshots

## State (already done, do NOT redo)
- This is a MacinCloud Managed Server: standard user `user304727`, **no sudo/admin**, Homebrew is read-only. Install anything user-local (`~/tools`, `~/.maestro`). Never run `sudo`.
- Xcode works (`xcrun simctl` OK). The real Klenzer app (Release build) is **already built and installed** on the booted **iPhone 17 Pro Max** simulator.
  - UDID: `3DCD4EA1-FC23-42AC-AF48-EC90A6CA5AEA`, bundle id `com.krosz.klenzer`
- The simulator photo library is **already seeded**: ~36 synthetic photos, 3 duplicate sets (same file imported 2-3x), 6 screenshot-style PNGs, 2 large videos.
- Working copy: `~/klenzer-shots/app` (repo samayhuf-star/klenzer). Maestro flow: `~/klenzer-shots/flow.yaml`. `gh` is at `~/tools/bin/gh`, logged in.
- Do NOT modify app source. Do NOT fake UI.

## Task
Capture real screenshots into `~/klenzer-shots/app/store/screenshots/`:
`ios-1-home.png` (home after a scan: storage ring + 3 category cards), `ios-2-duplicates.png` (review grid with the "Best" badge), `ios-3-screenshots.png`, `ios-4-videos.png` (sizes shown), and `ios-5-done.png` if possible.

### Attempt 1: Maestro (previous run failed with "iOS driver not ready in time")
```bash
export JAVA_HOME=$HOME/tools/jdk/Contents/Home
export PATH="$HOME/tools/bin:$HOME/.maestro/bin:$JAVA_HOME/bin:$PATH"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=400000
mkdir -p ~/klenzer-shots/app/store/screenshots
maestro --device 3DCD4EA1-FC23-42AC-AF48-EC90A6CA5AEA test ~/klenzer-shots/flow.yaml
```

### Attempt 2: if Maestro still can't start, drive the simulator directly
```bash
U=3DCD4EA1-FC23-42AC-AF48-EC90A6CA5AEA
xcrun simctl privacy $U grant photos com.krosz.klenzer
xcrun simctl launch $U com.krosz.klenzer
# Tap through the UI (AppleScript/cliclick on the Simulator window, or ask the human to tap while you capture).
xcrun simctl io $U screenshot ~/klenzer-shots/app/store/screenshots/ios-1-home.png
```
Flow to follow in the app: intro slides -> "Continue" x2 -> "Get started" -> "Scan my library" -> wait for "What we found" -> capture home; tap "Duplicates & near-identical" -> capture; Back; "Screenshots" -> capture; Back; "Large videos" -> capture. For the done screen, in Duplicates tap "Delete", confirm the system alert (safe: throwaway simulator library), capture.
(Note: `simctl io screenshot` does not put pictures into the Photos library; that's fine, the seeded library already has everything.)

## Report + push
- Look at every image. Report any crash, wrong number or UI bug.
- Push:
```bash
export PATH="$HOME/tools/bin:$PATH"
cd ~/klenzer-shots/app && git checkout -B screenshots && git add -f store/screenshots \
 && git -c user.name="Klenzer Screenshot Bot" -c user.email="noreply@users.noreply.github.com" commit -m "Add real simulator screenshots" \
 && git push -f origin screenshots && echo PUSHED
```
