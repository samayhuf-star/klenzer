#!/usr/bin/env bash
# Klenzer prepare step for .github/workflows/sim-qa.yml (runs after pod install, before the build).
# Adds the KlenzerQATests UI test target and wires qa/Klenzer.storekit into the shared scheme
# (Run and Test actions). Only touches the generated ios/ folder on the CI runner. EAS never runs this.
set -euo pipefail
gem list -i xcodeproj >/dev/null 2>&1 || gem install xcodeproj --no-document
ruby qa/scripts/prepare-xcode-qa.rb
grep -n "StoreKitConfigurationFileReference" -A1 ios/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme | tee -a "$OUT/prepare.log"
