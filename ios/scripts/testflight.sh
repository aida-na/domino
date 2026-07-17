#!/usr/bin/env bash
# Archive domino iOS and upload to TestFlight.
# Prerequisites: Xcode, App Store Connect app record for fyi.domino.app
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v xcodegen &>/dev/null; then
  echo "Install xcodegen: brew install xcodegen"
  exit 1
fi

xcodegen generate

SCHEME="Domino"
ARCHIVE_PATH="$PWD/build/Domino.xcarchive"
EXPORT_PATH="$PWD/build/export"

echo "→ Archiving $SCHEME..."
xcodebuild \
  -project Domino.xcodeproj \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  archive

echo "→ Exporting for App Store Connect..."
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist ExportOptions.plist

echo "→ Upload with Transporter or:"
echo "  xcrun altool --upload-app -f \"$EXPORT_PATH/Domino.ipa\" -t ios --apiKey YOUR_KEY --apiIssuer YOUR_ISSUER"
echo "Done. IPA at $EXPORT_PATH/Domino.ipa"
