#!/usr/bin/env bash
# Build and push initial images after the target environment has created ECR.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENVAULT_ROOT="$ROOT"
source "$ROOT/scripts/lib/deploy_config.sh"
load_deploy_config

CONFIG_ENV="$ENVIRONMENT"
ENVIRONMENT="${1:-$CONFIG_ENV}"
[[ "$ENVIRONMENT" == staging || "$ENVIRONMENT" == prod ]] || { echo "environment must be staging or prod" >&2; exit 2; }
[[ "$ENVIRONMENT" == "$CONFIG_ENV" ]] || { echo "requested environment differs from deploy.config; update ENVIRONMENT and regenerate config first." >&2; exit 2; }

ENV_DIR="$ROOT/infra/envs/$ENVIRONMENT"
BACKEND_CONFIG="$ENV_DIR/backend.tfbackend"
[[ -f "$BACKEND_CONFIG" ]] || { echo "Generated backend config is missing; run scripts/bootstrap.sh configure first." >&2; exit 1; }

REPOSITORIES="$(terraform -chdir="$ENV_DIR" output -json ecr_repositories)" \
  || { echo "ECR outputs unavailable; run bootstrap-infra before pushing images." >&2; exit 1; }
API_URI="$(jq -er .api <<<"$REPOSITORIES")"
WEB_URI="$(jq -er .web <<<"$REPOSITORIES")"
REGISTRY="${API_URI%%/*}"
ACCOUNT_ID="$(aws sts get-caller-identity --region "$AWS_REGION" --query Account --output text --no-cli-pager)"
[[ "$REGISTRY" == "$ACCOUNT_ID.dkr.ecr.$AWS_REGION."* ]] || {
  echo "ECR output does not match the authenticated AWS account and configured region; refusing to push." >&2
  exit 1
}

TAG="bootstrap"
echo "Logging into the ECR registry for $ENVIRONMENT; no AWS keys are written to disk."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "Building API and web images for $ENVIRONMENT (tag: $TAG)."
docker build --platform linux/amd64 -f "$ROOT/backend/Dockerfile" -t "$API_URI:$TAG" "$ROOT"
docker build --platform linux/amd64 -f "$ROOT/frontend/Dockerfile" \
  --build-arg NEXT_PUBLIC_API_URL= -t "$WEB_URI:$TAG" "$ROOT"
docker push "$API_URI:$TAG"
docker push "$WEB_URI:$TAG"
echo "Initial images pushed to the Terraform-created repositories."
