#!/usr/bin/env bash
# Seed App Review demo account on production Cloud SQL.
# Usage: ./ios/AppStore/setup-review-account.sh
set -euo pipefail

PHONE="${REVIEW_PHONE:-+15555550100}"
PASSWORD="${REVIEW_PASSWORD:-DominoReview1!}"
PROXY_PORT="${PROXY_PORT:-5433}"
INSTANCE="domino-500918:us-central1:domino-db"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/backend"

if ! command -v cloud-sql-proxy >/dev/null; then
  echo "Install: brew install cloud-sql-proxy"
  exit 1
fi

if ! pgrep -f "cloud-sql-proxy.*${PROXY_PORT}" >/dev/null 2>&1; then
  echo "Starting Cloud SQL proxy on port ${PROXY_PORT}…"
  cloud-sql-proxy "$INSTANCE" --port "$PROXY_PORT" &
  PROXY_PID=$!
  trap 'kill "$PROXY_PID" 2>/dev/null || true' EXIT
  sleep 2
fi

# Parse user/pass from backend/.env DATABASE_URL (domino:...@/domino?host=/cloudsql/...)
ENV_FILE="$ROOT/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing backend/.env"
  exit 1
fi

DB_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
USER="$(python3 -c "from urllib.parse import urlparse, unquote; u=urlparse('${DB_URL/postgresql+asyncpg/postgresql}'); print(unquote(u.username or ''))")"
PASS="$(python3 -c "from urllib.parse import urlparse, unquote; u=urlparse('${DB_URL/postgresql+asyncpg/postgresql}'); print(unquote(u.password or ''))")"

export DATABASE_URL="postgresql+asyncpg://${USER}:${PASS}@127.0.0.1:${PROXY_PORT}/domino"

python scripts/local_qa.py setup-review-account "$PHONE" "$PASSWORD" \
  --frontend-url https://www.domino.fyi \
  --reseed

echo ""
echo "Review notes: ios/AppStore/review-notes.txt"
