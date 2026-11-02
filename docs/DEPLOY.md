# Deploy — first-time checklist and ongoing delivery

Canonical path: **AWS ap-south-1, ECS Fargate + RDS + ElastiCache + S3 + ALB**,
Terraform in `infra/`, delivery via GitHub Actions (OIDC, no static keys).

## One-time setup (in order)

1. **Bootstrap Terraform state** (local apply, one bucket + one lock table):
   ```bash
   cd infra/bootstrap && terraform init && terraform apply
   ```
2. **GitHub repo wiring**: `./scripts/setup_github.sh <owner/repo>`; then add the
   Actions VARIABLES it lists (AWS_REGION, ECS_CLUSTER, ECR_REGISTRY,
   DEPLOY_ROLE_ARN, TERRAFORM_*_ROLE_ARN, PROD_DOMAIN, STAGING_DOMAIN, ...).
3. **DNS delegation**: after `terraform apply` of an environment, take the
   `name_servers` output and create NS records for `v2.<your-domain>` at your
   current DNS provider. The live site is untouched.
4. **SES**: verify the domain identity (Terraform creates the DKIM/SPF/DMARC
   records), request production access in the SES console, create the SMTP user
   (IAM user with `ses:SendRawEmail`), store credentials in SSM via
   `scripts/push_env_to_ssm.sh`.
5. **Bedrock model access** (console): Bedrock → Model access → Enable:
   `anthropic.claude-haiku-4-5` (or the India `in.` inference profile you
   configure) and `amazon.titan-embed-text-v2:0`. The task-role IAM policy
   allows ONLY the ARNs you pass as `bedrock_model_arns`. The app logs
   `event=llm_error` if a model isn't enabled — that's your readiness signal.
6. **Secrets**: `cp .env.production.example .env.production`, fill it
   (`scripts/check_env.sh .env.production` verifies), then
   `./scripts/push_env_to_ssm.sh prod`.
   `DATABASE_URL` = `postgres://openvault:<password>@<db_endpoint>:5432/openvault`
   where `<password>` comes from
   `aws secretsmanager get-secret-value --secret-id <db_master_secret_arn output>`.
7. **First images**: push once so the initial apply has images to run:
   `aws ecr get-login-password | docker login ...` then build/tag/push
   `openvault-api:bootstrap` and `openvault-web:bootstrap` (see `outputs.ecr_repositories`).
8. **Plan → apply**: staging first
   (`terraform -chdir=infra/envs/staging plan` → `apply`), verify the site, then
   prod (or use the `terraform-apply.yml` workflow with its protected environment).
9. **Run the migrate task** once (deploy.yml does this on every deploy;
   first time: `aws ecs run-task --task-definition openvault-prod-migrate ...`).
10. **Smoke test** (the deploy workflow does this): `/api/health/live`,
    `/api/health`, login page, one authenticated ask.
11. **Cutover**: switch your users to `https://v2.<domain>`. Keep the old
    deployment frozen until the new one has run for a week.

## Ongoing delivery

* PR → CI (tests, coverage gate, bandit, pip-audit, gitleaks, Trivy, tflint,
  checkov, terraform plan comment).
* Merge to `main` → images tagged with the commit SHA → migrate task → ECS
  rolling deploy with the circuit breaker → smoke test → auto-rollback on failure.
* Rollback: run the `Rollback` workflow with the previous commit SHA tag.
* Releases: tag `vX.Y.Z` (protected); the tag is your rollback bookend.

## Tear staging down

```bash
cd infra/envs/staging && terraform destroy
```
Nothing in prod is touched. Recreate any time with `terraform apply`.
