#!/usr/bin/env bash
# Validate the local secrets file before pushing it to SSM. Prints variable
# NAMES only; never prints values. Usage:
#   ./scripts/check_env.sh [prod|staging]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_NAME="${1:-prod}"
ENV_FILE="${ENV_FILE:-.env.production}"
MANIFEST="infra/secrets-manifest.yaml"
[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE (copy .env.production.example)" >&2; exit 1; }
[[ -f "$MANIFEST" ]] || { echo "missing $MANIFEST" >&2; exit 1; }

if git ls-files --error-unmatch "$ENV_FILE" >/dev/null 2>&1; then
  echo "$ENV_FILE is TRACKED by git; remove it from the index before continuing" >&2
  exit 1
fi
if ! git check-ignore -q "$ENV_FILE"; then
  echo "WARN: $ENV_FILE is not matched by .gitignore; add it before committing" >&2
fi

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

missing=0
for name in $(section required_secrets); do
  value="$(eval "printf '%s' \"\${$name-}\"")"
  if [[ -z "$value" ]]; then
    echo "MISSING $name" >&2
    missing=1
  elif [[ "$value" == *"CHANGE_ME"* || "$value" == *"REPLACE_ME"* || "$value" == *"<"*">"* ]]; then
    echo "PLACEHOLDER $name" >&2
    missing=1
  elif [[ "$value" == *" "* && "$name" != "BOOTSTRAP_PLATFORM_ADMIN_EMAIL" && "$name" != "DATABASE_URL" ]]; then
    echo "WARN $name contains whitespace; quote it in $ENV_FILE" >&2
  fi
done
for name in $(section optional_secrets); do
  value="$(eval "printf '%s' \"\${$name-}\"")"
  [[ -z "$value" ]] && echo "OPTIONAL $name is empty (disabled)"
done

if [[ "$missing" != "0" ]]; then
  echo "Fix the missing/placeholder values above. No values were printed." >&2
  exit 1
fi

DATABASE_URL_VALUE="${DATABASE_URL:-}"
case "$DATABASE_URL_VALUE" in
  postgres://*|postgresql://*) ;;
  *) echo "DATABASE_URL must start with postgresql:// or postgres://" >&2; exit 1 ;;
esac
if [[ "$DATABASE_URL_VALUE" == *localhost* || "$DATABASE_URL_VALUE" == *127.0.0.1* ]]; then
  echo "WARN DATABASE_URL points at localhost; production should use the RDS endpoint" >&2
fi
if [[ -n "${BEDROCK_API_KEY:-}" ]]; then
  echo "WARN BEDROCK_API_KEY is set; ECS should use the task role. Leave it blank." >&2
fi

echo "OK: $ENV_FILE has every required secret for /openvault/$ENV_NAME/"
