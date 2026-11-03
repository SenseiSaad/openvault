#!/usr/bin/env bash
# Read Terraform outputs, then configure GitHub OIDC, environments, variables,
# environment secrets, branch protection, and release-tag protection.
# Usage: scripts/setup_github.sh [staging|prod]
set -Eeuo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: scripts/setup_github.sh [staging|prod]"
  echo "Reads deploy.config and Terraform state; creates reviewers/protection, sets variables, and prompts for smoke credentials."
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENVAULT_ROOT="$ROOT"
source "$ROOT/scripts/lib/deploy_config.sh"
load_deploy_config

TARGET_ENV="${1:-$ENVIRONMENT}"
[[ "$TARGET_ENV" == staging || "$TARGET_ENV" == prod ]] || {
  echo "Usage: scripts/setup_github.sh [staging|prod]" >&2
  exit 2
}
GH_ENV="$TARGET_ENV"
[[ "$TARGET_ENV" == prod ]] && GH_ENV=production

command -v gh >/dev/null || { echo "GitHub CLI is required." >&2; exit 1; }
command -v terraform >/dev/null || { echo "Terraform is required to read outputs." >&2; exit 1; }
command -v aws >/dev/null || { echo "AWS CLI is required to read outputs." >&2; exit 1; }
gh auth status --hostname github.com >/dev/null 2>&1 || {
  echo "Authenticate first with: gh auth login" >&2
  exit 1
}
gh api "repos/$GITHUB_REPO" >/dev/null || {
  echo "Cannot access repository $GITHUB_REPO with the current gh login." >&2
  exit 1
}

ACCOUNT_ID="$(aws sts get-caller-identity --region "$AWS_REGION" --query Account --output text --no-cli-pager)"
write_backend_config "$TARGET_ENV" "$ACCOUNT_ID"
BOOTSTRAP_BACKEND="$ROOT/infra/bootstrap/backend.tfbackend"
ENV_BACKEND="$ROOT/infra/envs/$TARGET_ENV/backend.tfbackend"
STATE_BUCKET="$(awk -F'"' '/^bucket[[:space:]]*=/ {print $2}' "$BOOTSTRAP_BACKEND")"
for key in bootstrap/terraform.tfstate "envs/$TARGET_ENV/terraform.tfstate"; do
  aws s3api head-object --bucket "$STATE_BUCKET" --key "$key" --region "$AWS_REGION" >/dev/null 2>&1 || {
    echo "Required Terraform state s3://$STATE_BUCKET/$key is missing; run bootstrap first." >&2
    exit 1
  }
done

terraform -chdir="$ROOT/infra/bootstrap" init -input=false -backend-config="$BOOTSTRAP_BACKEND" >/dev/null
terraform -chdir="$ROOT/infra/envs/$TARGET_ENV" init -input=false -backend-config="$ENV_BACKEND" >/dev/null

bootstrap_output() { terraform -chdir="$ROOT/infra/bootstrap" output -raw "$1"; }
env_output() { terraform -chdir="$ROOT/infra/envs/$TARGET_ENV" output -raw "$1"; }
env_json_output() { terraform -chdir="$ROOT/infra/envs/$TARGET_ENV" output -json "$1"; }

BUILD_ROLE_ARN="$(bootstrap_output github_build_role_arn)"
TERRAFORM_PLAN_ROLE_ARN="$(bootstrap_output github_terraform_plan_role_arn)"
TERRAFORM_APPLY_ROLE_ARN="$(bootstrap_output github_terraform_apply_role_arn)"
TF_STATE_BUCKET="$(bootstrap_output state_bucket)"
TF_STATE_LOCK_TABLE="$(bootstrap_output lock_table)"
DEPLOY_ROLE_ARN="$(env_output deploy_role_arn)"
ECS_CLUSTER="$(env_output cluster_name)"
FQDN="$(env_output fqdn)"
REPOSITORIES="$(env_json_output ecr_repositories)"
SERVICES="$(env_json_output service_names)"
API_REPOSITORY="$(jq -er '.api | split("/")[-1]' <<<"$REPOSITORIES")"
WEB_REPOSITORY="$(jq -er '.web | split("/")[-1]' <<<"$REPOSITORIES")"
API_SERVICE="$(jq -er .api <<<"$SERVICES")"
WEB_SERVICE="$(jq -er .web <<<"$SERVICES")"
WORKER_SERVICE="$(jq -er .worker <<<"$SERVICES")"
ECR_REGISTRY="$(jq -er .api <<<"$REPOSITORIES")"
ECR_REGISTRY="${ECR_REGISTRY%%/*}"

set_repo_var() {
  local name="$1" value="$2"
  [[ -n "$value" ]] || { echo "Cannot set empty repository variable $name." >&2; return 1; }
  gh variable set "$name" --repo "$GITHUB_REPO" --body "$value" >/dev/null
  echo "set repository variable: $name"
}
set_env_var() {
  local name="$1" value="$2"
  [[ -n "$value" ]] || { echo "Cannot set empty $GH_ENV environment variable $name." >&2; return 1; }
  gh variable set "$name" --repo "$GITHUB_REPO" --env "$GH_ENV" --body "$value" >/dev/null
  echo "set $GH_ENV environment variable: $name"
}
set_secret() {
  local name="$1" value="$2"
  [[ -n "$value" ]] || { echo "Secret $name cannot be empty." >&2; return 1; }
  printf '%s' "$value" | gh secret set "$name" --repo "$GITHUB_REPO" --env "$GH_ENV" >/dev/null
  echo "set $GH_ENV environment secret: $name"
}

echo "== Repository variables from bootstrap/config/Terraform outputs =="
BEDROCK_JSON="$(jq -Rn --arg csv "$BEDROCK_MODEL_ARNS" '$csv | split(",") | map(select(length > 0))')"
DMARC_RECORD="v=DMARC1; p=none; rua=mailto:${ALERT_EMAIL}"
DOMAIN_STAGING="$(environment_domain staging)"
DOMAIN_PROD="$(environment_domain prod)"
FROM_EMAIL_STAGING="${FROM_EMAIL_LOCAL_PART}@${DOMAIN_STAGING}"
FROM_EMAIL_PROD="${FROM_EMAIL_LOCAL_PART}@${DOMAIN_PROD}"
PUBLIC_BASE_URL_STAGING="https://${DOMAIN_STAGING}"
PUBLIC_BASE_URL_PROD="https://${DOMAIN_PROD}"
set_repo_var AWS_REGION "$AWS_REGION"
set_repo_var REPOSITORY "$GITHUB_REPO"
set_repo_var TF_STATE_BUCKET "$TF_STATE_BUCKET"
set_repo_var TF_STATE_LOCK_TABLE "$TF_STATE_LOCK_TABLE"
set_repo_var BUILD_ROLE_ARN "$BUILD_ROLE_ARN"
set_repo_var TERRAFORM_PLAN_ROLE_ARN "$TERRAFORM_PLAN_ROLE_ARN"
set_repo_var TERRAFORM_APPLY_ROLE_ARN "$TERRAFORM_APPLY_ROLE_ARN"
set_repo_var ALERT_EMAIL "$ALERT_EMAIL"
set_repo_var BEDROCK_MODEL_ARNS "$BEDROCK_JSON"
set_repo_var DMARC_RECORD "$DMARC_RECORD"
set_repo_var DOMAIN_STAGING "$DOMAIN_STAGING"
set_repo_var DOMAIN_PROD "$DOMAIN_PROD"
set_repo_var FROM_EMAIL_STAGING "$FROM_EMAIL_STAGING"
set_repo_var FROM_EMAIL_PROD "$FROM_EMAIL_PROD"
set_repo_var PUBLIC_BASE_URL_STAGING "$PUBLIC_BASE_URL_STAGING"
set_repo_var PUBLIC_BASE_URL_PROD "$PUBLIC_BASE_URL_PROD"
set_repo_var ECR_REGISTRY "$ECR_REGISTRY"
set_repo_var INITIAL_IMAGE_TAG "bootstrap"

if [[ "$TARGET_ENV" == staging ]]; then
  set_repo_var ECR_API_REPOSITORY_STAGING "$API_REPOSITORY"
  set_repo_var ECR_WEB_REPOSITORY_STAGING "$WEB_REPOSITORY"
  set_repo_var STAGING_DEPLOY_ROLE_ARN "$DEPLOY_ROLE_ARN"
  set_repo_var STAGING_ECS_CLUSTER "$ECS_CLUSTER"
  set_repo_var STAGING_ECS_API_SERVICE "$API_SERVICE"
  set_repo_var STAGING_ECS_WEB_SERVICE "$WEB_SERVICE"
  set_repo_var STAGING_ECS_WORKER_SERVICE "$WORKER_SERVICE"
else
  set_repo_var ECR_API_REPOSITORY_PROD "$API_REPOSITORY"
  set_repo_var ECR_WEB_REPOSITORY_PROD "$WEB_REPOSITORY"
  set_repo_var PROD_DEPLOY_ROLE_ARN "$DEPLOY_ROLE_ARN"
  set_repo_var PROD_ECS_CLUSTER "$ECS_CLUSTER"
  set_repo_var PROD_ECS_API_SERVICE "$API_SERVICE"
  set_repo_var PROD_ECS_WEB_SERVICE "$WEB_SERVICE"
  set_repo_var PROD_ECS_WORKER_SERVICE "$WORKER_SERVICE"
fi

echo "== Create staging and production environments with required reviewer =="
REVIEWER_ID="$(gh api user --jq .id)"
ENV_PAYLOAD="$(jq -cn --argjson id "$REVIEWER_ID" '{reviewers:[{type:"User",id:$id}],wait_timer:0,deployment_branch_policy:{protected_branches:true,custom_branch_policies:false}}')"
for environment_name in staging production; do
  gh api "repos/$GITHUB_REPO/environments/$environment_name" --method PUT --input - <<<"$ENV_PAYLOAD" >/dev/null
  echo "created/updated required-reviewer environment: $environment_name"
done

echo "== Protect main: pull request plus passing CI, zero required review count =="
gh api "repos/$GITHUB_REPO/branches/main/protection" --method PUT --input - <<'JSON' >/dev/null
{
  "required_status_checks": {"strict": true, "contexts": ["CI / CI required"]},
  "enforce_admins": false,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "== Protect release tags (idempotent ruleset) =="
RULESET="$(jq -cn '{name:"OpenVault release tags",target:"tag",enforcement:"active",conditions:{ref_name:{include:["refs/tags/v*"],exclude:[]}},rules:[{type:"deletion"},{type:"update"},{type:"non_fast_forward"}],bypass_actors:[]}')"
RULESET_ID="$(gh api "repos/$GITHUB_REPO/rulesets" --jq '.[] | select(.name == "OpenVault release tags") | .id' 2>/dev/null | head -1 || true)"
if [[ -n "$RULESET_ID" ]]; then
  gh api "repos/$GITHUB_REPO/rulesets/$RULESET_ID" --method PUT --input - <<<"$RULESET" >/dev/null
else
  gh api "repos/$GITHUB_REPO/rulesets" --method POST --input - <<<"$RULESET" >/dev/null
fi

echo "== Environment variables =="
set_env_var DEPLOY_ROLE_ARN "$DEPLOY_ROLE_ARN"
set_env_var ECS_CLUSTER "$ECS_CLUSTER"
set_env_var ECS_API_SERVICE "$API_SERVICE"
set_env_var ECS_WEB_SERVICE "$WEB_SERVICE"
set_env_var ECS_WORKER_SERVICE "$WORKER_SERVICE"
set_env_var ECR_API_REPOSITORY "$API_REPOSITORY"
set_env_var ECR_WEB_REPOSITORY "$WEB_REPOSITORY"
set_env_var PUBLIC_BASE_URL "https://${FQDN}"
set_env_var DOMAIN "$FQDN"
set_env_var TF_VAR_region "$AWS_REGION"
set_env_var TF_VAR_domain "$FQDN"
set_env_var TF_VAR_github_repo "$GITHUB_REPO"
set_env_var TF_VAR_alert_email "$ALERT_EMAIL"
set_env_var TF_VAR_bedrock_model_arns "$BEDROCK_JSON"
set_env_var TF_VAR_from_email "$FROM_EMAIL_LOCAL_PART@$FQDN"
set_env_var TF_VAR_dmarc_record "$DMARC_RECORD"
set_env_var TF_VAR_services_enabled "true"
set_env_var TF_VAR_initial_image_tag "bootstrap"
if [[ "$TARGET_ENV" == staging ]]; then
  set_env_var ALLOW_EMAIL_VERIFICATION_BYPASS "1"
  set_env_var SMOKE_TEST_MODE "signup"
else
  set_env_var ALLOW_EMAIL_VERIFICATION_BYPASS "0"
  set_env_var SMOKE_TEST_MODE "existing"
fi

echo "== Set smoke-test credentials (input hidden; values never displayed) =="
read -r -s -p "Smoke-test email for $GH_ENV: " SMOKE_TEST_EMAIL
printf '\n'
read -r -s -p "Smoke-test password for $GH_ENV: " SMOKE_TEST_PASSWORD
printf '\n'
set_secret SMOKE_TEST_EMAIL "$SMOKE_TEST_EMAIL"
set_secret SMOKE_TEST_PASSWORD "$SMOKE_TEST_PASSWORD"
unset SMOKE_TEST_EMAIL SMOKE_TEST_PASSWORD

echo "GitHub setup complete for $GH_ENV. Rerun for the other environment after its Terraform outputs exist."
