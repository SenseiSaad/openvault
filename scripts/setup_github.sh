#!/usr/bin/env bash
# One-time GitHub configuration for the OIDC deploy pipeline.
#
# Requires the `gh` CLI authenticated with admin rights on the repo:
#   gh auth login
#   ./scripts/setup_github.sh
#
# Creates: staging + production environments (production requires a reviewer),
# main branch protection, and a v* tag ruleset. It never writes AWS secrets.
# Re-running is safe; GitHub updates the existing settings.
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
USER_ID="${USER_ID:-$(gh api user -q .id)}"
echo "[github] repo=$REPO user_id=$USER_ID"

# ---------------------------------------------------------------- environments
gh api --method PUT "repos/$REPO/environments/staging" \
  --input - >/dev/null <<JSON
{"wait_timer":0,"reviewers":[],"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}
JSON

gh api --method PUT "repos/$REPO/environments/production" \
  --input - >/dev/null <<JSON
{"wait_timer":0,"reviewers":[{"type":"User","id":$USER_ID}],"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}
JSON
echo "[github] environments ready: staging, production (self-review required)"

# ------------------------------------------------------------ branch protection
# The names below match the CI job names. If GitHub shows a different context
# (for example a matrix suffix), adjust the list in the repository UI.
gh api --method PUT "repos/$REPO/branches/main/protection" \
  --input - >/dev/null <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Security scan (bandit + pip-audit + gitleaks)",
      "OpenVault API (checks + tests)",
      "OpenVault web (typecheck + tests + build)",
      "Container build + Trivy image scan",
      "Terraform fmt/validate/tflint/checkov"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false
}
JSON
echo "[github] main branch protected (PR + green CI; no force push)"

# --------------------------------------------------------------- version tags
# Repository rulesets are the current API; fall back to the legacy tag
# protection endpoint on older GitHub Enterprise installations.
gh api --method POST "repos/$REPO/rulesets" --input - >/dev/null <<'JSON' || \
  gh api --method POST "repos/$REPO/tags/protection" -f pattern='v*' >/dev/null || \
  echo "[github] WARN: could not create tag protection; protect v* manually"
{
  "name": "Protect release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["refs/tags/v*"], "exclude": []}},
  "rules": [{"type": "deletion"}, {"type": "update"}, {"type": "non_fast_forward"}]
}
JSON
echo "[github] v* tag ruleset requested"

cat <<'EOF'

Next, set these repository variables (Settings -> Secrets and variables -> Actions
-> Variables). Values are examples; replace the role ARNs and domains.

  AWS_REGION=ap-south-1
  AWS_BUILD_ROLE_ARN=arn:aws:iam::<account>:role/openvault-prod-github-build
  AWS_DEPLOY_ROLE_ARN=arn:aws:iam::<account>:role/openvault-prod-github-deploy
  AWS_DEPLOY_ROLE_ARN_STAGING=arn:aws:iam::<account>:role/openvault-stg-github-deploy
  AWS_TERRAFORM_PLAN_ROLE_ARN=arn:aws:iam::<account>:role/openvault-prod-github-terraform-plan
  AWS_TERRAFORM_APPLY_ROLE_ARN=arn:aws:iam::<account>:role/openvault-prod-github-terraform-apply
  DOMAIN_PROD=<new-subdomain>.example.com
  DOMAIN_STAGING=<new-staging-subdomain>.example.com
  ALERT_EMAIL=<you@example.com>
  PUBLIC_BASE_URL_PROD=https://<new-subdomain>.example.com
  PUBLIC_BASE_URL_STAGING=https://<new-staging-subdomain>.example.com
  ECS_CLUSTER_STAGING=openvault-stg-cluster
  ECR_REGISTRY=<account>.dkr.ecr.ap-south-1.amazonaws.com
  BEDROCK_MODEL_ARNS=["arn:aws:bedrock:ap-south-1:<account>:inference-profile/in.anthropic.claude-haiku-4-5-20251001-v1:0"]
  DMARC_RECORD=v=DMARC1; p=none; rua=mailto:postmaster@<new-subdomain>.example.com
  OIDC_ALLOWED_SUBJECTS=["repo:<owner>/<repo>:ref:refs/heads/main","repo:<owner>/<repo>:pull_request","repo:<owner>/<repo>:environment:staging","repo:<owner>/<repo>:environment:production"]

Environment secrets (staging and production separately):

  SMOKE_TEST_EMAIL=<dedicated smoke-test user>
  SMOKE_TEST_PASSWORD=<password>

Never add AWS access keys. The workflows use OIDC only.
EOF
