#!/usr/bin/env bash
# One entry point for a fresh OpenVault install. It never echoes secret values.
# Usage: ./scripts/bootstrap.sh [all|preflight|configure]
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENVAULT_ROOT="$ROOT"
source "$ROOT/scripts/lib/deploy_config.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/bootstrap.sh [--resume] [all|preflight|configure]

  all        Run preflight, configure, bootstrap-infra, first-image-push,
             apply, migrate, seed, and smoke-test in order (default).
  preflight  Check tools, config, credentials, state, and .env.production only.
  configure  Run preflight and generate ignored tfvars/backend config only.
  --resume   Continue an interrupted install with existing state; it does not
             delete or overwrite state and still checks account/environment.

The full path creates billable AWS resources. No Terraform apply is run by
preflight/configure. Read docs/COST.md before selecting "all".
EOF
}

fail() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

version_at_least() {
  python3 - "$1" "$2" <<'PY'
import re
import sys

def parts(value):
    return tuple(int(piece) for piece in re.findall(r"\d+", value)[:3])

raise SystemExit(0 if parts(sys.argv[1]) >= parts(sys.argv[2]) else 1)
PY
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required tool '$1' is missing. See README.md for prerequisites."
}

preflight() {
  load_deploy_config || return $?

  local cmd aws_version tf_version docker_version gh_version jq_version account_id
  for cmd in aws terraform docker gh jq git curl python3; do require_command "$cmd"; done

  aws_version="$(aws --version 2>&1 | sed -E 's/^aws-cli\/([^ ]+).*/\1/')"
  [[ "$aws_version" == 2.* ]] || fail "AWS CLI v2 is required; detected '$aws_version'."
  tf_version="$(terraform version -json | jq -r .terraform_version)"
  version_at_least "$tf_version" 1.9.0 || fail "Terraform >=1.9.0 is required; detected '$tf_version'."
  docker_version="$(docker --version | sed -E 's/^Docker version ([^,]+).*/\1/')"
  version_at_least "$docker_version" 24.0.0 || fail "Docker >=24.0.0 is required; detected '$docker_version'."
  docker buildx version >/dev/null 2>&1 || fail "Docker Buildx is required (docker buildx version failed)."
  gh_version="$(gh --version | head -1 | awk '{print $3}')"
  version_at_least "$gh_version" 2.45.0 || fail "GitHub CLI >=2.45.0 is required; detected '$gh_version'."
  jq_version="$(jq --version | sed 's/^jq-//')"
  version_at_least "$jq_version" 1.6 || fail "jq >=1.6 is required; detected '$jq_version'."

  local local_state
  local_state="$(find "$ROOT/infra" -type f \( -name '*.tfstate' -o -name '*.tfstate.*' -o -name '*.tfplan' \) -print -quit 2>/dev/null || true)"
  if [[ -n "$local_state" ]]; then
    [[ "${OPENVAULT_RESUME:-0}" == 1 ]] || fail "Local Terraform state/plan exists at ${local_state#"$ROOT/"}; use --resume only for the same account/environment."
    echo "[preflight] resume mode: local state detected and retained"
  fi

  [[ -f "$ROOT/.env.production" ]] || fail "Missing .env.production. Copy .env.production.example, fill the required secrets, and rerun."
  "$ROOT/scripts/check_env.sh" "$ROOT/.env.production" --phase preflight || fail ".env.production did not pass preflight validation; fix the named missing fields."

  account_id="$(aws sts get-caller-identity --region "$AWS_REGION" --query Account --output text --no-cli-pager 2>/dev/null)" \
    || fail "AWS credentials are unavailable or cannot call sts:GetCallerIdentity. Configure AWS CLI/SSO, then retry."
  [[ "$account_id" =~ ^[0-9]{12}$ ]] || fail "AWS returned an unexpected account identifier."
  export OPENVAULT_ACCOUNT_ID="$account_id"

  local prefix bucket lock_table key
  prefix="ov-${account_id}"
  bucket="${prefix}-tfstate"
  lock_table="${prefix}-tf-locks"
  key="envs/${ENVIRONMENT}/terraform.tfstate"
  if aws s3api head-bucket --bucket "$bucket" --region "$AWS_REGION" >/dev/null 2>&1; then
    if aws s3api head-object --bucket "$bucket" --key "$key" --region "$AWS_REGION" >/dev/null 2>&1; then
      [[ "${OPENVAULT_RESUME:-0}" == 1 ]] || fail "Remote Terraform state already exists for $ENVIRONMENT in this account. Use --resume only if continuing the same install."
      echo "[preflight] resume mode: target remote state detected and retained"
    fi
  fi

  echo "[preflight] tools: AWS CLI $aws_version; Terraform $tf_version; Docker $docker_version; gh $gh_version; jq $jq_version"
  echo "[preflight] AWS account: $account_id; region: $AWS_REGION; environment: $ENVIRONMENT"
  echo "[preflight] target host: $(environment_domain "$ENVIRONMENT")"
  echo "[preflight] no local or target remote Terraform state found"
}

configure() {
  local env
  for env in staging prod; do
    write_environment_tfvars "$env" || return $?
    write_backend_config "$env" "$OPENVAULT_ACCOUNT_ID" || return $?
  done
  cat > "$ROOT/infra/bootstrap/terraform.tfvars" <<EOF
region = $(tf_quote "$AWS_REGION")
name_prefix = $(tf_quote "ov-${OPENVAULT_ACCOUNT_ID}")
owner = $(tf_quote "${GITHUB_REPO%%/*}")
EOF
  [[ -s "$ROOT/infra/bootstrap/terraform.tfvars" ]] || return 1
  echo "[configure] Generated ignored staging/prod tfvars and backend config from deploy.config."
}

confirm_billable() {
  local expected="$ENVIRONMENT" answer
  echo "This will create AWS resources and incur charges (see docs/COST.md)."
  read -r -p "Type '$expected' to confirm the selected environment: " answer
  [[ "$answer" == "$expected" ]] || fail "Confirmation did not match; stopped before apply."
}

terraform_apply_target() {
  local env="$1" backend="$ROOT/infra/envs/$1/backend.tfbackend"
  terraform -chdir="$ROOT/infra/envs/$env" init -input=false -backend-config="$backend" || return $?
  terraform -chdir="$ROOT/infra/envs/$env" plan -input=false -out="$ROOT/infra/envs/$env/first.tfplan" || return $?
  terraform -chdir="$ROOT/infra/envs/$env" apply "$ROOT/infra/envs/$env/first.tfplan" || return $?
}

stage_bootstrap_infra() {
  confirm_billable || return $?
  terraform -chdir="$ROOT/infra/bootstrap" init -input=false || return $?
  terraform -chdir="$ROOT/infra/bootstrap" plan -input=false || return $?
  terraform -chdir="$ROOT/infra/bootstrap" apply || return $?
  terraform_apply_target "$ENVIRONMENT" || return $?
}

stage_first_image_push() {
  [[ -x "$ROOT/scripts/push_first_images.sh" ]] || fail "scripts/push_first_images.sh is missing. Update to the complete bootstrap release."
  "$ROOT/scripts/push_first_images.sh" "$ENVIRONMENT" || return $?
}

stage_apply() { terraform_apply_target "$ENVIRONMENT" || return $?; }

stage_migrate() {
  [[ -x "$ROOT/scripts/post_deploy.sh" ]] || fail "scripts/post_deploy.sh is missing. Update to the complete bootstrap release."
  "$ROOT/scripts/post_deploy.sh" "$ENVIRONMENT" migrate || return $?
}

stage_seed() {
  [[ -x "$ROOT/scripts/post_deploy.sh" ]] || fail "scripts/post_deploy.sh is missing. Update to the complete bootstrap release."
  "$ROOT/scripts/post_deploy.sh" "$ENVIRONMENT" seed || return $?
}

stage_smoke_test() {
  "$ROOT/scripts/smoke_test.sh" "https://$(environment_domain "$ENVIRONMENT")" || return $?
}

run_stage() {
  local name="$1"; shift
  echo "\n========== $name =========="
  if "$@"; then
    echo "[bootstrap] $name complete"
  else
    local rc=$?
    echo "[bootstrap] STOPPED at '$name' (exit $rc); no later stage was run." >&2
    exit "$rc"
  fi
}

MODE="${1:-all}"
if [[ "$MODE" == "--resume" ]]; then
  export OPENVAULT_RESUME=1
  MODE="${2:-all}"
fi
case "$MODE" in
  -h|--help|help) usage; exit 0 ;;
  preflight) preflight; exit 0 ;;
  configure) preflight; configure; exit 0 ;;
  all) ;;
  *) usage >&2; exit 2 ;;
esac

run_stage preflight preflight
run_stage configure configure
run_stage bootstrap-infra stage_bootstrap_infra
run_stage first-image-push stage_first_image_push
run_stage apply stage_apply
run_stage migrate stage_migrate
run_stage seed stage_seed
run_stage smoke-test stage_smoke_test
echo "[bootstrap] Fresh deployment complete. Read docs/DEPLOY.md for post-deploy checks."
