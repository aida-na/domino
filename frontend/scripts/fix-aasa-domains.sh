#!/usr/bin/env bash
# Remove apex→www domain redirect so Apple can fetch AASA at https://domino.fyi/...
# Requires: VERCEL_TOKEN with project scope
#   https://vercel.com/account/tokens
set -euo pipefail

TEAM_ID="${VERCEL_TEAM_ID:-team_DD0SnVTel9125LrCaktsu3YV}"
PROJECT_ID="${VERCEL_PROJECT_ID:-prj_CRQU7NoWH0dx6KZmt7bIh1ISSqc5}"
TOKEN="${VERCEL_TOKEN:?Set VERCEL_TOKEN}"

echo "→ Clearing redirect on domino.fyi (serve app directly)..."
curl -sS -X PATCH \
  "https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/domino.fyi?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"redirect":null,"redirectStatusCode":null}' | python3 -m json.tool

echo
echo "→ Optionally redirect www → apex (canonical). Skip if you want both live."
if [[ "${REDIRECT_WWW_TO_APEX:-0}" == "1" ]]; then
  curl -sS -X PATCH \
    "https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/www.domino.fyi?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"redirect":"domino.fyi","redirectStatusCode":307}' | python3 -m json.tool
fi

echo
echo "→ Verify (expect HTTP 200, not 307):"
curl -sI "https://domino.fyi/.well-known/apple-app-site-association" | head -5
curl -sI "https://www.domino.fyi/.well-known/apple-app-site-association" | head -5
