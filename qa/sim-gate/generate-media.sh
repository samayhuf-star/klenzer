#!/usr/bin/env bash
# Build 40-60 fixture stills plus 2 short videos for simctl addmedia.
# Stills come from ImageMagick. Videos come from ffmpeg.
# exiftool stamps a shared DateTimeOriginal on each exact-duplicate pair
# so Photos keeps the capture second the scanner groups on.
set -euo pipefail

OUT="${1:-${PHOTO_DIR:-}}"
if [ -z "$OUT" ]; then
  echo "usage: generate-media.sh <output-dir>" >&2
  exit 1
fi

for tool in magick ffmpeg ffprobe exiftool python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "missing $tool" >&2
    exit 1
  fi
done

rm -rf "$OUT"
mkdir -p "$OUT/exact" "$OUT/near" "$OUT/blurry" "$OUT/screenshots" "$OUT/filler" "$OUT/video"

stamp() {
  local file="$1" when="$2"
  exiftool -overwrite_original -q \
    -DateTimeOriginal="$when" \
    -CreateDate="$when" \
    -ModifyDate="$when" \
    "$file"
  local got
  got="$(exiftool -s -s -s -DateTimeOriginal "$file" || true)"
  if [ "$got" != "$when" ]; then
    echo "EXIF DateTimeOriginal missing on $file (got '$got')" >&2
    exit 1
  fi
}

sharp() {
  local seed="$1" dest="$2" label="$3"
  local r=$(((seed * 37 % 140) + 50))
  local g=$(((seed * 73 % 140) + 40))
  local b=$(((seed * 91 % 140) + 60))
  magick -size 640x480 "xc:rgb(${r},${g},${b})" \
    -fill white -draw "rectangle 24,24 280,200" \
    -fill yellow -draw "circle 460,300 460,160" \
    -fill black -draw "line 0,$((seed % 400)) 640,$(((seed * 3) % 400))" \
    -gravity SouthWest -pointsize 36 -annotate +16+16 "$label" \
    -quality 85 "$dest"
}

echo "generating exact duplicate pairs"
for i in $(seq 0 7); do
  when="$(python3 - "$i" <<'PY'
import sys
i = int(sys.argv[1])
minute = i * 10
print(f"2024:06:01 {12 + minute // 60:02d}:{minute % 60:02d}:00")
PY
)"
  sharp "$i" "$OUT/exact/pair-${i}.jpg" "EXACT ${i}"
  stamp "$OUT/exact/pair-${i}.jpg" "$when"
  cp "$OUT/exact/pair-${i}.jpg" "$OUT/exact/IMG_$(printf '%04d' "$i")_a.jpg"
  cp "$OUT/exact/pair-${i}.jpg" "$OUT/exact/IMG_$(printf '%04d' "$i")_b.jpg"
  rm "$OUT/exact/pair-${i}.jpg"
  cmp "$OUT/exact/IMG_$(printf '%04d' "$i")_a.jpg" "$OUT/exact/IMG_$(printf '%04d' "$i")_b.jpg"
done

echo "generating near-duplicate pairs"
for i in $(seq 0 7); do
  base="$OUT/near/NEAR_$(printf '%04d' "$i")_A.jpg"
  twin="$OUT/near/NEAR_$(printf '%04d' "$i")_B.jpg"
  sharp $((100 + i)) "$base" "NEAR ${i}"
  magick "$base" -brightness-contrast 8x2 -quality 85 "$twin"
  python3 - "$i" "$base" "$twin" <<'PY'
import subprocess, sys
i = int(sys.argv[1])
base, twin = sys.argv[2], sys.argv[3]
# Pairs are 3 minutes apart so only the two frames in a pair share a burst window.
start = i * 180
def stamp(path, offset):
    total = start + offset
    minute, second = divmod(total, 60)
    hour, minute = divmod(minute, 60)
    when = f"2024:06:02 {10 + hour:02d}:{minute:02d}:{second:02d}"
    subprocess.check_call([
        "exiftool", "-overwrite_original", "-q",
        f"-DateTimeOriginal={when}", f"-CreateDate={when}", f"-ModifyDate={when}", path,
    ])
stamp(base, 0)
stamp(twin, 5)
PY
done

echo "generating blurry stills"
for i in $(seq 0 5); do
  dest="$OUT/blurry/BLUR_$(printf '%04d' "$i").jpg"
  magick -size 80x60 "xc:rgb($((40 + i * 20)),$((80 + i * 10)),120)" +noise Random \
    -resize 640x480 -blur 0x24 -quality 70 "$dest"
  when="$(python3 - "$i" <<'PY'
import sys
i = int(sys.argv[1])
print(f"2024:06:04 09:{i * 8:02d}:00")
PY
)"
  stamp "$dest" "$when"
done

echo "generating screenshot-sized PNGs"
# Four SE-sized and four Pro Max-sized screenshots. The scanner keys off the filename.
sizes=("750x1334" "750x1334" "750x1334" "750x1334" "1290x2796" "1290x2796" "1290x2796" "1290x2796")
for i in $(seq 0 7); do
  size="${sizes[$i]}"
  name="$(printf 'Screenshot 2026-11-15 at 09.41.%02d.png' "$i")"
  dest="$OUT/screenshots/$name"
  magick -size "$size" 'xc:#F4F6FB' \
    -fill '#111318' -draw "rectangle 0,0 %[fx:w],140" \
    -fill white -draw "roundrectangle 36,200 %[fx:w-36],520 28,28" \
    -fill '#DBE7FF' -draw "roundrectangle 36,560 %[fx:w-36],980 28,28" \
    -gravity NorthWest -fill white -pointsize 42 -annotate +48+48 "Screenshot $i" \
    "PNG24:$dest"
done

echo "generating unique fillers"
for i in $(seq 0 5); do
  dest="$OUT/filler/FILL_$(printf '%04d' "$i").jpg"
  sharp $((400 + i)) "$dest" "FILL ${i}"
  when="$(python3 - "$i" <<'PY'
import sys
i = int(sys.argv[1])
print(f"2024:06:05 15:{i * 9:02d}:30")
PY
)"
  stamp "$dest" "$when"
done

echo "generating two short videos"
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0x1D4ED8:s=640x360:r=30:d=3" \
  -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=3" \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart \
  -metadata creation_time="2024-06-06T12:00:00Z" \
  "$OUT/video/clip-short.mp4"
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0xB45309:s=640x360:r=30:d=4" \
  -f lavfi -i "sine=frequency=660:sample_rate=44100:duration=4" \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart \
  -metadata creation_time="2024-06-06T12:05:00Z" \
  "$OUT/video/RPReplay_Final_2026-06-06.mp4"

python3 - "$OUT" <<'PY'
import subprocess, sys
from pathlib import Path
out = Path(sys.argv[1])
stills = [p for p in out.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
videos = list(out.rglob("*.mp4"))
print(f"stills={len(stills)} videos={len(videos)}")
if not (40 <= len(stills) <= 60):
    raise SystemExit(f"expected 40-60 stills, found {len(stills)}")
if len(videos) != 2:
    raise SystemExit(f"expected 2 videos, found {len(videos)}")
for video in videos:
    dur = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(video),
    ], text=True).strip()
    seconds = float(dur)
    print(f"{video.name} duration={seconds:.2f}s")
    if seconds <= 0 or seconds > 10:
        raise SystemExit(f"{video.name} is not a short video ({seconds}s)")
PY

echo "media ready in $OUT"
