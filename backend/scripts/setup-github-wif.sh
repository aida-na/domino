#!/usr/bin/env bash
# GitHub Actions → Cloud Run via Workload Identity Federation (no SA JSON keys).
#
# Required when org policy iam.managed.disableServiceAccountKeyCreation is enforced.
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project domino-500918
#
# Usage:
#   ./scripts/setup-github-wif.sh
#   ./scripts/setup-github-wif.sh --github-repo aida-na/domino

set -euo pipefail

PROJECT="${GCP_PROJECT:-domino-500918}"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
REGION="${GCP_REGION:-us-central1}"
GITHUB_REPO="${GITHUB_REPO:-aida-na/domino}"
GITHUB_ORG="${GITHUB_REPO%%/*}"
GITHUB_REPO_NAME="${GITHUB_REPO#*/}"

POOL_ID="github"
PROVIDER_ID="github"
SA_NAME="github-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --github-repo) GITHUB_REPO="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "Project:      $PROJECT ($PROJECT_NUMBER)"
echo "GitHub repo:  $GITHUB_REPO"
echo "GitHub org:   $GITHUB_ORG"
echo "Deploy SA:    $SA_EMAIL"
echo

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com run.googleapis.com cloudbuild.googleapis.com --project="$PROJECT"

if ! gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT" --location=global &>/dev/null; then
  echo "Creating workload identity pool..."
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --project="$PROJECT" \
    --location=global \
    --display-name="GitHub Actions"
else
  echo "✓ Pool $POOL_ID exists"
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT" --location=global \
  --workload-identity-pool="$POOL_ID" &>/dev/null; then
  echo "Creating GitHub OIDC provider..."
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project="$PROJECT" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'" \
    --issuer-uri="https://token.actions.githubusercontent.com"
else
  echo "✓ Provider $PROVIDER_ID exists"
fi

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" &>/dev/null; then
  echo "Creating deploy service account..."
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT" \
    --display-name="GitHub Actions deploy"
else
  echo "✓ Service account exists"
fi

for role in roles/run.admin roles/iam.serviceAccountUser roles/cloudbuild.builds.editor roles/storage.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --quiet >/dev/null
done
echo "✓ IAM roles bound to $SA_EMAIL"

WIF_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$WIF_MEMBER" \
  --quiet >/dev/null
echo "✓ WIF binding for repo $GITHUB_REPO"

PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

cat <<EOF

Done. Add this GitHub Actions repository variable (Settings → Secrets and variables → Actions → Variables):

  GCP_WORKLOAD_IDENTITY_PROVIDER = $PROVIDER
  GCP_SERVICE_ACCOUNT            = $SA_EMAIL

Workflows use these instead of GCP_SA_KEY (no JSON key needed).

EOF
