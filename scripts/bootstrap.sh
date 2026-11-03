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

  local prefix bucket lock_table key bootstrap_key remote_key
  prefix="ov-${account_id}"
  bucket="${prefix}-tfstate"
  lock_table="${prefix}-tf-locks"
  key="envs/${ENVIRONMENT}/terraform.tfstate"
  bootstrap_key="bootstrap/terraform.tfstate"
  if aws s3api head-bucket --bucket "$bucket" --region "$AWS_REGION" >/dev/null 2>&1; then
    for remote_key in "$bootstrap_key" "$key"; do
      if aws s3api head-object --bucket "$bucket" --key "$remote_key" --region "$AWS_REGION" >/dev/null 2>&1; then
        [[ "${OPENVAULT_RESUME:-0}" == 1 ]] || fail "Remote Terraform state already exists at $remote_key in this account. Use --resume only if continuing the same install."
        echo "[preflight] resume mode: remote state detected and retained ($remote_key)"
      fi
    done
  fi

  echo "[preflight] tools: AWS CLI $aws_version; Terraform $tf_version; Docker $docker_version; gh $gh_version; jq $jq_version"
  echo "[preflight] AWS account: $account_id; region: $AWS_REGION; environment: $ENVIRONMENT"
  echo "[preflight] target host: $(environment_domain "$ENVIRONMENT")"
  echo "[preflight] no local or target remote Terraform state found"
}

configure() {
  write_environment_tfvars "$ENVIRONMENT" || return $?
  write_backend_config "$ENVIRONMENT" "$OPENVAULT_ACCOUNT_ID" || return $?
  cat > "$ROOT/infra/bootstrap/terraform.tfvars" <<EOF
region = $(tf_quote "$AWS_REGION")
name_prefix = $(tf_quote "ov-${OPENVAULT_ACCOUNT_ID}")
owner = $(tf_quote "${GITHUB_REPO%%/*}")
github_repo = $(tf_quote "$GITHUB_REPO")
EOF
  [[ -s "$ROOT/infra/bootstrap/terraform.tfvars" ]] || return 1
  echo "[configure] Generated ignored target-environment tfvars plus bootstrap/environment backend configs."
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
  local bootstrap_backend="$ROOT/infra/bootstrap/backend.tfbackend"
  local state_bucket bootstrap_state
  state_bucket="$(awk -F'"' '/^bucket[[:space:]]*=/ {print $2}' "$bootstrap_backend")"
  bootstrap_state=false
  if aws s3api head-object --bucket "$state_bucket" --key bootstrap/terraform.tfstate --region "$AWS_REGION" >/dev/null 2>&1; then
    bootstrap_state=true
  fi

  if [[ "$bootstrap_state" == true ]]; then
    terraform -chdir="$ROOT/infra/bootstrap" init -input=false -backend-config="$bootstrap_backend" || return $?
  else
    terraform -chdir="$ROOT/infra/bootstrap" init -input=false -backend=false || return $?
    confirm_billable || return $?
    terraform -chdir="$ROOT/infra/bootstrap" plan -input=false || return $?
    terraform -chdir="$ROOT/infra/bootstrap" apply || return $?
    terraform -chdir="$ROOT/infra/bootstrap" init -input=false -migrate-state -force-copy -backend-config="$bootstrap_backend" || return $?
  fi

  local env_backend="$ROOT/infra/envs/$ENVIRONMENT/backend.tfbackend"
  terraform -chdir="$ROOT/infra/envs/$ENVIRONMENT" init -input=false -backend-config="$env_backend" || return $?

  confirm_billable || return $?
  # The delegated hostname's zone must exist before ACM can validate. This
  # targeted plan/apply creates only the zone, then pauses for the manual NS change.
  local zone_plan="$ROOT/infra/envs/$ENVIRONMENT/zone.tfplan"
  terraform -chdir="$ROOT/infra/envs/$ENVIRONMENT" plan -input=false \
    -target=module.dns_tls.aws_route53_zone.this -out="$zone_plan" || return $?
  terraform -chdir="$ROOT/infra/envs/$ENVIRONMENT" apply "$zone_plan" || return $?
  local nameservers host
  nameservers="$(terraform -chdir="$ROOT/infra/envs/$ENVIRONMENT" output -json name_servers | jq -r '.[]')" || return $?
  host="$(environment_domain "$ENVIRONMENT")"
  echo "Delegate $host at your parent DNS provider to these nameservers:"
  printf '%s\n' "$nameservers"
  read -r -p "After publishing the NS records and allowing propagation, press Enter: " _ || return $?
  if command -v dig >/dev/null 2>&1; then
    local expected_ns actual_ns
    expected_ns="$(printf '%s\n' "$nameservers" | sed 's/\.$//' | sort)"
    actual_ns="$(dig +short NS "$host" | sed 's/\.$//' | sort)"
    [[ -n "$actual_ns" && "$actual_ns" == "$expected_ns" ]] || {
      echo "NS delegation for $host is not visible yet. Wait for DNS propagation and rerun with --resume." >&2
      return 1
    }
  else
    echo "dig not installed; DNS delegation was not independently verified (UNVERIFIED)."
  fi

  terraform_apply_target "$ENVIRONMENT" || return $?

  local endpoint secret_arn secret_json db_url env_file
  endpoint="$(terraform -chdir="$ROOT/infra/envs/$ENVIRONMENT" output -raw db_endpoint)" || return $?
  secret_arn="$(terraform -chdir="$ROOT/infra/envs/$ENVIRONMENT" output -raw db_master_secret_arn)" || return $?
  secret_json="$(aws secretsmanager get-secret-value --secret-id "$secret_arn" --query SecretString --output text --region "$AWS_REGION")" || return $?
  db_url="$(printf '%s' "$secret_json" | OV_DB_ENDPOINT="$endpoint" python3 -c 'import json,os,sys; from urllib.parse import quote; secret=json.load(sys.stdin); user=quote(secret["username"],safe=""); password=quote(secret["password"],safe=""); database=quote(secret.get("dbname") or "openvault",safe=""); port=secret.get("port") or 5432; print("postgresql://{}:{}@{}:{}/{}?sslmode=require".format(user,password,os.environ["OV_DB_ENDPOINT"],port,database))')" || return $?
  env_file="$ROOT/.env.production"
  printf '%s' "$db_url" | python3 -c 'import pathlib,re,sys; path=pathlib.Path(sys.argv[1]); text=path.read_text(); line="DATABASE_URL="+sys.stdin.read().strip(); text=re.sub(r"(?m)^DATABASE_URL=.*$",lambda _:line,text,count=1) if re.search(r"(?m)^DATABASE_URL=.*$",text) else text+"\n"+line+"\n"; path.write_text(text); path.chmod(0o600)' "$env_file" || return $?
  unset secret_json db_url
  "$ROOT/scripts/check_env.sh" "$env_file" --phase runtime || return $?
  "$ROOT/scripts/push_env_to_ssm.sh" "$ENVIRONMENT" "$env_file" || return $?
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
  local tfvars="$ROOT/infra/envs/$ENVIRONMENT/terraform.tfvars"
  python3 - "$tfvars" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
text, count = re.subn(r"(?m)^services_enabled\s*=\s*(?:true|false)\s*$", "services_enabled = true", text, count=1)
if count != 1:
    raise SystemExit("services_enabled setting missing from generated tfvars")
  path.write_text(text)
PY
  terraform_apply_target "$ENVIRONMENT" || return $?
  local cluster_name
  cluster_name="$(terraform -chdir="$ROOT/infra/envs/$ENVIRONMENT" output -raw cluster_name)" || return $?
  aws ecs wait services-stable --cluster "$cluster_name" --services api web worker --region "$AWS_REGION" || return $?
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
