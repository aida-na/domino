#!/usr/bin/env bash
# Run Domino unit tests (PhoneNormalizer + APIError).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  export PATH="$DEVELOPER_DIR/usr/bin:$PATH"
fi

if ! command -v xcodegen &>/dev/null; then
  echo "Install xcodegen: brew install xcodegen"
  exit 1
fi

xcodegen generate

DEST="${SIMULATOR_DESTINATION:-platform=iOS Simulator,name=iPhone 17}"

xcodebuild test \
  -project Domino.xcodeproj \
  -scheme Domino \
  -destination "$DEST" \
  -only-testing:DominoTests
