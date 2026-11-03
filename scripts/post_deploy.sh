#!/usr/bin/env bash
# Run one-off Fargate management tasks. No passwords/tokens are printed or
# placed in task overrides. Interactive credentials use ECS Exec + getpass.
# Usage: scripts/post_deploy.sh <staging|prod> <migrate|seed|admin|demo|verify-mfa>
set -Eeuo pipefail
umask 077

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: scripts/post_deploy.sh <staging|prod> <migrate|seed|admin|demo|verify-mfa>"
  echo "Creates management work as one-off ECS tasks; admin/demo passwords are entered hidden through ECS Exec."
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OPENVAULT_ROOT="$ROOT"
source "$ROOT/scripts/lib/deploy_config.sh"
load_deploy_config

TARGET_ENV="${1:?usage: post_deploy.sh <staging|prod> <migrate|seed|admin|demo|verify-mfa>}"
ACTION="${2:?usage: post_deploy.sh <staging|prod> <migrate|seed|admin|demo|verify-mfa>}"
[[ "$TARGET_ENV" == staging || "$TARGET_ENV" == prod ]] || { echo "Environment must be staging or prod." >&2; exit 2; }
[[ "$TARGET_ENV" == "$ENVIRONMENT" ]] || { echo "Requested environment differs from deploy.config; reconfigure first." >&2; exit 2; }
[[ "$TARGET_ENV" != prod || "$ACTION" != demo ]] || { echo "Demo data is staging-only." >&2; exit 2; }

CLUSTER=""
ACTIVE_EXEC_TASK=""
cleanup_exec_task() {
  if [[ -n "$ACTIVE_EXEC_TASK" && -n "$CLUSTER" ]]; then
    aws ecs stop-task --cluster "$CLUSTER" --task "$ACTIVE_EXEC_TASK" \
      --reason "OpenVault setup session ended" --region "$AWS_REGION" >/dev/null 2>&1 || true
  fi
}
trap cleanup_exec_task EXIT

ENV_DIR="$ROOT/infra/envs/$TARGET_ENV"
BACKEND_CONFIG="$ENV_DIR/backend.tfbackend"
[[ -f "$BACKEND_CONFIG" ]] || { echo "Backend configuration missing; run scripts/bootstrap.sh first." >&2; exit 1; }
terraform -chdir="$ENV_DIR" init -input=false -backend-config="$BACKEND_CONFIG" >/dev/null

CLUSTER="$(terraform -chdir="$ENV_DIR" output -raw cluster_name)"
TASK_FAMILIES="$(terraform -chdir="$ENV_DIR" output -json task_definition_families)"
SERVICE_NAMES="$(terraform -chdir="$ENV_DIR" output -json service_names)"
MIGRATE_FAMILY="$(jq -er .migrate <<<"$TASK_FAMILIES")"
API_SERVICE="$(jq -er .api <<<"$SERVICE_NAMES")"

NETWORK="$(aws ecs describe-services --cluster "$CLUSTER" --services "$API_SERVICE" \
  --region "$AWS_REGION" --query 'services[0].networkConfiguration.awsvpcConfiguration' --output json)"
SUBNETS="$(jq -er '.subnets | join(",")' <<<"$NETWORK")"
SECURITY_GROUPS="$(jq -er '.securityGroups | join(",")' <<<"$NETWORK")"
ASSIGN_PUBLIC_IP="$(jq -r '.assignPublicIp // "ENABLED"' <<<"$NETWORK")"
NETWORK_ARG="awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=$ASSIGN_PUBLIC_IP}"

command_json() {
  python3 - "$@" <<'PY'
import json, sys
print(json.dumps(sys.argv[1:]))
PY
}

run_management() {
  local task_name="$1"; shift
  local task_arn overrides exit_code
  overrides="$(jq -cn --arg name migrate --argjson command "$(command_json "$@")" \
    '{containerOverrides:[{name:$name,command:$command}]}')"
  task_arn="$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$MIGRATE_FAMILY" \
    --launch-type FARGATE --region "$AWS_REGION" --network-configuration "$NETWORK_ARG" \
    --overrides "$overrides" --query 'tasks[0].taskArn' --output text)"
  [[ -n "$task_arn" && "$task_arn" != None ]] || { echo "Could not start one-off task: $task_name" >&2; return 1; }
  echo "[$task_name] task started; waiting for completion."
  aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$task_arn" --region "$AWS_REGION"
  exit_code="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$task_arn" --region "$AWS_REGION" \
    --query 'tasks[0].containers[0].exitCode' --output text)"
  if [[ "$exit_code" != 0 ]]; then
    echo "[$task_name] task failed (exit ${exit_code:-unknown}); inspect the migrate log group in CloudWatch." >&2
    return 1
  fi
  echo "[$task_name] task completed successfully."
}

run_interactive_management() {
  local task_name="$1" command_name="$2" task_arn overrides result
  command -v session-manager-plugin >/dev/null 2>&1 || {
    echo "session-manager-plugin is required for interactive setup; install it and retry." >&2
    return 1
  }
  overrides="$(jq -cn --arg name migrate '{containerOverrides:[{name:$name,command:["sleep","3600"]}]}')"
  task_arn="$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$MIGRATE_FAMILY" \
    --launch-type FARGATE --enable-execute-command --region "$AWS_REGION" \
    --network-configuration "$NETWORK_ARG" --overrides "$overrides" \
    --query 'tasks[0].taskArn' --output text)"
  [[ -n "$task_arn" && "$task_arn" != None ]] || { echo "Could not start interactive ECS task: $task_name" >&2; return 1; }
  ACTIVE_EXEC_TASK="$task_arn"
  aws ecs wait tasks-running --cluster "$CLUSTER" --tasks "$task_arn" --region "$AWS_REGION"
  echo "[$task_name] Interactive ECS session; typed passwords are hidden by getpass."
  if aws ecs execute-command --cluster "$CLUSTER" --task "$task_arn" --container migrate \
    --interactive --command "python manage.py $command_name" --region "$AWS_REGION"; then
    result=0
  else
    result=$?
  fi
  aws ecs stop-task --cluster "$CLUSTER" --task "$task_arn" \
    --reason "OpenVault $task_name finished" --region "$AWS_REGION" >/dev/null 2>&1 || true
  ACTIVE_EXEC_TASK=""
  return "$result"
}

seed_plans() { run_management "seed-plans" python manage.py seed_plans; }
migrate() { run_management "migrate" python manage.py migrate --noinput; }
create_admin() { run_interactive_management "create-platform-admin" create_platform_admin; }
seed_demo() {
  [[ "$TARGET_ENV" == staging ]] || { echo "Demo data is staging-only." >&2; return 2; }
  run_interactive_management "seed-demo-company" seed_demo_company
}
verify_mfa() {
  local email
  read -r -p "Platform-admin email to verify: " email
  echo "Open https://$(environment_domain "$TARGET_ENV")/auth, sign in, and complete authenticator enrollment."
  read -r -p "After enrollment finishes in the browser, press Enter to verify the database flag: " _
  run_management "verify-platform-admin-mfa" python manage.py verify_platform_admin_mfa "$email"
}

case "$ACTION" in
  migrate)
    migrate
    ;;
  seed)
    seed_plans
    create_admin
    if [[ "$TARGET_ENV" == staging ]]; then
      read -r -p "Create optional sample companies/documents in staging? [y/N] " answer
      if [[ "$answer" == y || "$answer" == Y || "$answer" == yes || "$answer" == YES ]]; then
        seed_demo
      fi
    fi
    ;;
  admin)
    create_admin
    ;;
  demo)
    seed_demo
    ;;
  verify-mfa)
    verify_mfa
    ;;
  *) echo "Action must be migrate, seed, admin, demo, or verify-mfa." >&2; exit 2 ;;
esac
