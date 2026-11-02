#!/usr/bin/env bash
# Post-deploy smoke test. Public checks always run; one authenticated call runs
# when SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD are set. In production set
# REQUIRE_AUTH_SMOKE=1 so a missing smoke account fails the deploy.
#
#   BASE_URL=https://v2.example.com ./scripts/smoke_test.sh
set -euo pipefail

BASE_URL="${BASE_URL:-${1:-}}"
BASE_URL="${BASE_URL%/}"
: "${BASE_URL:?BASE_URL is required}"

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

echo "[smoke] liveness $BASE_URL/api/health/live"
curl -fsS --max-time 15 "$BASE_URL/api/health/live" | grep -q '"status": "ok"'

echo "[smoke] readiness $BASE_URL/api/health"
HEALTH="$(curl -fsS --max-time 20 "$BASE_URL/api/health")"
echo "$HEALTH" | grep -q '"status": "ok"'
echo "$HEALTH" | grep -q '"db": true'
echo "$HEALTH" | grep -q '"storage": true'

echo "[smoke] frontend $BASE_URL/"
curl -fsS --max-time 20 "$BASE_URL/" >/dev/null

if [[ -n "${SMOKE_TEST_EMAIL:-}" && -n "${SMOKE_TEST_PASSWORD:-}" ]]; then
  echo "[smoke] authenticated /api/auth/me as $SMOKE_TEST_EMAIL"
  LOGIN_CODE="$(curl -sS -o /tmp/ov-smoke-login.json -w '%{http_code}' \
    -c "$JAR" -H 'Content-Type: application/json' \
    -X POST "$BASE_URL/api/auth/login" \
    --data "{\"email\":\"$SMOKE_TEST_EMAIL\",\"password\":\"$SMOKE_TEST_PASSWORD\"}")"
  if [[ "$LOGIN_CODE" != "200" ]]; then
    echo "[smoke] login failed with HTTP $LOGIN_CODE" >&2
    exit 1
  fi
  ME="$(curl -fsS --max-time 15 -b "$JAR" "$BASE_URL/api/auth/me")"
  echo "$ME" | grep -q "$SMOKE_TEST_EMAIL"
elif [[ "${REQUIRE_AUTH_SMOKE:-0}" == "1" ]]; then
  echo "[smoke] SMOKE_TEST_EMAIL/SMOKE_TEST_PASSWORD are required but unset" >&2
  exit 1
else
  echo "[smoke] authenticated check skipped (no smoke credentials configured)"
fi

echo "[smoke] OK"
