# Interview notes — OpenVault infrastructure

Short answers you can defend, plus the places where the honest answer is
“not verified yet.” Do not claim an AWS number that has not been measured.

## 60-second pitch

“OpenVault is a multi-tenant document RAG app. I moved the production stack to
ECS Fargate in `ap-south-1`: one ALB serves the Next.js app and the Django API
from the same origin, so HttpOnly cookies work without CORS. State is RDS
Postgres with pgvector and ElastiCache Redis in private subnets; documents and
backups are in versioned S3; Bedrock is reached through the ECS task role, not a
stored key. GitHub Actions uses OIDC with separate build/deploy/plan/apply
roles, builds one SHA-tagged image, runs migrations as a one-off task, deploys
staging automatically, and requires approval for production. The repo has
Terraform validate/tflint/checkov, Trivy image scans, gitleaks, a smoke test,
and a rollback workflow.”

## Why ECS Fargate instead of the existing Docker Compose host?

The old host couples TLS, database, Redis, app, and disk to one machine. Fargate
gives independent task definitions, health-checked rolling deploys, and no host
patching. The trade-off is higher compute cost per hour; at launch it is about
$42/mo for api + worker + web. I would use a single EC2 host only if the budget
were the hard constraint and I accepted the operational coupling.

## Why one ALB and path routing?

Cookies. The app uses HttpOnly access/refresh cookies. Same-origin means the
browser sends them automatically; no `credentials: 'include'`, no cookie
`Domain`, no third-party-cookie dependence. The ALB routes `/api/*`,
`/admin/*`, `/static/*` to the API and everything else to Next.js. The
frontend build gets an empty `NEXT_PUBLIC_API_URL`, so the browser derives the
origin from `window.location`.

## Why no NAT gateway?

Cost. Two NAT gateways plus data processing would be ~$35–$45/mo per AZ. ECS
tasks run in public subnets with public IPs for egress; RDS and Redis are in
isolated private subnets with no internet route. Security groups only allow
ALB→api/web and api/worker→RDS/Redis. This is a documented trade-off, not an
accident; a compliance requirement would force private subnets + NAT or VPC
endpoints.

## Why RDS + ElastiCache, not Postgres/Redis containers?

Managed backups/PITR, storage encryption, forced SSL, and no database
container to patch. Single-AZ RDS and single-node Redis are deliberate launch
cost choices; Multi-AZ is the first resilience upgrade. The app treats Redis
as recoverable (cache, rate-limit windows, retryable Celery tasks), not as a
source of truth.

## How do migrations work?

A separate one-off ECS task runs `python manage.py migrate` with the new API
image **before** the services update. If it exits nonzero, the deploy stops and
the old services keep serving. Serving containers never run migrations. Rollback
skips migrations because schema changes are forward-only in practice; additive
migrations are required for one-release rollback safety.

## How is Bedrock secured?

The ECS **task role** is the credential. There is no platform `BEDROCK_API_KEY`
on ECS. IAM allows only `bedrock:InvokeModel` and
`InvokeModelWithResponseStream` on the exact chat inference-profile and Titan
embedding ARNs. BYO provider keys are encrypted per tenant with a separate
`LLM_KEY_ENCRYPTION_KEY`. `python manage.py check_bedrock` fails fast if model
access or the ARN is wrong.

## How do GitHub Actions get AWS access?

OIDC, no static keys. Four roles: build (ECR push only), deploy (ECS/update,
logs, SSM read, retarget nightly backup), plan (read-only), apply (PowerUser +
project-scoped IAM). The apply role sits behind a required-reviewer `production`
environment. The trust policy is restricted to this repository and specific
subjects (`main`, `pull_request`, `environment:staging`,
`environment:production`, tags). The build job pushes the same immutable SHA to
both environment repositories.

## What happens when a deploy is bad?

ECS deployment circuit breaker is enabled with rollback. The deploy script also
captures the previous task definitions and restores them if an update or the
smoke test fails. The manual `rollback.yml` workflow redeploys an existing ECR
tag with `SKIP_MIGRATE=1`, waits for stability, and smoke-tests. The runbook
covers database compatibility.

## How do you know it is healthy?

`/api/health` checks the database and S3 (`db`, `storage`); `/api/health/live`
is a cheap liveness probe. ALB target groups use `/api/health` and `/`.
CloudWatch alarms cover ALB 5xx, unhealthy targets, ECS no-datapoints, RDS
CPU/storage/connections, Bedrock errors, and daily token spend. SNS email must
be confirmed. The post-deploy smoke test checks public endpoints and, in prod,
an authenticated `/api/auth/me`.

## How do you control cost?

Bedrock is the variable cost. Each AI call emits a JSON `llm_usage` line with
`input_tokens`, `output_tokens`, `total_tokens`, `company_id`, `model`, and
`provider` — never prompt or document content. CloudWatch metric filters and a
daily token alarm catch runaway usage. AWS Budgets has absolute thresholds
($20/$35/$50/$100 prod, $10/$15 staging). `docs/COST.md` lists the fixed
infrastructure at roughly $131/mo and the levers: destroy staging, Spot for the
worker, stay single-AZ, later Graviton.

## What is actually verified?

* Terraform fmt/validate for prod and staging; tflint clean; Checkov 267 passed,
  0 failed, 2 documented skips.
* Backend targeted tests for health, observability, plans, and hardened
  security; full suite: 162 passed.
* `bash -n` on deploy/smoke scripts; actionlint clean on all workflows; local
  gitleaks clean.
* A local `pgvector/pgvector:pg16` backup/restore drill: 500 rows, 8 KB archive,
  backup 200 ms, restore 444 ms, vector extension and HNSW index preserved.
* Local k6 results for retrieval/streaming (not ECS capacity).

## What is not verified (say this plainly)

* No `terraform apply`; no billable AWS resource exists. No Terraform plan
  against the real account because the account/credentials are missing.
* Bedrock model access, the `in.` inference-profile ARN, regional availability,
  and `EMBED_DIM=1024` compatibility are **UNVERIFIED**.
* RDS PITR RTO and the first real ECS deploy/smoke test are **UNVERIFIED**.
* Staging k6 numbers and Fargate capacity are **UNVERIFIED**; the current k6
  numbers are local only.
* The historical `backend/.env` secret in old commits needs revocation and a
  history-cleanup decision. CI scans the current tree, not full history, because
  that finding predates the new stack.

## Likely follow-up questions

**“Why not Kubernetes?”** The workload is three services and one team. ECS is
less control plane to operate, and the ALB/service/task-definition primitives
map directly to the deploy script. Kubernetes would be justified with many
services, CRDs, or a platform team.

**“Why not Lambda?”** Long streaming answers, OCR, and Celery-style background
work fit containers better. Lambda also complicates RDS connection pooling and
the 15-minute limit.

**“How do you handle secrets in Terraform state?”** Application secrets are not
in Terraform. SSM parameter names/ARNs are; values are pushed separately. RDS
uses `manage_master_user_password`, so the password is in Secrets Manager, not
state. The Terraform state bucket is encrypted and access-controlled.

**“How would you make this Multi-AZ?”** Set `db_multi_az=true`, add a second
Redis node/replication group, and optionally add a second ALB AZ (already two
public subnets). Cost roughly doubles the database line.

**“How would you migrate the live site?”** New subdomain first, run both stacks,
verify data/documents, then cut DNS. Do not point this stack at the live domain
until the old data is exported/imported and authenticated smoke tests pass.
