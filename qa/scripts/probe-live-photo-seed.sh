#!/usr/bin/env bash
# Probe whether simctl addmedia can seed real paired Live Photos.
# Writes $SIM_QA_OUT/live-photo-seed.md and appends to $GITHUB_STEP_SUMMARY.
# Exits 0 even on a negative result so it never fails the main QA gates;
# the report must say "not run" / "could not seed" rather than PASS.
set -euo pipefail
UDID="${UDID:?}"
OUT="${SIM_QA_OUT:-/tmp/klenzer-sim-qa}"
LIVE_DIR="${LIVE_DIR:-qa/fixtures/live}"
mkdir -p "$OUT"

REPORT="$OUT/live-photo-seed.md"
{
  echo "# Live Photo seed probe"
  echo
  echo "Checked whether \`xcrun simctl addmedia\` imports a paired HEIC+MOV as a single Live Photo (needed before any Convert to still test can be marked as run)."
  echo
} > "$REPORT"

if ! command -v swift >/dev/null 2>&1; then
  echo "Swift is not available; cannot generate an authentic Live Photo pair." >> "$REPORT"
  echo "result=skipped_no_swift" >> "$OUT/live-photo-seed.env"
  exit 0
fi

set +e
swift qa/scripts/generate-live-photos.swift "$LIVE_DIR" 3 >"$OUT/live-gen-stdout.txt" 2>"$OUT/live-gen-stderr.txt"
GEN=$?
set -e
cat "$OUT/live-gen-stderr.txt" >> "$REPORT" || true
if [ "$GEN" -ne 0 ]; then
  echo >> "$REPORT"
  echo "**Result: could not generate fixture files** (swift exit $GEN). Convert to still cannot be tested on this run." >> "$REPORT"
  echo "result=generate_failed" >> "$OUT/live-photo-seed.env"
  exit 0
fi

# Each pair must go in the SAME addmedia call so simctl can discover them.
PAIRS=0
while IFS= read -r heic; do
  base="${heic%.*}"
  mov="${base}.MOV"
  if [ ! -f "$mov" ]; then mov="${base}.mov"; fi
  if [ ! -f "$mov" ]; then
    echo "missing MOV for $heic" >> "$REPORT"
    continue
  fi
  echo "addmedia $heic $mov" >> "$REPORT"
  if ! xcrun simctl addmedia "$UDID" "$heic" "$mov" >>"$OUT/live-addmedia.log" 2>&1; then
    echo "addmedia failed for $heic" >> "$REPORT"
    cat "$OUT/live-addmedia.log" >> "$REPORT" || true
    echo "result=addmedia_failed" >> "$OUT/live-photo-seed.env"
    exit 0
  fi
  PAIRS=$((PAIRS + 1))
done <<FIND
$(find "$LIVE_DIR" -iname 'LIVE_*.HEIC' | sort)
FIND

echo "seeded $PAIRS HEIC+MOV pairs" >> "$REPORT"
if [ "$PAIRS" -lt 1 ]; then
  echo "**Result: no pairs to seed.**" >> "$REPORT"
  echo "result=no_pairs" >> "$OUT/live-photo-seed.env"
  exit 0
fi

# Give Photos a moment to index, then inspect the simulator library.
sleep 3
DATA_DIR="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data"
DB=""
for cand in \
  "$DATA_DIR/Media/PhotoData/Photos.sqlite" \
  "$DATA_DIR/Media/PhotoData/Photos.sqlite"; do
  if [ -f "$cand" ]; then DB="$cand"; break; fi
done
# Fallback search
if [ -z "$DB" ]; then
  DB="$(find "$DATA_DIR/Media" -name 'Photos.sqlite' 2>/dev/null | head -n 1 || true)"
fi

echo >> "$REPORT"
echo "Photos database: \`${DB:-not found}\`" >> "$REPORT"
if [ -z "$DB" ] || [ ! -f "$DB" ]; then
  echo "**Result: addmedia succeeded, but the Photos database was not found, so pairing could not be verified.** Do not mark Convert to still as PASS." >> "$REPORT"
  echo "result=db_missing" >> "$OUT/live-photo-seed.env"
  exit 0
fi

# Copy the DB (it may be locked) and query likely live-photo columns.
TMPDB="$OUT/Photos-copy.sqlite"
cp "$DB" "$TMPDB" 2>/dev/null || true
cp "$DB"-wal "$TMPDB"-wal 2>/dev/null || true
cp "$DB"-shm "$TMPDB"-shm 2>/dev/null || true

# Dump schema clues and row counts. Columns differ across iOS versions.
{
  echo
  echo "Tables:"
  sqlite3 "$TMPDB" ".tables" || true
  echo
  echo "ZASSET columns (if present):"
  sqlite3 "$TMPDB" "PRAGMA table_info(ZASSET);" || true
} > "$OUT/photos-schema.txt" 2>&1 || true

# Heuristics: playback style 3 is PHAssetPlaybackStyle.livePhoto on recent iOS;
# media subtype bit 8 is PHAssetMediaSubtypePhotoLive; some schemas use ZKIND.
SQL_LIVE='
SELECT
  (SELECT COUNT(*) FROM sqlite_master WHERE type="table" AND name="ZASSET") AS has_zasset;
'
HAS=$(sqlite3 "$TMPDB" "$SQL_LIVE" 2>/dev/null || echo 0)

LIVE_COUNT=0
if [ "$HAS" != "0" ]; then
  # Try several known column names without failing the probe.
  LIVE_COUNT=$(sqlite3 "$TMPDB" "SELECT COUNT(*) FROM ZASSET WHERE ZPLAYBACKSTYLE = 3;" 2>/dev/null || echo 0)
  if [ "${LIVE_COUNT:-0}" = "0" ]; then
    LIVE_COUNT=$(sqlite3 "$TMPDB" "SELECT COUNT(*) FROM ZASSET WHERE (ZKIND_SUBTYPE & 8) = 8 OR (ZSUBTYPE & 8) = 8;" 2>/dev/null || echo 0)
  fi
  if [ "${LIVE_COUNT:-0}" = "0" ]; then
    LIVE_COUNT=$(sqlite3 "$TMPDB" "SELECT COUNT(*) FROM ZGENERICASSET WHERE ZPLAYBACKSTYLE = 3;" 2>/dev/null || echo 0)
  fi
  echo >> "$REPORT"
  echo "Sample rows (filename, playback style, subtype if those columns exist):" >> "$REPORT"
  sqlite3 -header -column "$TMPDB" "SELECT ZFILENAME, ZPLAYBACKSTYLE, ZKIND_SUBTYPE FROM ZASSET LIMIT 20;" >>"$REPORT" 2>/dev/null || \
  sqlite3 -header -column "$TMPDB" "SELECT ZFILENAME, ZPLAYBACKSTYLE FROM ZASSET LIMIT 20;" >>"$REPORT" 2>/dev/null || \
  echo "(could not query ZASSET filename/playback columns)" >> "$REPORT"
fi

echo >> "$REPORT"
echo "Paired files seeded: $PAIRS" >> "$REPORT"
echo "Live-looking assets in Photos.sqlite: $LIVE_COUNT" >> "$REPORT"
echo >> "$REPORT"
if [ "${LIVE_COUNT:-0}" -ge 1 ]; then
  echo "**Result: YES — the simulator Photos library contains at least one Live Photo after addmedia.** Convert to still can be tested on a later (or this) run once the feature lands." >> "$REPORT"
  echo "result=seeded_live" >> "$OUT/live-photo-seed.env"
else
  echo "**Result: UNCONFIRMED — addmedia accepted the HEIC+MOV pairs, but Photos.sqlite did not show a live playback style / subtype. The files may have imported as a separate still and a video. Convert to still must not be marked PASS until a Live Photo is observed in the app or in PhotoKit.**" >> "$REPORT"
  echo "result=unconfirmed" >> "$OUT/live-photo-seed.env"
fi

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo
    cat "$REPORT"
  } >> "$GITHUB_STEP_SUMMARY"
fi
echo "probe finished: $(cat "$OUT/live-photo-seed.env" 2>/dev/null || true)"
