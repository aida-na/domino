#!/usr/bin/env bash
# Migrate Cloud Run secrets from plain env vars to GCP Secret Manager.
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project domino-500918
#
# Usage:
#   ./scripts/setup-gcp-secrets.sh --enable-api     # enable Secret Manager API (once)
#   ./scripts/setup-gcp-secrets.sh --import         # copy values from Cloud Run → secrets
#   ./scripts/setup-gcp-secrets.sh                  # create secrets (prompts for values)
#   ./scripts/setup-gcp-secrets.sh --bind           # bind secrets to Cloud Run (removes plain env vars first)
#
# Recommended one-time migration:
#   ./scripts/setup-gcp-secrets.sh --enable-api
#   ./scripts/setup-gcp-secrets.sh --import
#   ./scripts/setup-gcp-secrets.sh --bind

set -euo pipefail

PROJECT="${GCP_PROJECT:-domino-500918}"
REGION="${GCP_REGION:-us-central1}"
PROD_SERVICE="${PROD_SERVICE:-domino}"
STAGING_SERVICE="${STAGING_SERVICE:-domino-api-staging}"

SECRETS=(
  DATABASE_URL
  GEMINI_API_KEY
  BLOOIO_API_KEY
  BLOOIO_WEBHOOK_SECRET
  RESEND_API_KEY
  DOMINO_INTERNAL_SECRET
  SECRET_KEY
)

enable_secret_manager_api() {
  echo "Enabling Secret Manager API on $PROJECT ..."
  gcloud services enable secretmanager.googleapis.com --project="$PROJECT"
  echo "Waiting 30s for API propagation ..."
  sleep 30
  echo "✓ Secret Manager API enabled"
}

grant_cloud_run_access() {
  local sa
  sa="$(gcloud run services describe "$PROD_SERVICE" \
    --project="$PROJECT" --region="$REGION" \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  if [[ -z "$sa" ]]; then
    sa="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
  fi
  echo "Granting Secret Manager access to $sa ..."
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${sa}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
  echo "✓ secretAccessor granted"
}

read_cloud_run_env() {
  local service="$1" var="$2"
  gcloud run services describe "$service" \
    --project="$PROJECT" --region="$REGION" \
    --format="json" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for env in data.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [{}])[0].get('env', []):
    if env.get('name') == sys.argv[1] and 'value' in env:
        print(env['value'], end='')
        break
" "$var" 2>/dev/null || true
}

create_secret() {
  local name="$1"
  local value="${2:-}"

  if gcloud secrets describe "$name" --project="$PROJECT" &>/dev/null; then
    echo "  ✓ $name already exists"
    return
  fi

  if [[ -z "$value" ]]; then
    echo -n "Enter value for $name: "
    read -rs value
    echo
  fi

  if [[ -z "$value" ]]; then
    echo "  ⚠ skipped $name (empty)"
    return
  fi

  printf '%s' "$value" | gcloud secrets create "$name" \
    --project="$PROJECT" \
    --replication-policy=automatic \
    --data-file=-
  echo "  + created $name"
}

import_from_cloud_run() {
  echo "Importing secret values from Cloud Run service $PROD_SERVICE (values are not printed) ..."
  for name in "${SECRETS[@]}"; do
    value="$(read_cloud_run_env "$PROD_SERVICE" "$name")"
    if [[ -n "$value" ]]; then
      create_secret "$name" "$value"
    else
      echo "  ⚠ $name not found as plain env var on $PROD_SERVICE — enter manually or skip"
      create_secret "$name" ""
    fi
  done
}

bind_secrets() {
  local service="$1"
  echo "Binding secrets to Cloud Run service: $service"

  # Cloud Run cannot change an env var from plain text → secret in one step.
  # Remove plain env vars first, then attach secret references.
  local remove_list
  remove_list="$(IFS=,; echo "${SECRETS[*]}")"

  local secret_args=()
  for name in "${SECRETS[@]}"; do
    if gcloud secrets describe "$name" --project="$PROJECT" &>/dev/null; then
      secret_args+=(--set-secrets="${name}=${name}:latest")
    else
      echo "  ⚠ secret $name does not exist — skipping bind for this key"
    fi
  done

  if [[ ${#secret_args[@]} -eq 0 ]]; then
    echo "No secrets to bind. Run --import or create secrets first."
    exit 1
  fi

  gcloud run services update "$service" \
    --project="$PROJECT" \
    --region="$REGION" \
    --remove-env-vars="$remove_list" \
    "${secret_args[@]}"

  echo "✓ Bound secrets to $service"
}

case "${1:-}" in
  --enable-api)
    enable_secret_manager_api
    ;;
  --import)
    enable_secret_manager_api 2>/dev/null || true
    import_from_cloud_run
    grant_cloud_run_access
    echo ""
    echo "Done. Run: ./scripts/setup-gcp-secrets.sh --bind"
    ;;
  --bind)
    grant_cloud_run_access
    bind_secrets "$PROD_SERVICE"
    if gcloud run services describe "$STAGING_SERVICE" --project="$PROJECT" --region="$REGION" &>/dev/null; then
      bind_secrets "$STAGING_SERVICE"
    fi
    ;;
  *)
    enable_secret_manager_api 2>/dev/null || true
    echo "Creating secrets in project $PROJECT ..."
    for name in "${SECRETS[@]}"; do
      create_secret "$name" ""
    done
    grant_cloud_run_access
    echo ""
    echo "Done. Run: ./scripts/setup-gcp-secrets.sh --bind"
    ;;
esac
