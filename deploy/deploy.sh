#!/usr/bin/env bash
# OpenVault deploy: the ONE canonical deployment path.
#
# Target: a single AWS EC2 instance (ap-south-1) running docker compose with
# the production file. Prerequisites (one-time):
#   * EC2 with Docker + compose plugin, inbound 80/443, DNS A record -> $DOMAIN
#   * /opt/openvault/.env.production filled in (see docs/PRODUCTION_CHECKLIST.md)
#
#   sudo ./deploy/deploy.sh          # build + migrate + start + verify
#   sudo ./deploy/deploy.sh rollback # previous image tag, see bad-deploy runbook
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE (copy .env.production.example)" >&2; exit 1; }

echo "[deploy] building images"
$COMPOSE build api worker web

echo "[deploy] starting datastore"
$COMPOSE up -d db redis

echo "[deploy] migrations (one-shot service)"
$COMPOSE run --rm migrate

echo "[deploy] starting services"
$COMPOSE up -d api worker web caddy

echo "[deploy] waiting for health"
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:8000/api/health" >/dev/null 2>&1 \
     || curl -fsk "https://${DOMAIN:-localhost}/api/health" >/dev/null 2>&1; then
    echo "[deploy] healthy after ${i}0s"
    $COMPOSE ps
    exit 0
  fi
  sleep 10
done

echo "[deploy] FAILED health check — run: $COMPOSE logs api --tail 50" >&2
exit 1
