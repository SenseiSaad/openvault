# Final report — AWS production infrastructure and delivery pipeline

**Branch:** `infra`  
**Region:** `ap-south-1` (Mumbai)  
**Live site:** `https://openvault.saadops.site` / `https://api.saadops.site` — **not modified**  
**New stack:** separate ECS/Fargate environment on a new subdomain  
**Apply status:** **not applied.** No billable AWS resource was created from this branch.

---

## 1. Status at a glance

| Area | Status |
|---|---|
| Terraform for VPC, RDS, ElastiCache, S3, ECR, ALB/ECS, Route 53/ACM, SES, CloudWatch/SNS/Budgets, IAM/OIDC | Written, formatted, validated, linted, scanned |
| Application support for ECS (health, shutdown, migrations, token usage, provider switching, SSRF tests) | Written and tested locally |
| CI/CD workflows (`ci`, `terraform-plan`, `deploy`, `rollback`, `terraform-apply`) | Written, actionlint-clean, not executed on GitHub |
| Secrets flow (names-only template, SSM pusher/checker, gitleaks) | Written; real values not committed |
| Operations docs, runbooks, ADRs, cost model, restore drill | Written; local drill measured |
| Real AWS deploy, Terraform plan/apply, Bedrock/SES/DNS checks | **Blocked** on account/inputs/credentials |
| `git push` of `infra` | Not performed in this pass |

The deliverable is a **validated, reviewable implementation**, not a deployed
environment. Do not describe it as live or as a completed migration.

---

## 2. What was built

### 2.1 Infrastructure (`infra/`)

* `bootstrap/` — versioned, encrypted S3 Terraform state bucket and DynamoDB lock
  table.
* `modules/network` — VPC in two AZs; public subnets for ALB + ECS; isolated
  private subnets for RDS/Redis; no NAT.
* `modules/data` — RDS PostgreSQL 16 (`pgvector`-capable), ElastiCache Redis 7,
  versioned/encrypted documents and backups buckets, S3 lifecycle and policies.
* `modules/registry` — private ECR repositories with scan-on-push and lifecycle.
* `modules/ecs` — one cluster, `api`/`worker`/`web` services, ALB path routing,
  health checks, circuit breaker, autoscaling, one-off `migrate` and `backup`
  task definitions, EventBridge nightly backup, CloudWatch log groups.
* `modules/dns_tls` — Route 53 **subdomain-only** zone, ACM certificate, DNS
  validation, HTTPS listener, HTTP→HTTPS redirect.
* `modules/ses` — SES domain identity, DKIM/SPF/verification/DMARC records.
* `modules/observability` — SNS alerts, CloudWatch alarms for LLM errors/tokens,
  ALB 5xx/unhealthy targets, ECS no-datapoints, RDS CPU/storage/connections,
  AWS Budgets with absolute thresholds.
* `modules/iam_oidc` — one account-global GitHub OIDC provider (owned by prod;
  staging references it) and four roles: build, deploy,
  Terraform plan, Terraform apply. The apply role uses a custom project-scoped
  IAM policy instead of `IAMFullAccess`.
* `envs/prod` and `envs/staging` — separate VPC CIDRs, sizing, secrets prefixes,
  budgets, domains, and state keys.

### 2.2 Application changes

* `/api/health` (DB + S3 readiness) and `/api/health/live` (cheap liveness).
* Graceful shutdown and request timeouts aligned to the ALB idle timeout.
* Exact provider token usage in JSON logs (`llm_usage`) with no prompt or
  document content; `LLMTotalTokens` metric filter and daily alarm.
* One-off migration task; serving containers never run migrations.
* `check_bedrock` management command and provider-switching path.
* SSRF protections with tests; upload/type limits and ACL-filtered retrieval.
* Bedrock bearer-key auth fixed for the pinned botocore (token chain plus legacy
  `signature_version` fallback).

### 2.3 CI/CD and operations

* `ci.yml` — backend tests/coverage, frontend tests/build, Docker build + Trivy,
  gitleaks on the current tree, Terraform fmt/validate/tflint/checkov.
* `terraform-plan.yml` — read-only PR plan with OIDC.
* `deploy.yml` — build once, push the same SHA to prod and staging ECR, deploy
  staging automatically, require the `production` environment, run migrations,
  wait, verify task definitions, smoke test.
* `rollback.yml` — redeploy a previous SHA with `SKIP_MIGRATE=1`.
* `terraform-apply.yml` — protected manual Terraform apply.
* `scripts/deploy_ecs.sh` — migration gate, service update, circuit-breaker
  verification, rollback on failed update/smoke test, nightly backup target
  refresh.
* `scripts/smoke_test.sh` — public health checks plus authenticated `/api/auth/me`
  in production.
* `scripts/setup_github.sh` — environments (production requires review), branch
  protection, tag ruleset, variables reminder.
* `scripts/check_env.sh` / `push_env_to_ssm.sh` — name validation and SecureString
  upload without printing values.
* Runbooks: restore, bad deploy/rollback, database down, AI provider down,
  alerts, disk full, accidental deletion, service not starting.
* `docs/ARCHITECTURE.md`, `docs/DEPLOY.md`, `docs/COST.md`, 10 ADRs,
  `docs/INTERVIEW_NOTES.md`, `docs/SECURITY.md`, refreshed checklist.

---

## 3. Verification evidence

Run locally on this branch:

| Check | Result |
|---|---|
| `terraform fmt -check -recursive` | clean |
| `terraform validate` for all module/environment roots | pass |
| `tflint --recursive` | exit 0, no findings |
| Checkov (`--framework terraform`, project config) | **258 passed, 0 failed, 2 skipped** |
| `actionlint` on all workflows | clean |
| `bash -n scripts/*.sh` | pass |
| `gitleaks detect --no-git` | no leaks in current tree |
| Backend `pytest` | **162 passed** |
| Frontend `vitest` | **9 passed** |
| Frontend `tsc --noEmit` | pass |
| Backend Docker image | built successfully; `pg_dump`, `aws`, backup/restore scripts present/executable |
| Frontend Docker image | built successfully with `NEXT_PUBLIC_API_URL=`; local container returned HTTP 200 |
| Local backup/restore drill | 500 rows, `vector(3)` + HNSW index, 8 KB archive; backup 200 ms, restore 444 ms |
| k6 local load test | recorded in `docs/loadtest-results.md`; **local only** |

The Docker images were built from the repo root. The root `.dockerignore` was
corrected to stop excluding `frontend/`; without that fix the documented
`docker build -f frontend/Dockerfile ...` command failed before the first build
stage. The frontend build had a transient registry timeout during the first
retry; the clean-cache retry succeeded.

### What “verified” does **not** mean

* No `terraform plan` or `apply` was run against the real AWS account.
* No ECS service, ALB, RDS instance, Redis node, S3 bucket, ECR repository,
  ACM certificate, SES identity, SNS topic, budget, or IAM role exists from this
  branch.
* No GitHub Actions workflow ran on GitHub; actionlint is static validation only.
* No staging/production smoke test, k6 test against ECS, or RDS PITR restore was
  executed.
* Bedrock model access, the `in.` inference-profile ARN, regional availability,
  and `EMBED_DIM=1024` compatibility are **UNVERIFIED**.

---

## 4. Cost summary

Full assumptions and levers are in [`docs/COST.md`](COST.md). List-price
estimates, not an invoice:

| Environment | Fixed infrastructure | Notes |
|---|---:|---|
| Production | **~$131/mo** | Fargate ~$42, RDS ~$46, Redis ~$12, ALB ~$19, S3/CloudWatch/SES/DNS/egress ~$12 |
| Staging | **~$95–$110/mo** while running | Smaller RDS; destroy when not testing |
| Bedrock | variable | ~$6.05 per 1,000 questions at 3k input / 500 output tokens with Claude Haiku 4.5 |

Excluded: AWS Support, domain registration, taxes, payment fees, WAF/Shield,
multi-region DR, provisioned Bedrock throughput, engineering time. Budget alarms
are **$20/$35/$50/$100** in prod and **$10/$15** in staging.

---

## 5. Required inputs (not guessed)

| # | Input | Why it is needed | Current status |
|---|---|---|---|
| 1 | AWS account ID and credentials with permission to create the stack | First apply and resource existence | **MISSING** |
| 2 | Confirmation that `ap-south-1` is acceptable | Region for all resources | Defaulted; confirm |
| 3 | New subdomain (e.g. `v2.example.com`) and parent DNS access | Route 53 delegation + ACM | **MISSING** |
| 4 | Alert email for SNS and budgets | Alarm delivery | **MISSING** |
| 5 | Bedrock Claude Haiku 4.5 model access + `in.` inference-profile ARN | Chat provider | **UNVERIFIED** |
| 6 | Titan Text Embeddings V2 model ARN and embedding dimension | Retrieval/index compatibility | **UNVERIFIED** |
| 7 | SES domain verification + production-access approval + SMTP credentials | Signup/reset email | **MISSING** |
| 8 | RDS managed master password from Secrets Manager | Build `DATABASE_URL` | Generated after apply |
| 9 | GitHub owner/repo and `gh` authentication | OIDC trust + environments | **MISSING / not run** |
| 10 | GitHub environment secrets `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD` | Authenticated production smoke | **MISSING** |
| 11 | Temporary bootstrap admin email/password | First platform admin | **MISSING** |
| 12 | Optional Sentry DSN | Error reporting | Optional |
| 13 | Confirmed SNS/budget email subscriptions | Alerts actually arrive | After apply |
| 14 | Decision on historical secret cleanup | Repo sale/public exposure | **ACTION REQUIRED** |

The staging Terraform apply role must be set separately as
`AWS_TERRAFORM_APPLY_ROLE_ARN_STAGING`; the production apply role is
`AWS_TERRAFORM_APPLY_ROLE_ARN`. The concrete variable names and where each goes are listed in
[`docs/DEPLOY.md`](DEPLOY.md) and [`scripts/setup_github.sh`](../scripts/setup_github.sh).

---

## 6. First-deploy order (short form)

Full detail: [`docs/DEPLOY.md`](DEPLOY.md).

1. **Bootstrap state** (local admin, once per account):
   ```bash
   cd infra/bootstrap && terraform init && terraform plan && terraform apply
   ```
2. **Prepare production variables before the targeted zone apply**, then
   create the new subdomain zone and delegate:
   ```bash
   cd infra/envs/prod
   cp terraform.tfvars.example terraform.tfvars
   $EDITOR terraform.tfvars
   terraform init
   terraform apply -target=module.dns_tls.aws_route53_zone.this
   terraform output name_servers
   # Paste the NS records into the parent DNS provider; wait for `dig NS`.
   ```
3. **Full first apply** (local admin; roles do not exist yet):
   ```bash
   terraform plan -out=tfplan
   terraform apply tfplan
   ```
4. **Verify DNS/ACM, SES production access, Bedrock model access, SNS
   subscription, and budget email.**
5. **Push secrets** (names only in git):
   ```bash
   cp .env.production.example .env.production
   $EDITOR .env.production          # DATABASE_URL with sslmode=require
   ./scripts/check_env.sh prod
   ./scripts/push_env_to_ssm.sh prod
   ```
6. **Push a `bootstrap` image** for both API and web; run the first deploy:
   ```bash
   ./scripts/deploy_ecs.sh prod bootstrap
   ```
7. **Configure GitHub**:
   ```bash
   ./scripts/setup_github.sh
   # Set repo variables: AWS_BUILD_ROLE_ARN, deploy/plan/apply roles,
   # domains, ECR, Bedrock ARNs, OIDC subjects.
   # Set environment secrets: SMOKE_TEST_EMAIL/PASSWORD.
   ```
8. **Push to `main`**; staging deploys automatically; approve production.
9. **Verify**: `/api/health`, `/api/health/live`, authenticated smoke, one
   document upload/download, one question, `check_bedrock`, CloudWatch
   `llm_usage`, nightly backup object.

Do **not** point the new stack at the live domain until data export/import and
an authenticated smoke test have passed.

---

## 7. Risks and open items

### P0 — historical secret in git history

An old `backend/.env` in prior commits contains a real secret (gitleaks reports
a Gemini key). The current tree is clean and CI scans the current tree with
`--no-git`, but **history still contains it**.

Before making the repository public again or transferring it:

1. Revoke/rotate the exposed key and any other credential from that file.
2. Rotate `SECRET_KEY` / `LLM_KEY_ENCRYPTION_KEY` if reused in production
   (rotating the encryption key invalidates stored BYO provider keys; plan it).
3. Decide whether to purge history (`git filter-repo`/BFG) and force-push.
4. Re-scan full history before re-enabling public access.

See [`docs/SECURITY.md`](SECURITY.md).

### P1 — no real AWS verification

The IAM policies, OIDC trust, ECS service creation, ACM validation, SES
identity, Bedrock policy, S3 policies, alarms, and budgets have only been
validated statically. First apply will almost certainly surface at least one
account-specific issue (quota, service availability, ARN shape, DNS timing).

**Mitigation:** run `terraform plan` with the real account before apply; apply
production first because it owns the account-global OIDC provider, then staging;
read the plan for replacements/deletions; do not use
`AdministratorAccess` for CI.

### P1 — ACM validation depends on DNS delegation

`terraform apply` can appear to hang while ACM waits for the DNS validation
record. Delegate the NS records before the full apply (or while it waits), and
do not cancel the apply.

### P1 — Bedrock and embedding assumptions are unverified

* Model access may need a separate request in the Bedrock console.
* The `in.` inference-profile ARN is account/region-specific.
* `EMBED_DIM=1024` must match the actual Titan v2 output; existing indexes are
  invalid if it changes. Run `check_embeddings`/a small invoke before importing
  data.

### P1 — single-AZ RDS/Redis and no NAT

Single-AZ RDS and a single Redis node are launch cost choices. An AZ failure
causes downtime; RDS PITR is the recovery path. Public-subnet Fargate tasks have
public IPs for egress; security groups are the control. A compliance requirement
would force private subnets + NAT/VPC endpoints (see ADR 0004).

### P2 — operational gaps

* No WAF/Shield Advanced, no CloudFront, no multi-region DR.
* No automated backup **freshness** alarm; the nightly task has success/failure
  logs but no “new object in S3” check yet. Add a freshness metric before
  launch.
* No automated secret rotation; rotate on a calendar and after any exposure.
* No Container Insights; the ECS no-datapoints alarm is coarse.
* Staging runs two tasks/services and costs ~$100/mo; destroy it when idle.
* `scripts/setup_github.sh` has not been run; environments, branch protection,
  tags, variables and smoke secrets are not configured on GitHub.
* The `infra` branch has not been pushed. Pushing it does not deploy anything;
  only a push/merge to `main` can trigger the pipeline.

### P2 — deployment pipeline assumptions

* The production deploy requires a protected GitHub environment; until
  `setup_github.sh` is run, no approval gate exists.
* The build role can push both environment ECR repositories; it cannot update
  ECS. This is intentional, but it means a compromised build role can overwrite
  SHA-tagged staging/prod images. Images are immutable by SHA convention.
* Rollback skips migrations. Database changes must be additive for one-release
  rollback safety.

---

## 8. Section and commit map

| Section | Deliverable | Commit |
|---|---|---|
| 1 | Terraform bootstrap, modules, prod/staging | `41db0d8` |
| 2 | Health probes, graceful shutdown, usage logging | `7a0e393` |
| 3 | Bedrock cost controls, budgets, staging sizing, COST | `e410061` |
| 4 | CI/CD workflows, deploy/smoke/setup scripts | `089c1e7` |
| 4 follow-up | Dedicated build role, dual-env push, DMARC, backup target perms | `becd313` |
| 4 security follow-up | Role-specific OIDC subjects, shared account provider, staging apply role | `d5986b2` |
| 5 | Names-only env template, SSM manifest/push/check, gitleaks | `7b4de49` |
| — | Bedrock bearer auth fix for pinned botocore | `90f200f` |
| 6 | ECS runbooks, restore drill, k6 caveats, backup image deps | `13552f9` |
| 6 follow-up | Frontend Docker context fix; rollback stays active through task verification and smoke | `2bbe6c4` |
| — | Idempotent GitHub tag ruleset setup | `c8dc89b` |
| 7 | Architecture, deploy guide, ADRs, interview/security docs | `982a4df` |
| 8 | This handoff report: verification, blockers, costs, required inputs, and launch risks | included in current handoff |

The branch is committed locally but has not been pushed to `origin`.

---

## 9. Handoff checklist

- [ ] Put the AWS account ID, subdomain and alert email into a private
      `terraform.tfvars` (never commit).
- [ ] Run `terraform plan` with the real account; review every replacement.
- [ ] Apply prod first (it creates the shared OIDC provider); delegate DNS;
      confirm SNS and budget emails.
- [ ] Apply staging; confirm ALB/ACM/ECS/RDS/Redis and one authenticated
      question.
- [ ] Push SSM secrets; remove bootstrap admin values after first login.
- [ ] Run `setup_github.sh`; set variables and smoke-test secrets.
- [ ] Merge to `main`; approve production; verify smoke and rollback once.
- [ ] Add backup-freshness alarm and external uptime/TLS checks.
- [ ] Rotate the historical secret and decide on history purge.
- [ ] Only then consider migrating live users from the Amplify/Render stack.

**Bottom line:** the code and documentation are ready for an account-backed
plan/apply review. The stack is not live, and the claims that depend on AWS
(Bedrock, SES, ACM, RDS restore, ECS capacity, GitHub OIDC) remain unverified
until the missing inputs are supplied.
