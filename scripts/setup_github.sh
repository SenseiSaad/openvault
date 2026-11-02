#!/usr/bin/env bash
# One-time GitHub repo setup for the OpenVault delivery pipeline.
# Requires: gh CLI authenticated, repo pushed to GitHub.
#
#   ./scripts/setup_github.sh <owner/repo>
set -euo pipefail
REPO="${1:?usage: setup_github.sh <owner/repo>}"

echo "== Environments =="
gh api "repos/$REPO/environments/staging" -X PUT >/dev/null 2>&1 || true
# Production requires manual approval (required reviewer = you).
gh api "repos/$REPO/environments/production" -X PUT \
  -F required_reviewers='[{"type":"User","id":'"$(gh api user --jq .id)"'}]' \
  -F deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' >/dev/null
# Terraform apply environments (separate from app deploys)
gh api "repos/$REPO/environments/terraform-staging" -X PUT >/dev/null
gh api "repos/$REPO/environments/terraform-prod" -X PUT \
  -F required_reviewers='[{"type":"User","id":'"$(gh api user --jq .id)"'}]' \
  -F deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' >/dev/null

echo "== Branch protection on main (require PR + checks, no required review) =="
MAIN_CHECKS='["lint","test","security","frontend","images","terraform"]'
gh api "repos/$REPO/branches/main/protection" -X PUT --input - <<BODY
{
  "required_status_checks": {"strict": true, "contexts": $MAIN_CHECKS},
  "enforce_admins": false,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
BODY

echo "== Tag protection (v*) via ruleset =="
# Classic tag protection is not in the branch-protection API; use rulesets.
RULESET=$(cat <<JSON
{
  "name": "protect-release-tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["refs/tags/v*"], "exclude": []}},
  "rules": [{"type": "deletion"}, {"type": "non_fast_forward"}],
  "bypass_actors": []
}
JSON
)
gh api "repos/$REPO/rulesets" -X POST --input - <<<"$RULESET" >/dev/null

echo "== Done =="
cat <<'NOTES'
Manual steps (web UI):
1. Settings -> Environments -> production: confirm you are the required reviewer.
2. Settings -> Secrets and variables -> Actions -> Variables tab, add:
   AWS_REGION, ECS_CLUSTER, ECR_REGISTRY, DEPLOY_ROLE_ARN,
   TERRAFORM_PLAN_ROLE_ARN, TERRAFORM_APPLY_ROLE_ARN,
   PROD_DOMAIN, STAGING_DOMAIN, STAGING_CLUSTER, TF_STATE_BUCKET, TF_LOCK_TABLE,
   BEDROCK_MODEL_ARNS (comma-separated), TF_VAR_DOMAIN.
3. Settings -> Secrets and variables -> Actions -> Secrets tab (ONLY if a value
   must stay masked in logs; prefer OIDC + SSM over repo secrets).
NOTES
