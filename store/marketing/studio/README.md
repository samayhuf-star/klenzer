# Marketing studio

Redraws the app's real screens (colours, fonts and icons come from `src/theme.ts` and the screen code) to make App Store screenshots and the preview video. Photos are drawn by code, so no real person's pictures appear.

Setup: copy `node_modules/@expo-google-fonts/{inter,fraunces}` TTFs, `Ionicons.ttf` and `glyphmaps/Ionicons.json` from `@expo/vector-icons`, and `assets/logo.png` next to these files (`fonts/` folder for the TTFs). Then:

```
python3 -m http.server 8765 &
npm i playwright
node shoot.js out home duplicates screenshots videos done privacy   # 1320x2868 screenshots
node frames.js video out/klenzer-app-preview-886x1920.mp4           # 25s, 30fps, needs ffmpeg
```
