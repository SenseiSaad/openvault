#!/usr/bin/env bash
# Push local .env values to SSM Parameter Store for the ECS task definitions.
#   ./scripts/push_env_to_ssm.sh <env> [--dry-run]
#   e.g. ./scripts/push_env_to_ssm.sh prod
# Reads .env.<env> in the repo root (gitignored). Secrets -> SecureString,
# plain config -> String. Prints parameter NAMES only, never values.
set -euo pipefail

ENV="${1:?usage: push_env_to_ssm.sh <staging|prod> [--dry-run]}"
DRY_RUN=false
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=true
ENV_FILE=".env.${ENV}"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE (copy .env.production.example)" >&2; exit 1; }
command -v aws >/dev/null || { echo "aws CLI required" >&2; exit 1; }

AWS_REGION="${AWS_REGION:-ap-south-1}"
SECRET_NAMES=(SECRET_KEY DATABASE_URL LLM_KEY_ENCRYPTION_KEY EMAIL_HOST_USER
              EMAIL_HOST_PASSWORD SENTRY_DSN
              BOOTSTRAP_PLATFORM_ADMIN_EMAIL BOOTSTRAP_PLATFORM_ADMIN_PASSWORD)
REQUIRED=(SECRET_KEY DATABASE_URL LLM_KEY_ENCRYPTION_KEY)

get_value() {  # get_value KEY FILE — last non-comment assignment, quotes stripped
  awk -F= -v k="$1" '
    /^[[:space:]]*#/ { next }
    $0 ~ "^[[:space:]]*" k "[[:space:]]*=" {
      sub(/^[^=]*=/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "");
      gsub(/^"|"$/, ""); gsub(/^'"'"'|'"'"'$/, ""); print; found=1; exit
    }
    END { if (!found) exit 1 }' "$2"
}

echo "Pushing to /openvault/$ENV/ (dry-run: $DRY_RUN)"
FAILED=0
for KEY in "${SECRET_NAMES[@]}"; do
  VALUE=$(get_value "$KEY" "$ENV_FILE" || true)
  NAME="/openvault/$ENV/$KEY"
  if [[ -z "$VALUE" ]]; then
    if [[ " ${REQUIRED[*]} " == *" $KEY "* ]]; then
      echo "MISSING (required): $KEY"; FAILED=1
    else
      echo "skip (not set): $KEY"
    fi
    continue
  fi
  if $DRY_RUN; then
    echo "would put (SecureString): $NAME"
  else
    aws ssm put-parameter --name "$NAME" --type SecureString \
      --value "$VALUE" --overwrite --region "$AWS_REGION" \
      --output none && echo "put (SecureString): $NAME"
  fi
done

if [[ $FAILED -ne 0 ]]; then
  echo "ERROR: required secrets missing from $ENV_FILE — nothing partial was uploaded." >&2
  exit 1
fi
echo "Done. Names only — values were never printed."
