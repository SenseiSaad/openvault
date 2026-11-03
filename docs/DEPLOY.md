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
  `>=2.45`, `jq >=1.6`, Git `>=2.30`, Python `>=3.12`.

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

During preflight, `DATABASE_URL` may remain blank; after RDS is created, supply
the endpoint and managed password, then run runtime validation and push the
values to SSM SecureString. The checker prints parameter names only.

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
   bootstrap resources, then staging's base network/data/registry.
4. `first-image-push` — pushes the initial API and web images after ECR exists.
5. `apply` — adds/starts staging ECS services after the images exist.
6. `migrate` — runs migrations in a one-off ECS task.
7. `seed` — seeds plans and interactively creates the first platform admin;
   MFA enrollment is completed in the browser before setup is marked complete.
8. `smoke-test` — checks staging signup/verification bypass, login, upload,
   cited AI answer, and logout.

The default environment is staging. Production follows only after staging has
been verified and uses the protected production GitHub environment. Generated
Terraform state, tfvars, backend files, and plans are ignored by git.

If an interrupted run created state, the default preflight refuses to reuse it.
Use `./scripts/bootstrap.sh --resume` only after confirming it is the same AWS
account and target environment; it retains rather than deletes existing state.

## GitHub Actions setup

After bootstrap and staging outputs exist, run:

```bash
./scripts/setup_github.sh
```

The script reads Terraform outputs, sets repository/environment variables and
smoke-test secrets with `gh`, creates staging/production environments with a
required reviewer, and protects `main` with required CI checks and no required
approving review. Exact variable and secret names are listed below once setup
is configured; never add AWS access keys or application secrets to git.

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
* Complete signup, verification (or the staging-only test bypass), login,
  upload a small text document, ask a question and confirm the answer cites it,
  then logout.
* Confirm CloudWatch logs contain usage metadata only, SNS subscription is
  confirmed, and a nightly backup object arrives in S3.
* Bedrock model access, real SES delivery, ECS capacity, RDS PITR RTO, and a
  production smoke test remain **UNVERIFIED** until measured in your account.

For the architecture, ADRs, cost assumptions, and known gaps, see
[`ARCHITECTURE.md`](ARCHITECTURE.md), [`COST.md`](COST.md), and
[`FINAL_REPORT.md`](FINAL_REPORT.md).
