#!/usr/bin/env bash
# Verify a local env file has every required variable non-empty and prints a
# name-only report.   ./scripts/check_env.sh .env.production
set -euo pipefail
ENV_FILE="${1:?usage: check_env.sh <env-file>}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

REQUIRED=(SECRET_KEY DATABASE_URL LLM_KEY_ENCRYPTION_KEY DOMAIN
          POSTGRES_PASSWORD EMAIL_HOST EMAIL_HOST_USER EMAIL_HOST_PASSWORD
          DEFAULT_FROM_EMAIL)
OPTIONAL=(SENTRY_DSN BEDROCK_API_KEY GEMINI_API_KEY OPENAI_API_KEY
          ANTHROPIC_API_KEY BOOTSTRAP_PLATFORM_ADMIN_EMAIL
          BOOTSTRAP_PLATFORM_ADMIN_PASSWORD)

MISSING=0
echo "=== required ==="
for KEY in "${REQUIRED[@]}"; do
  if grep -qE "^[[:space:]]*${KEY}=..+" "$ENV_FILE"; then
    echo "ok:      $KEY"
  else
    echo "MISSING: $KEY"; MISSING=1
  fi
done
echo "=== optional ==="
for KEY in "${OPTIONAL[@]}"; do
  if grep -qE "^[[:space:]]*${KEY}=..+" "$ENV_FILE"; then
    echo "set:     $KEY"
  else
    echo "unset:   $KEY"
  fi
done
exit $MISSING
