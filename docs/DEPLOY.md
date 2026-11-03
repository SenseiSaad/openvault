# Deploy your own OpenVault

This guide deploys a **new** staging environment first. It never points at the
existing live hostname. No command below is run automatically by this guide;
`scripts/bootstrap.sh` prompts before any Terraform apply.

## Prerequisites

* AWS account with billing enabled and an IAM identity permitted to create the
  stack. The initial bootstrap uses your local AWS CLI credentials.
* GitHub repository with admin access and one human reviewer available for the
  protected deployment environments.
* Parent domain and access to its DNS provider to delegate a new subdomain.
* AWS CLI v2, Terraform `>=1.9`, Docker Engine `>=24` + Buildx, GitHub CLI
  `>=2.45`, `jq >=1.6`, Git `>=2.30`, Python `>=3.12`, and the AWS Session
  Manager plugin (required for hidden interactive password/TOTP setup; exact
  plugin version is **UNVERIFIED** here).

## Manual account steps

These require account-owner interaction and cannot be completed by Terraform:

1. Choose a **new** app subdomain; do not reuse a live hostname.
2. Confirm your DNS provider can create NS records for that subdomain.
3. Request SES production sending access and create SES SMTP credentials after
   the SES identity is verified.
4. Enable the Bedrock chat and embedding models you intend to use; collect the
   exact ARNs for `BEDROCK_MODEL_ARNS`. Access and regional availability are
   **UNVERIFIED** until confirmed in your account.
5. Decide which human GitHub user will review staging and production
   environment deployments.

## One configuration file

Copy the template and fill its fields; `deploy.config` is ignored by git and
parsed as data, not executed as shell code:

```bash
cp deploy.config.example deploy.config
$EDITOR deploy.config
```

Required keys: `AWS_REGION`, `DOMAIN` (parent DNS name), `SUBDOMAIN`,
`ALERT_EMAIL`, `FROM_EMAIL_LOCAL_PART`, `GITHUB_REPO` (`owner/repository`), and
`ENVIRONMENT` (`staging` by default or `prod`). Optional
`BEDROCK_MODEL_ARNS` is a comma-separated list of exact ARNs. Staging's target
host is `staging.<SUBDOMAIN>.<DOMAIN>`; production's is
`<SUBDOMAIN>.<DOMAIN>`. The account ID is discovered from AWS credentials and
is not stored in this file.

Application secrets live separately in ignored `.env.production`:

```bash
cp .env.production.example .env.production
$EDITOR .env.production
```

During preflight, `DATABASE_URL` may remain blank. After RDS is created,
`bootstrap.sh` reads the AWS-managed RDS password without printing it, writes a
URL-encoded PostgreSQL URL to the ignored `.env.production`, validates it, and
pushes the secrets to SSM SecureString. The checker prints parameter names
only.

## Fresh deployment sequence

```bash
./scripts/bootstrap.sh
```

The entry point runs and stops on the first failure:

1. `preflight` — checks tool versions, AWS caller identity/account, region,
   target hostname, local/remote state, and `.env.production`.
2. `configure` — generates ignored per-environment tfvars/backend config from
   `deploy.config`.
3. `bootstrap-infra` — creates the remote state/locking and shared OIDC
   bootstrap resources, creates the staging Route 53 zone, then pauses while
   you delegate its printed NS records at the parent DNS provider. After you
   confirm delegation, it creates staging's base network/data/ECR and zero-count
   ECS services/task definitions. ACM may take several minutes after delegation.
4. `first-image-push` — pushes the initial API and web images after ECR exists.
5. `apply` — updates the service/task definitions while desired counts remain
   zero, so the one-off migration runs against the new image before serving
   tasks start.
6. `migrate` — runs migrations in a one-off ECS task.
7. `seed` — seeds plans and interactively creates the first platform admin,
   then applies `services_enabled=true` and waits for ECS stability. MFA
   enrollment is completed in the browser before the smoke test.
8. `smoke-test` — checks staging signup/verification bypass, login, upload,
   cited AI answer, and logout.

The default environment is staging. Production follows only after staging has
been verified and uses the protected production GitHub environment. Generated
Terraform state, tfvars, backend files, and plans are ignored by git.

If an interrupted run created state, the default preflight refuses to reuse it.
Use `./scripts/bootstrap.sh --resume` only after confirming it is the same AWS
account and target environment; it retains rather than deletes existing state.

## GitHub Actions setup

After bootstrap and the selected environment's Terraform outputs exist, run:

```bash
./scripts/setup_github.sh staging
# After production has also been applied:
./scripts/setup_github.sh prod
```

The script reads bootstrap/environment Terraform outputs, sets the variables
and environment secrets with `gh`, creates both environments with the current
GitHub user as a required reviewer, and protects `main` with CI checks and no
required approving review. It is safe to rerun; values are overwritten from
the current Terraform outputs/config. It prompts for the smoke-test account
credentials without echoing them.

### Exact GitHub Actions names

**Repository variables** (`Settings → Secrets and variables → Actions →
Variables`):

| Name | Purpose |
|---|---|
| `AWS_REGION` | Region from `deploy.config`. |
| `REPOSITORY` | OIDC repository subject (`owner/repository`). |
| `TF_STATE_BUCKET`, `TF_STATE_LOCK_TABLE` | Remote state and locking outputs. |
| `BUILD_ROLE_ARN` | Bootstrap ECR-only image push role. |
| `TERRAFORM_PLAN_ROLE_ARN` | Bootstrap read-only PR plan role. |
| `TERRAFORM_APPLY_ROLE_ARN` | Bootstrap apply role; used only behind staging/production reviewer environments. |
| `ALERT_EMAIL`, `BEDROCK_MODEL_ARNS`, `DMARC_RECORD` | Terraform app/account configuration. |
| `DOMAIN_STAGING`, `DOMAIN_PROD`, `FROM_EMAIL_STAGING`, `FROM_EMAIL_PROD` | Config-derived hostnames and SES sender addresses. |
| `PUBLIC_BASE_URL_STAGING`, `PUBLIC_BASE_URL_PROD` | Smoke-test origins. |
| `ECR_REGISTRY`, `INITIAL_IMAGE_TAG` | Shared ECR registry and bootstrap tag. |
| `ECR_API_REPOSITORY_STAGING`, `ECR_WEB_REPOSITORY_STAGING` | Filled after staging apply. |
| `STAGING_DEPLOY_ROLE_ARN`, `STAGING_ECS_CLUSTER` | Staging deploy identity and cluster. |
| `STAGING_ECS_API_SERVICE`, `STAGING_ECS_WEB_SERVICE`, `STAGING_ECS_WORKER_SERVICE` | Staging services. |
| `ECR_API_REPOSITORY_PROD`, `ECR_WEB_REPOSITORY_PROD` | Filled after production apply. |
| `PROD_DEPLOY_ROLE_ARN`, `PROD_ECS_CLUSTER` | Production deploy identity and cluster. |
| `PROD_ECS_API_SERVICE`, `PROD_ECS_WEB_SERVICE`, `PROD_ECS_WORKER_SERVICE` | Production services. |

**Variables in each GitHub environment** (`staging`, `production`):
`DEPLOY_ROLE_ARN`, `ECS_CLUSTER`, `ECS_API_SERVICE`, `ECS_WEB_SERVICE`,
`ECS_WORKER_SERVICE`, `ECR_API_REPOSITORY`, `ECR_WEB_REPOSITORY`,
`PUBLIC_BASE_URL`, `DOMAIN`, `TF_VAR_region`, `TF_VAR_domain`,
`TF_VAR_github_repo`, `TF_VAR_alert_email`, `TF_VAR_bedrock_model_arns`,
`TF_VAR_from_email`, `TF_VAR_dmarc_record`, `TF_VAR_services_enabled`,
`TF_VAR_initial_image_tag`, and `ALLOW_EMAIL_VERIFICATION_BYPASS` (set to `1`
only for staging; production is `0`), plus `SMOKE_TEST_MODE` (`signup` for
staging; `existing` for production CI).

**Secrets in each GitHub environment:** `SMOKE_TEST_EMAIL` and
`SMOKE_TEST_PASSWORD`. They are set through hidden prompts by
`scripts/setup_github.sh`; never put them in `deploy.config` or git.
GitHub supplies the built-in `GITHUB_TOKEN` to CI automatically; do not create
or copy a personal access token for that name.

The branch protection gate is `CI / CI required`; its actual GitHub check-run
label remains **UNVERIFIED** until the first repository Actions run. Do not
weaken branch protection if the label differs—select the exact successful
required-check name shown by GitHub.

## Costs and teardown

**Estimated monthly cost**, not a quote: about **$131 for production** plus
variable Bedrock use; staging is about **$95–$110 while running**. The first
apply creates billable services. Let DNS/SES verification complete before
switching users; the old deployment remains untouched.

Use `scripts/destroy.sh staging` for staging. It requires typing the
environment name, snapshots the database, and leaves S3 objects alone unless
`--empty-s3` is explicitly provided. Production additionally requires an
explicit unsafe flag. The shared bootstrap state/OIDC resources are not part of
environment teardown.

## Validate after deployment

* `https://<target-host>/api/health/live` returns liveness success.
* `/api/health` reports database and storage readiness.
* `scripts/post_deploy.sh <staging|prod> migrate` runs a one-off migration task;
  `seed` runs `seed_plans`, prompts in a secure ECS Exec session for the first
  platform-admin email/password, and offers staging-only demo company/sample
  documents. After ECS services are up, `verify-mfa` waits for browser-based
  TOTP enrollment and checks that `mfa_enabled` is set. Passwords are typed
  hidden and never printed; confirm your AWS Session Manager policy does not
  record interactive input before entering a credential.
  Typical staging sequence (also run by `bootstrap.sh`):
  `scripts/post_deploy.sh staging migrate`, `... staging seed`, then
  `... staging verify-mfa` after services start.
* `scripts/smoke_test.sh <url>` checks health, signup, verification, login,
  document upload/indexing, a streamed answer with a source citation, cleanup,
  and logout. `ALLOW_EMAIL_VERIFICATION_BYPASS=1` is accepted only when
  `DEPLOY_ENVIRONMENT=staging`. The production deployment workflow uses a
  pre-verified, non-platform-admin account (`SMOKE_TEST_MODE=existing`); use
  interactive `SMOKE_TEST_MODE=signup` once with access to the mailbox to test
  actual production verification end to end.
* Confirm CloudWatch logs contain usage metadata only, SNS subscription is
  confirmed, and a nightly backup object arrives in S3.
* Bedrock model access, real SES delivery, ECS capacity, RDS PITR RTO, and a
  production smoke test remain **UNVERIFIED** until measured in your account.

For the architecture, ADRs, cost assumptions, and known gaps, see
[`ARCHITECTURE.md`](ARCHITECTURE.md), [`COST.md`](COST.md), and
[`FINAL_REPORT.md`](FINAL_REPORT.md).
