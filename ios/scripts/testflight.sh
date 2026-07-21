#!/usr/bin/env bash
# Archive domino iOS and upload to TestFlight.
# Prerequisites: Xcode, App Store Connect app for fyi.domino.app, `asc auth login`
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

if ! command -v xcodegen &>/dev/null; then
  echo "Install xcodegen: brew install xcodegen"
  exit 1
fi

APP_ID="${ASC_APP_ID:-6792152513}"
SCHEME="Domino"
ARCHIVE_PATH="$ROOT/build/Domino.xcarchive"
EXPORT_PATH="$ROOT/build/export"
IPA_PATH="$EXPORT_PATH/Domino.ipa"

mkdir -p "$ROOT/build"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

echo "→ Generating Xcode project…"
xcodegen generate

echo "→ Archiving $SCHEME (manual App Store profiles from Config/*.Release.xcconfig)…"
xcodebuild \
  -project Domino.xcodeproj \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=2CTC2JW55A \
  archive

# Prefer export-only IPA; upload via asc (API key) — more reliable than export destination=upload
EXPORT_OPTS="$ROOT/build/ExportOptions-local.plist"
cat > "$EXPORT_OPTS" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>export</string>
	<key>signingStyle</key>
	<string>manual</string>
	<key>teamID</key>
	<string>2CTC2JW55A</string>
	<key>uploadSymbols</key>
	<true/>
	<key>provisioningProfiles</key>
	<dict>
		<key>fyi.domino.app</key>
		<string>IOS_APP_STORE-20260717</string>
		<key>fyi.domino.app.share</key>
		<string>domino Share App Store</string>
	</dict>
</dict>
</plist>
PLIST

echo "→ Exporting IPA…"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTS" \
  -allowProvisioningUpdates

if [[ ! -f "$IPA_PATH" ]]; then
  # xcodebuild sometimes names IPA after PRODUCT_NAME
  IPA_PATH="$(find "$EXPORT_PATH" -name '*.ipa' | head -1)"
fi
[[ -f "$IPA_PATH" ]] || { echo "error: no IPA exported"; exit 1; }

echo "→ Uploading to TestFlight (app $APP_ID)…"
if command -v asc &>/dev/null && asc auth status >/dev/null 2>&1; then
  asc builds upload --app "$APP_ID" --ipa "$IPA_PATH" --wait --pretty
else
  echo "asc not authenticated. Upload manually:"
  echo "  asc builds upload --app $APP_ID --ipa \"$IPA_PATH\" --wait"
  echo "Or Transporter /:"
  echo "  xcrun altool --upload-app -f \"$IPA_PATH\" -t ios --apiKey KEY --apiIssuer ISSUER"
  exit 1
fi

echo "Done. IPA at $IPA_PATH"
echo "Open: https://appstoreconnect.apple.com/apps/$APP_ID/testflight/ios"
