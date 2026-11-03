#!/usr/bin/env bash
# Safe per-environment teardown; never run automatically by CI.
# Usage: scripts/destroy.sh <staging|prod> [--allow-production] [--empty-s3] [--empty-ecr]
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENVAULT_ROOT="$ROOT"
source "$ROOT/scripts/lib/deploy_config.sh"

usage() {
  cat <<'EOF'
Usage: scripts/destroy.sh <staging|prod> [--allow-production] [--empty-s3] [--empty-ecr]

Creates a manual RDS snapshot, requires typing the exact environment, and
plans/applies only that environment's destroy. S3/ECR content is retained
unless the corresponding explicit empty flag is provided.

Not deleted: bootstrap state/OIDC resources, manual RDS snapshots, SSM
parameters, GitHub environments/variables/secrets, SES SMTP IAM credentials,
or parent DNS NS records.
EOF
}

if [[ "${1:-}" == -h || "${1:-}" == --help ]]; then usage; exit 0; fi
TARGET_ENV="${1:?$(usage)}"
[[ "$TARGET_ENV" == staging || "$TARGET_ENV" == prod ]] || { usage >&2; exit 2; }
ALLOW_PRODUCTION=0 EMPTY_S3=0 EMPTY_ECR=0
for flag in "${@:2}"; do
  case "$flag" in
    --allow-production) ALLOW_PRODUCTION=1 ;;
    --empty-s3) EMPTY_S3=1 ;;
    --empty-ecr) EMPTY_ECR=1 ;;
    *) echo "Unknown flag: $flag" >&2; usage >&2; exit 2 ;;
  esac
done
if [[ "$TARGET_ENV" == prod && "$ALLOW_PRODUCTION" != 1 ]]; then
  echo "Refusing production teardown without --allow-production." >&2
  exit 2
fi

read -r -p "Type '$TARGET_ENV' to confirm teardown of only this environment: " answer
[[ "$answer" == "$TARGET_ENV" ]] || { echo "Confirmation did not match; no AWS changes made." >&2; exit 1; }
if [[ "$TARGET_ENV" == prod ]]; then
  read -r -p "Type 'DESTROY PRODUCTION' to continue: " answer
  [[ "$answer" == "DESTROY PRODUCTION" ]] || { echo "Production confirmation did not match; no AWS changes made." >&2; exit 1; }
fi

load_deploy_config
[[ "$TARGET_ENV" == "$ENVIRONMENT" ]] || { echo "Set ENVIRONMENT=$TARGET_ENV in deploy.config first." >&2; exit 2; }
for tool in aws terraform jq python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Required tool '$tool' is missing." >&2; exit 1; }
done

ACCOUNT_ID="$(aws sts get-caller-identity --region "$AWS_REGION" --query Account --output text --no-cli-pager)"
write_backend_config "$TARGET_ENV" "$ACCOUNT_ID"
ENV_DIR="$ROOT/infra/envs/$TARGET_ENV"
BACKEND_CONFIG="$ENV_DIR/backend.tfbackend"
STATE_BUCKET="$(awk -F'"' '/^bucket[[:space:]]*=/ {print $2}' "$BACKEND_CONFIG")"
STATE_KEY="envs/$TARGET_ENV/terraform.tfstate"
aws s3api head-object --bucket "$STATE_BUCKET" --key "$STATE_KEY" --region "$AWS_REGION" >/dev/null 2>&1 || {
  echo "Terraform state was not found for $TARGET_ENV; refusing to guess what to delete." >&2
  exit 1
}
terraform -chdir="$ENV_DIR" init -input=false -backend-config="$BACKEND_CONFIG" >/dev/null

DB_ID="$(terraform -chdir="$ENV_DIR" output -raw db_instance_identifier)"
DOCS_BUCKET="$(terraform -chdir="$ENV_DIR" output -raw documents_bucket)"
BACKUPS_BUCKET="$(terraform -chdir="$ENV_DIR" output -raw backups_bucket)"
ACCESS_LOGS_BUCKET="$(terraform -chdir="$ENV_DIR" output -raw access_logs_bucket)"
REPOSITORIES="$(terraform -chdir="$ENV_DIR" output -json ecr_repositories)"
API_REPOSITORY="$(jq -er '.api | split("/")[-1]' <<<"$REPOSITORIES")"
WEB_REPOSITORY="$(jq -er '.web | split("/")[-1]' <<<"$REPOSITORIES")"
S3_BUCKETS=("$DOCS_BUCKET" "$BACKUPS_BUCKET" "$ACCESS_LOGS_BUCKET")

# Check retention/empty flags before taking a snapshot or changing protection.
if [[ "$EMPTY_S3" != 1 ]]; then
  for bucket in "${S3_BUCKETS[@]}"; do
    precheck="$(aws s3api list-object-versions --bucket "$bucket" --max-keys 1 --region "$AWS_REGION" --output json)"
    count="$(jq -er '((.Versions // []) + (.DeleteMarkers // [])) | length' <<<"$precheck")"
    if (( count > 0 )); then
      echo "Bucket $bucket contains versioned objects. Rerun with --empty-s3 only if deletion is intended." >&2
      exit 1
    fi
  done
fi
if [[ "$EMPTY_ECR" != 1 ]]; then
  for repository in "$API_REPOSITORY" "$WEB_REPOSITORY"; do
    precheck="$(aws ecr list-images --repository-name "$repository" --max-results 1 --region "$AWS_REGION" --output json)"
    count="$(jq -er '.imageIds | length' <<<"$precheck")"
    if (( count > 0 )); then
      echo "ECR repository $repository contains images. Rerun with --empty-ecr only if image deletion is intended." >&2
      exit 1
    fi
  done
fi

SNAPSHOT_ID=""
snapshot_exists() {
  local snapshots
  snapshots="$(aws rds describe-db-snapshots --db-instance-identifier "$DB_ID" \
    --snapshot-type manual --region "$AWS_REGION" --output json 2>/dev/null || echo '{"DBSnapshots":[]}')"
  SNAPSHOT_ID="$(jq -r --arg prefix "${DB_ID}-manual-final-" \
    '[.DBSnapshots[]? | select((.DBSnapshotIdentifier | startswith($prefix)) and .Status == "available")][0].DBSnapshotIdentifier // empty' \
    <<<"$snapshots")"
  [[ -n "$SNAPSHOT_ID" ]]
}

if aws rds describe-db-instances --db-instance-identifier "$DB_ID" --region "$AWS_REGION" >/dev/null 2>&1; then
  SNAPSHOT_ID="${DB_ID}-manual-final-$(date -u +%Y%m%d%H%M%S)"
  echo "Creating final RDS snapshot $SNAPSHOT_ID."
  aws rds create-db-snapshot --db-instance-identifier "$DB_ID" \
    --db-snapshot-identifier "$SNAPSHOT_ID" --region "$AWS_REGION" --output none
  aws rds wait db-snapshot-available --db-snapshot-identifier "$SNAPSHOT_ID" --region "$AWS_REGION"
else
  snapshot_exists || { echo "RDS is absent and no available manual final snapshot was found; refusing teardown." >&2; exit 1; }
  echo "RDS is already absent; retaining existing final snapshot $SNAPSHOT_ID."
fi

has_s3_versions() {
  local bucket="$1" result count
  result="$(aws s3api list-object-versions --bucket "$bucket" --max-keys 1 --region "$AWS_REGION" --output json)"
  count="$(jq -er '((.Versions // []) + (.DeleteMarkers // [])) | length' <<<"$result")" || return 2
  (( count > 0 ))
}

empty_s3_bucket() {
  local bucket="$1" response objects truncated key_marker version_marker
  echo "Emptying all versions/delete markers from $bucket (explicitly requested)."
  key_marker="" version_marker=""
  while :; do
    local args=(s3api list-object-versions --bucket "$bucket" --max-keys 1000 --region "$AWS_REGION" --output json)
    [[ -z "$key_marker" ]] || args+=(--key-marker "$key_marker")
    [[ -z "$version_marker" ]] || args+=(--version-id-marker "$version_marker")
    response="$(aws "${args[@]}")"
    objects="$(jq -c '{Objects: ((.Versions // []) + (.DeleteMarkers // []) | map({Key,VersionId})), Quiet:true}' <<<"$response")"
    if [[ "$(jq '.Objects | length' <<<"$objects")" -gt 0 ]]; then
      aws s3api delete-objects --bucket "$bucket" --delete "$objects" --region "$AWS_REGION" --output none
    fi
    truncated="$(jq -r '.IsTruncated // false' <<<"$response")"
    [[ "$truncated" == true ]] || break
    key_marker="$(jq -r '.NextKeyMarker // empty' <<<"$response")"
    version_marker="$(jq -r '.NextVersionIdMarker // empty' <<<"$response")"
  done
}

if [[ "$EMPTY_S3" == 1 ]]; then
  for bucket in "${S3_BUCKETS[@]}"; do empty_s3_bucket "$bucket"; done
else
  for bucket in "${S3_BUCKETS[@]}"; do
    if has_s3_versions "$bucket"; then
      echo "Bucket $bucket contains versioned objects. Rerun with --empty-s3 only if deletion is intended." >&2
      exit 1
    else
      result=$?
      [[ "$result" == 1 ]] || { echo "Could not verify S3 bucket contents ($bucket); stopped before destroy." >&2; exit 1; }
    fi
  done
fi

has_ecr_images() {
  local repository="$1" images count
  images="$(aws ecr list-images --repository-name "$repository" --max-results 1 --region "$AWS_REGION" --output json)"
  count="$(jq -er '.imageIds | length' <<<"$images")" || return 2
  (( count > 0 ))
}
empty_ecr_repository() {
  local repository="$1" images batch
  images="$(aws ecr list-images --repository-name "$repository" --region "$AWS_REGION" --output json)"
  batch="$(jq -c '{imageIds:.imageIds[:100]}' <<<"$images")"
  while [[ "$(jq '.imageIds | length' <<<"$batch")" -gt 0 ]]; do
    aws ecr batch-delete-image --repository-name "$repository" --region "$AWS_REGION" \
      --image-ids "$(jq -c '.imageIds' <<<"$batch")" --output none
    images="$(aws ecr list-images --repository-name "$repository" --region "$AWS_REGION" --output json)"
    batch="$(jq -c '{imageIds:.imageIds[:100]}' <<<"$images")"
  done
}

if [[ "$EMPTY_ECR" == 1 ]]; then
  empty_ecr_repository "$API_REPOSITORY"
  empty_ecr_repository "$WEB_REPOSITORY"
else
  for repository in "$API_REPOSITORY" "$WEB_REPOSITORY"; do
    if has_ecr_images "$repository"; then
      echo "ECR repository $repository contains images. Rerun with --empty-ecr only if image deletion is intended." >&2
      exit 1
    else
      result=$?
      [[ "$result" == 1 ]] || { echo "Could not verify ECR repository contents ($repository); stopped before destroy." >&2; exit 1; }
    fi
  done
fi

if [[ "$TARGET_ENV" == prod ]]; then
  echo "Disabling RDS deletion protection after the snapshot is available."
  aws rds modify-db-instance --db-instance-identifier "$DB_ID" \
    --no-deletion-protection --apply-immediately --region "$AWS_REGION" --output none
  aws rds wait db-instance-available --db-instance-identifier "$DB_ID" --region "$AWS_REGION"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export TF_VAR_db_skip_final_snapshot=true
if [[ "$TARGET_ENV" == prod ]]; then export TF_VAR_db_deletion_protection=false; fi
echo "Review the $TARGET_ENV-only destroy plan. Manual snapshot: $SNAPSHOT_ID"
terraform -chdir="$ENV_DIR" plan -destroy -input=false -no-color -out="$TMP/destroy.tfplan"
terraform -chdir="$ENV_DIR" apply "$TMP/destroy.tfplan"

echo "Environment resources destroyed. Bootstrap state/OIDC, manual database snapshots, SSM parameters, GitHub environments/variables/secrets, SES SMTP IAM credentials, and parent DNS NS records remain."
