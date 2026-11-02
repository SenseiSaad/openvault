# Interview notes — what to say about the infra, honestly

## ECS Fargate (compute)
* **What:** three Fargate services (api/web/worker) behind one ALB, task roles
  per workload, deployment circuit breaker with auto-rollback, CPU autoscaling
  on the api service.
* **Why Fargate, not EC2:** per-task health + replacement without owning a
  control plane; task roles are what make keyless Bedrock possible.
* **What broke / could break:** first deploy needs images to exist before the
  service (bootstrap tag); `wait services-stable` can time out on a bad image —
  the circuit breaker rolls back, the CI smoke test is the second gate.
* **Scale:** raise `api_max_capacity` (CPU target 60%); streams hold a thread,
  so CPU is the right signal. Next real change: async streaming off gunicorn.

## Network (no NAT)
* **What:** ALB + tasks in public subnets (tasks get public IPs, SG-filtered),
  RDS/Redis in isolated private subnets.
* **Why:** NAT = $33/mo + data for nothing pre-revenue; the SG chain (ALB→app,
  app→RDS/Redis only) is the actual security boundary.
* **Could break:** a leaked task IP is port-scannable — nothing listens except
  the app port, which requires ALB→SG membership anyway. The upgrade path is a
  Terraform-only change (documented ADR 0004).

## RDS + pgvector (data)
* **What:** PostgreSQL 16, pgvector for KNN, hybrid BM25+dense retrieval
  filtered by the caller's tenant/document ACL before any scoring; PITR 14 days.
* **Why in-DB, not a vector DB:** tenant filter and vector search must be the
  same query; a separate vector DB splits the isolation boundary.
* **What broke:** pgvector needs the extension enabled at migrate time — the
  migration is vendor-guarded (no-op on SQLite dev). Dimension changes require a
  full re-embed (EMBED_DIM documented).

## Bedrock via task role (AI)
* **What:** no API keys anywhere; the task role allows InvokeModel only on
  explicitly configured model/inference-profile ARNs; per-call usage logged as
  structured JSON for per-company cost metrics.
* **What broke:** model access not enabled per-region → `llm_error` metric fires
  (that's the readiness signal); token counts are undercounted (0) because
  streaming APIs don't return per-chunk usage — the metric is a trend, not an
  invoice. Cost runaway is bounded by the 20/min per-user ask limit + plan caps
  + the daily-token alarm.

## Delivery (GitHub Actions + Terraform)
* **What:** OIDC (no static keys), three roles with different blast radius
  (deploy / plan / apply), actions pinned, concurrency groups, migrations as a
  one-off task BEFORE service update, smoke test, rollback workflow by image tag.
* **What broke:** Terraform state must exist before the first CI plan (bootstrap
  apply is local, one-time); task-def registration via `update-service` means
  Terraform ignores task_definition drift — task defs are CI-owned after the
  first apply. That split is deliberate and documented.

## Claims I CAN make
* "Infrastructure as code with per-module validation, tflint, and documented
  checkov exceptions."
* "Keyless AWS authentication end-to-end (OIDC for CI, task roles for workloads)."
* "Migrations run as a gated deploy step, not at container start."
* "Documented, rehearsed restore path (drill measured on a real container)."
* "Load-tested locally with k6; numbers recorded."

## Claims I must NOT make (yet)
* "Multi-AZ / HA production" — Multi-AZ is off by design at launch.
* "Load-tested in AWS/staging" — k6 numbers are local-only so far.
* "SOC2/GDPR anything." "Penetration tested."
* "Production-scale RTO measured" — the drill is container-scale; the first real
  RDS restore must be measured and recorded before claiming RTO numbers.
* "Kubernetes" — deliberately not used; can explain why in depth.
