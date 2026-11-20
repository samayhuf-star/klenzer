#!/usr/bin/env bash
# Static check: every Photos permission call in the app asks for read-write (writeOnly=false), and
# nothing asks for add-only. Exits non-zero (failing the sim run) if that is not true.
set -euo pipefail
fail=0
grep -q "writeOnly: false" src/lib/photo-access.ts || { echo "FAIL: PHOTO_PERMISSION_REQUEST.writeOnly is not false"; fail=1; }
if grep -rnE "(request|get)PermissionsAsync\(\s*true|writeOnly:\s*true|accessLevel:\s*\.addOnly|PHAccessLevel\.addOnly|\.addOnly\b" src modules --include='*.ts' --include='*.tsx' --include='*.swift'; then
  echo "FAIL: add-only Photos access requested above"; fail=1
fi
# Every MediaLibrary permission call must pass the shared read-write arguments.
bad=$(grep -rnE "MediaLibrary\.(request|get)PermissionsAsync\(" src | grep -v "PHOTO_PERMISSION_REQUEST.writeOnly" || true)
if [ -n "$bad" ]; then echo "$bad"; echo "FAIL: Photos permission call without PHOTO_PERMISSION_REQUEST"; fail=1; fi
[ "$fail" = 0 ] && echo "PASS: Klenzer asks Photos for read-write access only (writeOnly=false, no add-only)"
exit "$fail"
