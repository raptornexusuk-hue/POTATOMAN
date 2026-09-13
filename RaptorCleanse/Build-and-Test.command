#!/bin/bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"
if ! /usr/bin/xcodebuild -version >/dev/null 2>&1; then
    printf '%s\n' 'Full Xcode is required. Open Xcode once, install its required components, then try again.'
    exit 1
fi
run_stamp="$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$project_dir/Build"
printf '%s\n' 'Building Raptor Cleanse and running its isolated core tests…'
/usr/bin/xcodebuild \
    -project "$project_dir/RaptorCleanse.xcodeproj" \
    -scheme RaptorCleanse \
    -configuration Debug \
    -destination 'platform=macOS' \
    -derivedDataPath "$project_dir/Build/DerivedData" \
    -resultBundlePath "$project_dir/Build/TestResults-$run_stamp.xcresult" \
    test 2>&1 | tee "$project_dir/Build/Build-Test-$run_stamp.log"
printf '%s\n' 'Build and tests passed. Open RaptorCleanse.xcodeproj and press Command-R for the UI test.'
