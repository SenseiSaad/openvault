#!/usr/bin/env bash
# Push the required/optional secrets from .env.production to SSM SecureString.
# Values are never echoed. Usage:
#   ./scripts/push_env_to_ssm.sh prod
#   AWS_REGION=ap-south-1 ./scripts/push_env_to_ssm.sh staging
#   DRY_RUN=1 ./scripts/push_env_to_ssm.sh prod
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_NAME="${1:-prod}"
ENV_FILE="${ENV_FILE:-.env.production}"
MANIFEST="infra/secrets-manifest.yaml"
AWS_REGION="${AWS_REGION:-ap-south-1}"
DRY_RUN="${DRY_RUN:-0}"

[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE" >&2; exit 1; }
[[ -f "$MANIFEST" ]] || { echo "missing $MANIFEST" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

section() {
  awk -v s="$1" '
    $0 ~ "^" s ":" { in_section=1; next }
    in_section && /^[A-Za-z_]+:/ { in_section=0 }
    in_section && $1 == "-" { print $2 }
  ' "$MANIFEST"
}

push_one() {
  local name="$1"
  local value
  value="$(eval "printf '%s' \"\${$name-}\"")"
  if [[ -z "$value" ]]; then
    echo "[ssm] skip $name (empty)"
    return 0
  fi
  local path="/openvault/${ENV_NAME}/${name}"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[ssm] DRY-RUN would put $path (SecureString)"
    return 0
  fi
  aws ssm put-parameter \
    --name "$path" \
    --value "$value" \
    --type SecureString \
    --overwrite \
    --region "$AWS_REGION" \
    --no-cli-pager >/dev/null
  echo "[ssm] put $path (SecureString)"
}

echo "[ssm] env=$ENV_NAME file=$ENV_FILE region=$AWS_REGION"
for name in $(section required_secrets) $(section optional_secrets); do
  push_one "$name"
done
echo "[ssm] done. Values were not printed."
echo "[ssm] next: run the Terraform apply, then the deploy workflow."
