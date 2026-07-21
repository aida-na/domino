#!/usr/bin/env bash
# Create App Store Connect app + App IDs for domino.
# Uses `asc` CLI (brew install asc). Prefers ASC API key; falls back to web session.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="domino"
BUNDLE_ID="fyi.domino.app"
SHARE_BUNDLE_ID="fyi.domino.app.share"
SKU="domino-ios"
PRIMARY_LOCALE="en-US"
PLATFORM="IOS"
TEAM_ID="2CTC2JW55A"
# App Store Connect provider (individual account) — not the same as DEVELOPMENT_TEAM.
ASC_PROVIDER_ID="128620841"
ASC_PUBLIC_PROVIDER_ID="43c063ee-37bc-4a33-960c-86ee1140a848"
APP_GROUP="group.fyi.domino.app"

prompt() {
  local title="$1" default="${2:-}" hidden="${3:-false}"
  if [[ "$hidden" == "true" ]]; then
    osascript -e "display dialog \"$title\" default answer \"\" with hidden answer with title \"domino App Store Connect\"" \
      -e "text returned of result" 2>/dev/null || true
  else
    osascript -e "display dialog \"$title\" default answer \"$default\" with title \"domino App Store Connect\"" \
      -e "text returned of result" 2>/dev/null || true
  fi
}

notify() {
  osascript -e "display notification \"$1\" with title \"domino App Store Connect\"" 2>/dev/null || true
  echo "==> $1"
}

die() { echo "error: $*" >&2; exit 1; }

have_api_auth() {
  asc auth status --output json 2>/dev/null | grep -q '"environmentCredentialsComplete":true\|"hasCredentials":true\|"selectedProfile"' \
    && asc apps list --limit 1 >/dev/null 2>&1
}

ensure_web_auth() {
  if asc web auth status --output json 2>/dev/null | grep -q '"authenticated":true'; then
    echo "Web session already authenticated."
    return 0
  fi

  local apple_id password
  apple_id="$(prompt "Apple ID email for App Store Connect:" "")"
  [[ -n "$apple_id" ]] || die "Apple ID required"

  password="$(prompt "Password for $apple_id:" "" true)"
  [[ -n "$password" ]] || die "Password required"

  notify "Signing into App Store Connect (2FA may prompt next)…"
  ASC_WEB_PASSWORD="$password" \
  ASC_WEB_2FA_CODE_COMMAND='osascript -e "display dialog \"Enter the 6-digit Apple verification code:\" default answer \"\" with title \"domino App Store Connect\"" -e "text returned of result"' \
    asc web auth login \
      --apple-id "$apple_id" \
      --provider-id "$ASC_PROVIDER_ID" \
      --pretty
}

ensure_bundle_id() {
  local identifier="$1" name="$2"
  echo "Ensuring bundle ID: $identifier"

  if have_api_auth; then
    local existing
    existing="$(asc bundle-ids list --filter "[identifier]=$identifier" --output json 2>/dev/null || true)"
    if echo "$existing" | grep -q "\"identifier\":\"$identifier\""; then
      echo "  already exists"
    else
      asc bundle-ids create \
        --identifier "$identifier" \
        --name "$name" \
        --platform "$PLATFORM" \
        --pretty
    fi
    local bid
    bid="$(asc bundle-ids list --filter "[identifier]=$identifier" --output json \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else '')" 2>/dev/null || true)"
    echo "$bid"
  else
    echo "  (no ASC API key — will rely on web create / Xcode automatic signing)"
    echo ""
  fi
}

add_capability_if_missing() {
  local bundle_resource_id="$1" capability="$2" settings="${3:-}"
  [[ -n "$bundle_resource_id" ]] || return 0
  local caps
  caps="$(asc bundle-ids capabilities list --bundle "$bundle_resource_id" --output json 2>/dev/null || echo '{}')"
  if echo "$caps" | grep -q "\"capabilityType\":\"$capability\""; then
    echo "  capability $capability already on $bundle_resource_id"
    return 0
  fi
  if [[ -n "$settings" ]]; then
    asc bundle-ids capabilities add --bundle "$bundle_resource_id" --capability "$capability" --settings "$settings" --pretty
  else
    asc bundle-ids capabilities add --bundle "$bundle_resource_id" --capability "$capability" --pretty
  fi
}

echo "========================================"
echo " domino → App Store Connect setup"
echo "========================================"
echo " App name:     $APP_NAME"
echo " Bundle ID:    $BUNDLE_ID"
echo " Share ID:     $SHARE_BUNDLE_ID"
echo " Team:         $TEAM_ID (signing) / provider $ASC_PROVIDER_ID"
echo " SKU:          $SKU"
echo "========================================"
echo

# Prefer API key if present; otherwise web session for app creation.
if have_api_auth; then
  echo "ASC API auth OK."
else
  echo "No ASC API key configured."
  echo "  Tip: create one at https://appstoreconnect.apple.com/access/integrations/api"
  echo "  then: asc auth login --name domino --key-id … --issuer-id … --private-key ~/Downloads/AuthKey_….p8"
  echo
  ensure_web_auth
fi

MAIN_BID="$(ensure_bundle_id "$BUNDLE_ID" "domino")"
SHARE_BID="$(ensure_bundle_id "$SHARE_BUNDLE_ID" "domino Share")"

if have_api_auth && [[ -n "$MAIN_BID" ]]; then
  echo "Enabling capabilities on main app…"
  add_capability_if_missing "$MAIN_BID" "ASSOCIATED_DOMAINS"
  # App Groups settings: Apple expects APP_GROUPS with group identifiers
  add_capability_if_missing "$MAIN_BID" "APP_GROUPS" \
    "[{\"key\":\"APP_GROUP_CONTAINERS\",\"options\":[{\"key\":\"$APP_GROUP\",\"enabled\":true}]}]" || \
    add_capability_if_missing "$MAIN_BID" "APP_GROUPS" || true
fi

if have_api_auth && [[ -n "$SHARE_BID" ]]; then
  echo "Enabling capabilities on share extension…"
  add_capability_if_missing "$SHARE_BID" "APP_GROUPS" \
    "[{\"key\":\"APP_GROUP_CONTAINERS\",\"options\":[{\"key\":\"$APP_GROUP\",\"enabled\":true}]}]" || \
    add_capability_if_missing "$SHARE_BID" "APP_GROUPS" || true
fi

# Create App Store Connect app record (web API is the canonical create path).
echo
echo "Creating App Store Connect app record…"
ensure_web_auth

CREATE_OUT="$(asc web apps create \
  --name "$APP_NAME" \
  --bundle-id "$BUNDLE_ID" \
  --sku "$SKU" \
  --platform "$PLATFORM" \
  --primary-locale "$PRIMARY_LOCALE" \
  --version "1.0" \
  --pretty 2>&1)" || {
  echo "$CREATE_OUT"
  if echo "$CREATE_OUT" | grep -qiE 'already exists|duplicate|ENTITY_ERROR'; then
    echo "App may already exist — listing apps…"
  else
    die "app create failed"
  fi
}
echo "$CREATE_OUT"

echo
echo "Listing apps matching $BUNDLE_ID…"
if have_api_auth; then
  asc apps list --bundle-id "$BUNDLE_ID" --output table --pretty || true
else
  echo "(Install API key to list apps via API. Check https://appstoreconnect.apple.com/apps )"
fi

notify "App Store Connect setup finished. Open Connect to confirm listing + capabilities."
echo
echo "Next:"
echo "  1. Confirm App IDs at https://developer.apple.com/account/resources/identifiers/list"
echo "     - $BUNDLE_ID  (Associated Domains, App Groups, Keychain Sharing)"
echo "     - $SHARE_BUNDLE_ID  (App Groups, Keychain Sharing)"
echo "     - App Group $APP_GROUP"
echo "  2. Open https://appstoreconnect.apple.com/apps and fill listing metadata"
echo "  3. Build: cd ios && ./scripts/testflight.sh"
echo
