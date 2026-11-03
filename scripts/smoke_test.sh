#!/usr/bin/env bash
# End-to-end HTTP smoke test: health, signup/verification, login, upload, cited
# answer, and logout. Production CI may use SMOKE_TEST_MODE=existing with a
# pre-verified dedicated account; interactive signup mode tests email tokens.
# Usage: scripts/smoke_test.sh <url>
set -Eeuo pipefail
umask 077

BASE_URL="${1:-${BASE_URL:-}}"
BASE_URL="${BASE_URL%/}"
[[ "$BASE_URL" =~ ^https?://[^/]+$ ]] || { echo "Usage: smoke_test.sh <https-url>" >&2; exit 2; }
SMOKE_TEST_MODE="${SMOKE_TEST_MODE:-signup}"
DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-unknown}"
ALLOW_EMAIL_VERIFICATION_BYPASS="${ALLOW_EMAIL_VERIFICATION_BYPASS:-0}"
REQUIRE_AUTH_SMOKE="${REQUIRE_AUTH_SMOKE:-0}"
[[ "$SMOKE_TEST_MODE" == signup || "$SMOKE_TEST_MODE" == existing ]] || { echo "SMOKE_TEST_MODE must be signup or existing." >&2; exit 2; }
if [[ "$REQUIRE_AUTH_SMOKE" == 1 && ( -z "${SMOKE_TEST_EMAIL:-}" || -z "${SMOKE_TEST_PASSWORD:-}" ) ]]; then
  echo "Production smoke requires SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD." >&2
  exit 1
fi
if [[ "$ALLOW_EMAIL_VERIFICATION_BYPASS" == 1 && "$DEPLOY_ENVIRONMENT" != staging ]]; then
  echo "Email-verification bypass is permitted only for staging." >&2
  exit 2
fi

for tool in curl jq python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Required tool '$tool' is missing." >&2; exit 1; }
done

SMOKE_EMAIL="${SMOKE_TEST_EMAIL:-}"
SMOKE_PASSWORD="${SMOKE_TEST_PASSWORD:-}"
if [[ -z "$SMOKE_EMAIL" ]]; then
  [[ -t 0 ]] || { echo "SMOKE_TEST_EMAIL is required in non-interactive mode." >&2; exit 1; }
  read -r -p "Smoke-test account email: " SMOKE_EMAIL
fi
if [[ -z "$SMOKE_PASSWORD" ]]; then
  [[ -t 0 ]] || { echo "SMOKE_TEST_PASSWORD is required in non-interactive mode." >&2; exit 1; }
  read -r -s -p "Smoke-test account password (hidden): " SMOKE_PASSWORD
  printf '\n'
fi
[[ -n "$SMOKE_EMAIL" && -n "$SMOKE_PASSWORD" ]] || { echo "Smoke-test email/password must be nonempty." >&2; exit 1; }

TMP="$(mktemp -d)"
chmod 700 "$TMP"
JAR="$TMP/cookies.txt"
touch "$JAR"
chmod 600 "$JAR"
DOC_ID=""
AUTHENTICATED=0
cleanup() {
  if [[ "$AUTHENTICATED" == 1 && -n "$DOC_ID" ]]; then
    curl -sS --max-time 15 -b "$JAR" -X DELETE "$BASE_URL/api/documents/$DOC_ID" -o /dev/null || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "[smoke] liveness and readiness"
LIVE="$(curl -fsS --max-time 20 "$BASE_URL/api/health/live")"
jq -e '.status == "ok"' <<<"$LIVE" >/dev/null || { echo "Liveness check failed." >&2; exit 1; }
HEALTH="$(curl -fsS --max-time 30 "$BASE_URL/api/health")"
jq -e '.status == "ok" and .db == true and .storage == true' <<<"$HEALTH" >/dev/null || {
  echo "Readiness check failed (database/storage)." >&2
  exit 1
}
echo "[smoke] frontend"
FRONTEND_CODE="$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' "$BASE_URL/")"
[[ "$FRONTEND_CODE" == 200 ]] || { echo "Frontend returned HTTP $FRONTEND_CODE." >&2; exit 1; }

ACCOUNT_EMAIL="$SMOKE_EMAIL"
if [[ "$SMOKE_TEST_MODE" == signup ]]; then
  echo "[smoke] signup"
  REQUEST="$(SMOKE_EMAIL="$ACCOUNT_EMAIL" SMOKE_PASSWORD="$SMOKE_PASSWORD" python3 - <<'PY'
import json, os
print(json.dumps({
  "company_name": "OpenVault Smoke Test",
  "admin_name": "OpenVault Smoke Test",
  "email": os.environ["SMOKE_EMAIL"],
  "password": os.environ["SMOKE_PASSWORD"],
}))
PY
  )"
  printf '%s' "$REQUEST" > "$TMP/signup.json"
  unset REQUEST
  SIGNUP_CODE="$(curl -sS --max-time 30 -o "$TMP/signup-response.json" -w '%{http_code}' \
    -c "$JAR" -H 'Content-Type: application/json' \
    --data-binary "@$TMP/signup.json" "$BASE_URL/api/auth/register")"
  case "$SIGNUP_CODE" in
    201)
      echo "[smoke] signup created an account"
      if [[ "$ALLOW_EMAIL_VERIFICATION_BYPASS" != 1 ]]; then
      echo "[smoke] email verification"
        VERIFY_REQUEST="$(SMOKE_EMAIL="$ACCOUNT_EMAIL" python3 - <<'PY'
import json, os
print(json.dumps({"email": os.environ["SMOKE_EMAIL"]}))
PY
        )"
        printf '%s' "$VERIFY_REQUEST" > "$TMP/request-verification.json"
        unset VERIFY_REQUEST
        curl -sS --max-time 20 -o /dev/null -H 'Content-Type: application/json' \
          --data-binary "@$TMP/request-verification.json" "$BASE_URL/api/auth/request-verification" || true
        VERIFY_TOKEN="${SMOKE_TEST_VERIFICATION_TOKEN:-}"
        if [[ -z "$VERIFY_TOKEN" ]]; then
          [[ -t 0 ]] || { echo "The verification token must be retrieved from the smoke mailbox and supplied as SMOKE_TEST_VERIFICATION_TOKEN (email bypass is staging-only)." >&2; exit 1; }
          read -r -s -p "Paste the token from the verification email (hidden): " VERIFY_TOKEN
          printf '\n'
        fi
        VERIFY_JSON="$(VERIFY_TOKEN="$VERIFY_TOKEN" python3 - <<'PY'
import json, os
print(json.dumps({"token": os.environ["VERIFY_TOKEN"]}))
PY
        )"
        printf '%s' "$VERIFY_JSON" > "$TMP/verify.json"
        unset VERIFY_JSON VERIFY_TOKEN
        VERIFY_CODE="$(curl -sS --max-time 20 -o "$TMP/verify-response.json" -w '%{http_code}' \
          -H 'Content-Type: application/json' --data-binary "@$TMP/verify.json" \
          "$BASE_URL/api/auth/verify")"
        [[ "$VERIFY_CODE" == 200 ]] || { echo "Email verification failed (HTTP $VERIFY_CODE)." >&2; exit 1; }
      else
        echo "[smoke] verification bypass accepted for staging only"
      fi
      ;;
    400)
      DETAIL="$(jq -r '.detail // ""' "$TMP/signup-response.json")"
      [[ "$DETAIL" == "Email already registered." ]] || { echo "Signup failed validation (HTTP 400)." >&2; exit 1; }
      echo "[smoke] smoke account already exists; continuing with login"
      ;;
    *) echo "Signup failed (HTTP $SIGNUP_CODE)." >&2; exit 1 ;;
  esac
fi

echo "[smoke] login"
LOGIN_REQUEST="$(SMOKE_EMAIL="$ACCOUNT_EMAIL" SMOKE_PASSWORD="$SMOKE_PASSWORD" python3 - <<'PY'
import json, os
print(json.dumps({"email": os.environ["SMOKE_EMAIL"], "password": os.environ["SMOKE_PASSWORD"]}))
PY
)"
printf '%s' "$LOGIN_REQUEST" > "$TMP/login.json"
unset LOGIN_REQUEST
LOGIN_CODE="$(curl -sS --max-time 30 -o "$TMP/login-response.json" -w '%{http_code}' \
  -c "$JAR" -b "$JAR" -H 'Content-Type: application/json' \
  --data-binary "@$TMP/login.json" "$BASE_URL/api/auth/login")"
[[ "$LOGIN_CODE" == 200 ]] || { echo "Login failed (HTTP $LOGIN_CODE)." >&2; exit 1; }
jq -e '.mfa_required != true and (.user.email | type == "string")' "$TMP/login-response.json" >/dev/null || {
  echo "Smoke account must be a verified company account, not a platform admin requiring MFA." >&2
  exit 1
}
AUTHENTICATED=1

echo "[smoke] upload a small text document"
FILENAME="openvault-smoke-$(date +%s).txt"
cat > "$TMP/$FILENAME" <<'EOF'
OpenVault deployment smoke document.
The unique verification phrase in this document is violet comet.
Use this sample only to verify upload, indexing, retrieval, cited answer streaming, and cleanup.
EOF
UPLOAD_CODE="$(curl -sS --max-time 40 -o "$TMP/upload-response.json" -w '%{http_code}' \
  -b "$JAR" -c "$JAR" -F "file=@$TMP/$FILENAME;type=text/plain" \
  -F 'category=Smoke Test' -F 'description=Temporary automated deployment smoke file' \
  -F 'access_scope=company' "$BASE_URL/api/documents/upload")"
[[ "$UPLOAD_CODE" == 201 ]] || { echo "Document upload failed (HTTP $UPLOAD_CODE)." >&2; exit 1; }
DOC_ID="$(jq -er .id "$TMP/upload-response.json")"

echo "[smoke] wait for document indexing"
READY=false
for _ in $(seq 1 45); do
  DOC="$(curl -fsS --max-time 15 -b "$JAR" "$BASE_URL/api/documents/$DOC_ID")"
  INDEX_STATUS="$(jq -r '.indexing_status' <<<"$DOC")"
  if [[ "$INDEX_STATUS" == ready ]] && [[ "$(jq -r '.num_chunks' <<<"$DOC")" -gt 0 ]]; then READY=true; break; fi
  [[ "$INDEX_STATUS" != failed ]] || { echo "Document indexing failed." >&2; exit 1; }
  sleep 2
done
[[ "$READY" == true ]] || { echo "Document did not become indexed before timeout." >&2; exit 1; }

echo "[smoke] ask for an answer with sources"
ASK_REQUEST="$(jq -cn --arg question 'What is the unique verification phrase in the smoke document?' '{question:$question}')"
printf '%s' "$ASK_REQUEST" > "$TMP/ask.json"
unset ASK_REQUEST
curl -sS -N --max-time 360 -b "$JAR" -H 'Content-Type: application/json' \
  --data-binary "@$TMP/ask.json" "$BASE_URL/api/ask" -o "$TMP/ask.ndjson"
jq -se --arg filename "$FILENAME" 'any(.[]; .type == "sources" and (.sources | index($filename) != null))' "$TMP/ask.ndjson" >/dev/null || {
  echo "Ask stream did not cite the uploaded smoke document." >&2; exit 1;
}
jq -se 'any(.[]; .type == "token" and (.token | length > 0))' "$TMP/ask.ndjson" >/dev/null || {
  echo "Ask stream returned no answer tokens." >&2; exit 1;
}
if jq -se 'any(.[]; .type == "error")' "$TMP/ask.ndjson" >/dev/null; then
  echo "Ask stream returned a provider error." >&2; exit 1
fi

echo "[smoke] remove temporary file, then logout"
DELETE_CODE="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' \
  -b "$JAR" -X DELETE "$BASE_URL/api/documents/$DOC_ID")"
[[ "$DELETE_CODE" == 204 ]] || { echo "Could not remove smoke document (HTTP $DELETE_CODE)." >&2; exit 1; }
DOC_ID=""
LOGOUT_CODE="$(curl -sS --max-time 20 -o "$TMP/logout.json" -w '%{http_code}' \
  -b "$JAR" -c "$JAR" -X POST "$BASE_URL/api/auth/logout")"
[[ "$LOGOUT_CODE" == 200 ]] || { echo "Logout failed (HTTP $LOGOUT_CODE)." >&2; exit 1; }
AUTHENTICATED=0
unset SMOKE_PASSWORD
echo "[smoke] all checks passed"
