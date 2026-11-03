#!/usr/bin/env bash
# Deploy one immutable image tag to an ECS Fargate environment.
#
#   ./scripts/deploy_ecs.sh prod  <git-sha>
#   ./scripts/deploy_ecs.sh staging <git-sha>
#
# Order: register task definitions -> run the one-off migrate task -> update
# api/worker/web -> wait for stability -> smoke test. Migrations never run at
# container start. ECS deployment circuit breaker is enabled in Terraform; this
# script also restores the previous task definitions if an update fails.
#
# Required env: ECR_REGISTRY, ECS_CLUSTER, PUBLIC_BASE_URL, AWS_REGION.
# Everything else has an openvault-<env> default.
set -euo pipefail

ENV_NAME="${1:?usage: deploy_ecs.sh <staging|prod> <image-tag>}"
IMAGE_TAG="${2:?usage: deploy_ecs.sh <staging|prod> <image-tag>}"

case "$ENV_NAME" in
  staging) PREFIX="openvault-stg" ;;
  prod)    PREFIX="openvault-prod" ;;
  *) echo "env must be staging or prod" >&2; exit 2 ;;
esac

export AWS_REGION="${AWS_REGION:?AWS_REGION must come from deploy.config or the GitHub repository variable}"
ECS_CLUSTER="${ECS_CLUSTER:-${PREFIX}-cluster}"
API_SERVICE="${API_SERVICE:-api}"
WEB_SERVICE="${WEB_SERVICE:-web}"
WORKER_SERVICE="${WORKER_SERVICE:-worker}"
API_TASK_FAMILY="${API_TASK_FAMILY:-${PREFIX}-api}"
WEB_TASK_FAMILY="${WEB_TASK_FAMILY:-${PREFIX}-web}"
WORKER_TASK_FAMILY="${WORKER_TASK_FAMILY:-${PREFIX}-worker}"
MIGRATE_TASK_FAMILY="${MIGRATE_TASK_FAMILY:-${PREFIX}-migrate}"
BACKUP_TASK_FAMILY="${BACKUP_TASK_FAMILY:-${PREFIX}-backup}"
BACKUP_RULE="${BACKUP_RULE:-${PREFIX}-nightly-db-backup}"
ECR_API_REPOSITORY="${ECR_API_REPOSITORY:-${PREFIX}-api}"
ECR_WEB_REPOSITORY="${ECR_WEB_REPOSITORY:-${PREFIX}-web}"
ALLOW_MISSING_CLUSTER="${ALLOW_MISSING_CLUSTER:-0}"
REQUIRE_AUTH_SMOKE="${REQUIRE_AUTH_SMOKE:-0}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"

: "${ECR_REGISTRY:?ECR_REGISTRY is required (e.g. 123456789012.dkr.ecr.ap-south-1.amazonaws.com)}"
: "${PUBLIC_BASE_URL:?PUBLIC_BASE_URL is required}"

API_IMAGE="${ECR_REGISTRY}/${ECR_API_REPOSITORY}:${IMAGE_TAG}"
WEB_IMAGE="${ECR_REGISTRY}/${ECR_WEB_REPOSITORY}:${IMAGE_TAG}"

echo "[deploy] env=$ENV_NAME cluster=$ECS_CLUSTER tag=$IMAGE_TAG"
if ! aws ecs describe-clusters --clusters "$ECS_CLUSTER" --region "$AWS_REGION" \
  --query 'clusters[0].status' --output text 2>/dev/null | grep -qx ACTIVE; then
  if [[ "$ALLOW_MISSING_CLUSTER" == "1" ]]; then
    echo "[deploy] cluster $ECS_CLUSTER does not exist; skipping (staging not created yet)."
    exit 0
  fi
  echo "[deploy] cluster $ECS_CLUSTER is not ACTIVE" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

register_task() {
  local family="$1" image="$2" out="$3"
  aws ecs describe-task-definition --task-definition "$family" --region "$AWS_REGION" \
    --query 'taskDefinition' --output json > "$TMP/td.json"
  python3 - "$TMP/td.json" "$image" "$out" <<'PY'
import json, sys
src, image, out = sys.argv[1], sys.argv[2], sys.argv[3]
td = json.load(open(src))
for c in td.get("containerDefinitions", []):
    c["image"] = image
keep = (
    "family", "taskRoleArn", "executionRoleArn", "networkMode",
    "containerDefinitions", "volumes", "placementConstraints",
    "requiresCompatibilities", "cpu", "memory", "runtimePlatform",
    "ephemeralStorage", "proxyConfiguration", "pidMode", "ipcMode",
)
clean = {k: td[k] for k in keep if k in td}
json.dump(clean, open(out, "w"))
PY
  aws ecs register-task-definition --cli-input-json "file://$out" --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' --output text
}

echo "[deploy] registering task definitions"
API_ARN="$(register_task "$API_TASK_FAMILY" "$API_IMAGE" "$TMP/api.json")"
WEB_ARN="$(register_task "$WEB_TASK_FAMILY" "$WEB_IMAGE" "$TMP/web.json")"
WORKER_ARN="$(register_task "$WORKER_TASK_FAMILY" "$API_IMAGE" "$TMP/worker.json")"
MIGRATE_ARN="$(register_task "$MIGRATE_TASK_FAMILY" "$API_IMAGE" "$TMP/migrate.json")"
BACKUP_ARN="$(register_task "$BACKUP_TASK_FAMILY" "$API_IMAGE" "$TMP/backup.json")"
echo "[deploy] api=$API_ARN"
echo "[deploy] web=$WEB_ARN"

# The nightly EventBridge target pins a task-definition revision. Point it at
# the revision just registered so backups keep running the current image.
if aws events describe-rule --name "$BACKUP_RULE" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws events list-targets-by-rule --rule "$BACKUP_RULE" --region "$AWS_REGION" \
    --query 'Targets[0]' --output json > "$TMP/backup-target.json"
  python3 - "$TMP/backup-target.json" "$BACKUP_ARN" "$TMP/backup-target-new.json" <<'PY'
import json, sys
src, arn, out = sys.argv[1:4]
target = json.load(open(src))
target.setdefault("EcsParameters", {})["TaskDefinitionArn"] = arn
json.dump({"Targets": [target]}, open(out, "w"))
PY
  aws events put-targets --rule "$BACKUP_RULE" --region "$AWS_REGION" \
    --cli-input-json "file://$TMP/backup-target-new.json" >/dev/null
  echo "[deploy] nightly backup target -> $BACKUP_ARN"
else
  echo "[deploy] no $BACKUP_RULE (nightly backup disabled)"
fi

if [[ "$SKIP_MIGRATE" == "1" ]]; then
  echo "[deploy] SKIP_MIGRATE=1 (rollback): not running migrations"
else
  echo "[deploy] running one-off migrate task"
  NETCFG="$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$API_SERVICE" \
    --region "$AWS_REGION" --query 'services[0].networkConfiguration.awsvpcConfiguration' --output json)"
  SUBNETS="$(python3 -c 'import json,sys; print(",".join(json.load(sys.stdin)["subnets"]))' <<<"$NETCFG")"
  SGS="$(python3 -c 'import json,sys; print(",".join(json.load(sys.stdin)["securityGroups"]))' <<<"$NETCFG")"
  TASK_ARN="$(aws ecs run-task --cluster "$ECS_CLUSTER" --task-definition "$MIGRATE_ARN" \
    --launch-type FARGATE --region "$AWS_REGION" \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SGS}],assignPublicIp=ENABLED}" \
    --query 'tasks[0].taskArn' --output text)"
  echo "[deploy] migrate task $TASK_ARN"
  aws ecs wait tasks-stopped --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN" --region "$AWS_REGION"
  EXIT_CODE="$(aws ecs describe-tasks --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN" \
    --region "$AWS_REGION" --query 'tasks[0].containers[0].exitCode' --output text)"
  if [[ "$EXIT_CODE" != "0" ]]; then
    echo "[deploy] migration FAILED (exit $EXIT_CODE). Services were not updated." >&2
    echo "[deploy] inspect: /openvault/${ENV_NAME}/migrate in CloudWatch" >&2
    exit 1
  fi
fi

prev_task() {
  aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$1" --region "$AWS_REGION" \
    --query 'services[0].taskDefinition' --output text
}
PREV_API="$(prev_task "$API_SERVICE")"
PREV_WEB="$(prev_task "$WEB_SERVICE")"
PREV_WORKER="$(prev_task "$WORKER_SERVICE")"
ROLLBACK_NEEDED=0
rollback() {
  local rc=$?
  if [[ "$ROLLBACK_NEEDED" == "1" ]]; then
    echo "[deploy] update failed; restoring previous task definitions" >&2
    aws ecs update-service --cluster "$ECS_CLUSTER" --service "$API_SERVICE" --task-definition "$PREV_API" --region "$AWS_REGION" >/dev/null || true
    aws ecs update-service --cluster "$ECS_CLUSTER" --service "$WEB_SERVICE" --task-definition "$PREV_WEB" --region "$AWS_REGION" >/dev/null || true
    aws ecs update-service --cluster "$ECS_CLUSTER" --service "$WORKER_SERVICE" --task-definition "$PREV_WORKER" --region "$AWS_REGION" >/dev/null || true
  fi
  exit "$rc"
}
trap rollback ERR

ROLLBACK_NEEDED=1
echo "[deploy] updating services"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$API_SERVICE" \
  --task-definition "$API_ARN" --region "$AWS_REGION" >/dev/null
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$WORKER_SERVICE" \
  --task-definition "$WORKER_ARN" --region "$AWS_REGION" >/dev/null
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$WEB_SERVICE" \
  --task-definition "$WEB_ARN" --region "$AWS_REGION" >/dev/null

echo "[deploy] waiting for services to stabilize (circuit breaker will roll back a bad task)"
aws ecs wait services-stable --cluster "$ECS_CLUSTER" \
  --services "$API_SERVICE" "$WORKER_SERVICE" "$WEB_SERVICE" --region "$AWS_REGION"

# services-stable can be true after the circuit breaker restored the OLD task
# definition. Verify we are actually on the revisions we just registered.
check_taskdef() {
  local service="$1" expected="$2" current
  current="$(prev_task "$service")"
  if [[ "$current" != "$expected" ]]; then
    echo "[deploy] $service is on $current, expected $expected (circuit breaker rollback?)" >&2
    return 1
  fi
}
check_taskdef "$API_SERVICE" "$API_ARN"
check_taskdef "$WORKER_SERVICE" "$WORKER_ARN"
check_taskdef "$WEB_SERVICE" "$WEB_ARN"

echo "[deploy] smoke test"
BASE_URL="$PUBLIC_BASE_URL" REQUIRE_AUTH_SMOKE="$REQUIRE_AUTH_SMOKE" \
  "$(cd "$(dirname "$0")" && pwd)/smoke_test.sh"

# Only now is the update considered successful. If the smoke test failed, the
# ERR trap above restores the previous task definitions.
ROLLBACK_NEEDED=0
trap - ERR
echo "[deploy] done: $IMAGE_TAG"
