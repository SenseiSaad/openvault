#!/usr/bin/env bash
# Safe parser for deploy.config. It accepts only known KEY=value lines and
# never evaluates the file as shell code.

load_deploy_config() {
  local root="${OPENVAULT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
  local config="${OPENVAULT_DEPLOY_CONFIG:-$root/deploy.config}"
  local line key value

  if [[ ! -f "$config" ]]; then
    cp "$root/deploy.config.example" "$config"
    echo "Created $config from deploy.config.example. Fill its required fields, then rerun." >&2
    return 2
  fi

  AWS_REGION="" DOMAIN="" SUBDOMAIN="" ALERT_EMAIL="" FROM_EMAIL_LOCAL_PART="" GITHUB_REPO=""
  ENVIRONMENT="" BEDROCK_MODEL_ARNS=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" == *=* ]] || { echo "Invalid deploy.config line; expected KEY=value." >&2; return 2; }
    key="${line%%=*}"
    value="${line#*=}"
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    case "$key" in
      AWS_REGION|DOMAIN|SUBDOMAIN|ALERT_EMAIL|FROM_EMAIL_LOCAL_PART|GITHUB_REPO|ENVIRONMENT|BEDROCK_MODEL_ARNS)
        printf -v "$key" '%s' "$value"
        ;;
      *) echo "Unknown deploy.config key: $key" >&2; return 2 ;;
    esac
  done < "$config"

  local missing=0 name
  for name in AWS_REGION DOMAIN SUBDOMAIN ALERT_EMAIL FROM_EMAIL_LOCAL_PART GITHUB_REPO ENVIRONMENT; do
    if [[ -z "${!name}" ]]; then
      echo "deploy.config is missing $name." >&2
      missing=1
    fi
  done
  (( missing == 0 )) || return 2

  [[ "$AWS_REGION" =~ ^[a-z]{2}(-gov)?-[a-z]+-[0-9]+$ ]] || { echo "AWS_REGION must look like a valid AWS region name." >&2; return 2; }
  [[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ && "$DOMAIN" == *.* ]] || { echo "DOMAIN must be the parent DNS name you control (not a URL)." >&2; return 2; }
  [[ "$SUBDOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || { echo "SUBDOMAIN must contain DNS labels only, without dots at either end." >&2; return 2; }
  [[ "$ALERT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo "ALERT_EMAIL must be a valid email address." >&2; return 2; }
  [[ "$FROM_EMAIL_LOCAL_PART" =~ ^[A-Za-z0-9._+-]+$ ]] || { echo "FROM_EMAIL_LOCAL_PART must be an email local-part without @ or whitespace." >&2; return 2; }
  [[ "$GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "GITHUB_REPO must be owner/repository." >&2; return 2; }
  [[ "$ENVIRONMENT" == staging || "$ENVIRONMENT" == prod ]] || { echo "ENVIRONMENT must be staging or prod; staging is the default." >&2; return 2; }

  export AWS_REGION DOMAIN SUBDOMAIN ALERT_EMAIL FROM_EMAIL_LOCAL_PART GITHUB_REPO ENVIRONMENT BEDROCK_MODEL_ARNS
  export OPENVAULT_ROOT="$root"
}

environment_domain() {
  local env="${1:?environment required}"
  if [[ "$env" == staging ]]; then
    printf 'staging.%s.%s' "$SUBDOMAIN" "$DOMAIN"
  else
    printf '%s.%s' "$SUBDOMAIN" "$DOMAIN"
  fi
}

tf_quote() {
  jq -Rn --arg value "$1" '$value'
}

write_environment_tfvars() {
  local env="$1" host owner model_json subjects_json dmarc github_environment from_email
  host="$(environment_domain "$env")"
  from_email="${FROM_EMAIL_LOCAL_PART}@${host}"
  owner="${GITHUB_REPO%%/*}"
  github_environment="$env"
  [[ "$env" == prod ]] && github_environment=production
  model_json="$(jq -Rn --arg csv "$BEDROCK_MODEL_ARNS" '$csv | split(",") | map(select(length > 0))')"
  subjects_json="$(jq -cn --arg repo "$GITHUB_REPO" --arg env "$github_environment" '[
    ("repo:" + $repo + ":ref:refs/heads/main"),
    ("repo:" + $repo + ":pull_request"),
    ("repo:" + $repo + ":environment:" + $env)
  ]')"
  dmarc="v=DMARC1; p=none; rua=mailto:${ALERT_EMAIL}"

  cat > "$OPENVAULT_ROOT/infra/envs/$env/terraform.tfvars" <<EOF
region = $(tf_quote "$AWS_REGION")
domain = $(tf_quote "$host")
owner = $(tf_quote "$owner")
alert_email = $(tf_quote "$ALERT_EMAIL")
from_email = $(tf_quote "$from_email")
bedrock_model_arns = $model_json
oidc_allowed_subjects = $subjects_json
dmarc_record = $(tf_quote "$dmarc")
initial_image_tag = "bootstrap"
EOF
}

write_backend_config() {
  local env="$1" account_id="$2" prefix bucket lock_table
  prefix="ov-${account_id}"
  bucket="${prefix}-tfstate"
  lock_table="${prefix}-tf-locks"
  cat > "$OPENVAULT_ROOT/infra/envs/$env/backend.tfbackend" <<EOF
bucket         = "$bucket"
key            = "envs/$env/terraform.tfstate"
region         = "$AWS_REGION"
dynamodb_table = "$lock_table"
encrypt        = true
EOF
}
