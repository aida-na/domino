#!/usr/bin/env bash
# Create a Cloud Scheduler job that triggers the weekly digest every 15 minutes.
# Replaces the GitHub Actions cron (domino-weekly-digest.yml), which can fail when
# GitHub hosted runners are unavailable ("job was not acquired by Runner").
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project domino-500918
#   DOMINO_INTERNAL_SECRET stored in Secret Manager (see setup-gcp-secrets.sh)
#
# Usage:
#   ./scripts/setup-digest-scheduler.sh              # create or update the job
#   ./scripts/setup-digest-scheduler.sh --delete     # remove the job

set -euo pipefail

PROJECT="${GCP_PROJECT:-domino-500918}"
REGION="${GCP_REGION:-us-central1}"
JOB_NAME="${DIGEST_JOB_NAME:-domino-weekly-digest-trigger}"
API_URL="${DOMINO_API_URL:-https://domino-414681726671.us-central1.run.app}"
SCHEDULE="${DIGEST_CRON:-*/15 * * * *}"
SECRET_NAME="${DIGEST_SECRET_NAME:-DOMINO_INTERNAL_SECRET}"

if [[ "${1:-}" == "--delete" ]]; then
  gcloud scheduler jobs delete "$JOB_NAME" \
    --project="$PROJECT" --location="$REGION" --quiet
  echo "✓ Deleted scheduler job $JOB_NAME"
  exit 0
fi

echo "Enabling Cloud Scheduler API ..."
gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT" --quiet

if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT" &>/dev/null; then
  echo "Error: Secret $SECRET_NAME not found. Run setup-gcp-secrets.sh first." >&2
  exit 1
fi

SECRET_VALUE="$(gcloud secrets versions access latest \
  --secret="$SECRET_NAME" --project="$PROJECT")"

if [[ -z "$SECRET_VALUE" ]]; then
  echo "Error: Secret $SECRET_NAME is empty." >&2
  exit 1
fi

URI="${API_URL}/api/v1/digest/trigger"

if gcloud scheduler jobs describe "$JOB_NAME" \
  --project="$PROJECT" --location="$REGION" &>/dev/null; then
  echo "Updating existing job $JOB_NAME ..."
  gcloud scheduler jobs update http "$JOB_NAME" \
    --project="$PROJECT" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --uri="$URI" \
    --http-method=POST \
    --update-headers="Content-Type=application/json,X-Internal-Secret=${SECRET_VALUE}" \
    --attempt-deadline=540s \
    --quiet
else
  echo "Creating scheduler job $JOB_NAME ..."
  gcloud scheduler jobs create http "$JOB_NAME" \
    --project="$PROJECT" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --uri="$URI" \
    --http-method=POST \
    --headers="Content-Type=application/json,X-Internal-Secret=${SECRET_VALUE}" \
    --attempt-deadline=540s \
    --time-zone="UTC" \
    --quiet
fi

echo "✓ Scheduler job ready: $JOB_NAME ($SCHEDULE → POST $URI)"
echo ""
echo "Test manually:"
echo "  gcloud scheduler jobs run $JOB_NAME --project=$PROJECT --location=$REGION"
echo ""
echo "Once verified, disable the GitHub Actions workflow:"
echo "  .github/workflows/domino-weekly-digest.yml (remove schedule trigger or delete file)"
