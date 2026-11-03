#!/usr/bin/env bash
# Validate names/values without displaying values.
#   scripts/check_env.sh .env.production [--phase preflight|runtime]
set -euo pipefail

ENV_FILE="${1:?usage: check_env.sh <env-file> [--phase preflight|runtime]}"
PHASE="preflight"
if [[ "${2:-}" == "--phase" ]]; then
  PHASE="${3:?--phase requires preflight or runtime}"
elif [[ -n "${2:-}" ]]; then
  echo "usage: check_env.sh <env-file> [--phase preflight|runtime]" >&2
  exit 2
fi
[[ "$PHASE" == preflight || "$PHASE" == runtime ]] || { echo "phase must be preflight or runtime." >&2; exit 2; }
[[ -f "$ENV_FILE" ]] || { echo "Missing environment file: $ENV_FILE" >&2; exit 1; }

value_for() {
  local key="$1"
  awk -F= -v k="$key" '
    /^[[:space:]]*#/ { next }
    $0 ~ "^[[:space:]]*" k "[[:space:]]*=" {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      gsub(/^"|"$/, "")
      gsub(/^\047|\047$/, "")
      print
      exit
    }
  ' "$ENV_FILE"
}

MISSING=0
REQUIRED=(SECRET_KEY LLM_KEY_ENCRYPTION_KEY EMAIL_HOST_USER EMAIL_HOST_PASSWORD)
echo "Checking required secret names (values are never printed):"
for key in "${REQUIRED[@]}"; do
  if [[ -n "$(value_for "$key")" ]]; then
    echo "ok: $key"
  else
    echo "MISSING: $key"
    MISSING=1
  fi
done

if [[ "$PHASE" == runtime ]]; then
  db_url="$(value_for DATABASE_URL)"
  if [[ "$db_url" =~ ^postgres(ql)?://[^[:space:]]+$ ]]; then
    echo "ok: DATABASE_URL (PostgreSQL URL syntax)"
  else
    echo "MISSING/INVALID: DATABASE_URL (set it after the database endpoint is created)"
    MISSING=1
  fi
else
  echo "deferred: DATABASE_URL is supplied after the RDS endpoint is created"
fi

OPTIONAL=(SENTRY_DSN)
for key in "${OPTIONAL[@]}"; do
  if [[ -n "$(value_for "$key")" ]]; then echo "set: $key"; else echo "unset: $key"; fi
done

if (( MISSING )); then
  echo "Environment validation failed; fix the named fields in $ENV_FILE." >&2
  exit 1
fi
echo "Environment validation passed ($PHASE phase)."
