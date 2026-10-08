# Task for the Claude session that has Xcode: capture real App Store / Play screenshots of Klenzer

Goal: run the real Klenzer app in the iOS Simulator with a seeded photo library and capture 4 genuine screenshots. Do NOT edit app source or fake any UI; only seed the simulator's photo library.

## 1. Get the code
```bash
gh repo clone samayhuf-star/klenzer ~/klenzer && cd ~/klenzer
npm ci
```
(If `gh` isn't logged in to samayhuf-star, ask me to run `gh auth login` on this machine.)

## 2. Boot a simulator (6.9" screenshots are what App Store Connect needs)
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   # I (the user) will run this if you need a password
xcrun simctl list devices available | grep -i "iPhone 1[67] Pro Max"
xcrun simctl boot "<iPhone 17 Pro Max or the newest Pro Max available>"
open -a Simulator
```

## 3. Seed the photo library so every screen has real content
Make ~40 varied JPEGs (e.g. with sharp / ImageMagick gradients, or any royalty-free photos), then:
```bash
xcrun simctl addmedia booted photo_01.jpg photo_01.jpg photo_01.jpg   # same file x3 imported together -> a duplicate set
xcrun simctl addmedia booted photo_02.jpg photo_02.jpg
xcrun simctl addmedia booted photo_03.jpg ... photo_30.jpg
```
- Duplicates: Klenzer groups photos with the same pixel size taken in the same second, so import identical files back-to-back.
- Screenshots: take a few real simulator screenshots with `xcrun simctl io booted screenshot ~/x.png` is NOT enough (they are not added to Photos); instead press Cmd+S in Simulator a few times on any screen so iOS saves them to Photos as screenshots.
- Large videos (>100 MB, >=3 s): `ffmpeg -f lavfi -i testsrc=duration=60:size=1920x1080:rate=60 -b:v 30M big1.mp4` (make 2-3), then `xcrun simctl addmedia booted big1.mp4 ...`.

## 4. Run the real app
```bash
npx expo run:ios --device "<the booted simulator name>"
```
(If a dev build is slow, `npx expo start --ios` with Expo Go also works.) In the app: finish the 3-slide intro, tap "Allow Access to All Photos", then tap "Scan my library".

## 5. Capture 4 screenshots (portrait, no status-bar overlays added by you)
```bash
mkdir -p ~/klenzer/store/screenshots
xcrun simctl io booted screenshot ~/klenzer/store/screenshots/ios-1-home.png          # home after scan, ring + 3 categories
xcrun simctl io booted screenshot ~/klenzer/store/screenshots/ios-2-duplicates.png    # Duplicates review grid, "Best" badge visible
xcrun simctl io booted screenshot ~/klenzer/store/screenshots/ios-3-screenshots.png   # Screenshots list
xcrun simctl io booted screenshot ~/klenzer/store/screenshots/ios-4-videos.png        # Large videos with sizes
```
Do NOT delete anything to capture a "done" screen unless you are in the simulator (it is safe there; then also capture ios-5-done.png).

## 6. Report back
- Note any crash, wrong number, or UI bug you saw while using the app (this doubles as a real test).
- Push the PNGs: `git add store/screenshots && git commit -m "Add real simulator screenshots" && git push` (create a branch `screenshots` if main is protected), and tell me the branch name.
