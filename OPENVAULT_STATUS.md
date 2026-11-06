# OpenVault (formerly DocuTrust AI) — Technical Due-Diligence, Cloud Architecture & Exit-Readiness Audit

**Audit Date:** 2026-11-06  
**Repository:** `/home/saad/Desktop/OpenVault` (branch `infra` @ `08e1036`, 77 commits; `origin/main` @ `dd354f2` is 22 commits / 253 files behind)  
**Proposal Audited:** *DocuTrust AI: A Multi-Tenant Workplace Knowledge Assistant with Bilingual RAG, Attendance Tracking, and Automated Workflow Management* (University of South Asia, BS CS 2023–2027, Saad Waseem [B-28488], M Akmal [B-28723], M Talha Khalid [B-28390], Supervisor: Ma'am Iqra)

---

## 1. Executive Summary

- **Local Readiness: 88%** — Backend (`214 passed`, `74%` coverage across `5,572` statements), frontend (`12/12` Vitest tests, `tsc --noEmit`, `next build` all `22/22` static routes), and `docker compose` work end-to-end, but a clean git clone misses untracked `backend/templates/` (`form_expense_claim.md`, `form_it_access_request.md`, `leave_request_form.txt`) and lacks `pnpm lint`.
- **Online Readiness ("only add `.env`"): 62%** — Terraform (`3,919` HCL lines, `120` resources) and GitHub Actions OIDC CI/CD (`5` workflows) are written and pass `tflint`, **nothing is deployed live in AWS (`0` ECS clusters/ALBs/non-default VPCs)**, `infra` is unmerged/unpushed to `origin/main`, and first deploy requires manual bootstrap (`bootstrap` TF, DNS delegation, initial ECR image push, SES sandbox exit).
- **Sale / Exit Readiness: 48%** — Strong multi-tenant isolation (`0` cross-tenant leaks across 214 tests + 84-row RAG eval), Fernet key encryption, TOTP MFA, and audit logs exist, but **co-author & University of South Asia FYP IP encumbrance**, **0 paying customers**, **95 frontend npm vulnerabilities (4 Critical in `next@16.3.3` & `shadcn`)**, a **2.73 MB SQLite backup with user password hashes tracked in git**, and **underwater PKR 2,500/6,000 flat pricing** block institutional acquisition today.
- **Proposal vs. Code Reality:** The codebase (`8,028` LOC `backend/core`, `14,209` LOC `frontend`, `3,579` LOC tests) significantly **exceeds** the proposal on security and infra (pgvector HNSW, Celery/Redis, S3 presigned uploads, TOTP MFA, HMAC daily QR tokens, multi-format template/docgen), while **lagging** on user-planned SaaS features (notifications, admin moderation review queue, Expo mobile app) and academic benchmark dataset sizes.
- **Bottom Line:** Fix the 6 P0 hygiene/security blockers (~14 hours), merge `infra` -> `main`, and run the 1-time AWS bootstrap (~6 hours) to go live for 5–7 concurrent users at **~$64–$79/month** on AWS `ap-south-1`.

---

## 2. Proposal Requirements Extracted (`P1`–`P39`)

> Extracted directly from `DocuTrust_AI_FYP_Proposal.docx` (134 paragraphs, 13 tables) before code inspection.

### 2.1 Core Functional Modules & Deliverables
- **P1 — Multi-Tenant Organization & Isolation (`Sec. 1, 7.1`):** Multiple organizations share one deployment; every record (`User`, `Document`, `Chunk`, `ChatConversation`, `AskLog`, `AttendanceRecord`, `AuditLog`) carries a `company_id` FK filtered at the ORM query layer (`0%` cross-tenant leakage).
- **P2 — Three-Tier Role-Based Access Control (`Sec. 1, 7.1`):** Platform Admin (`is_platform_admin=True`, cross-tenant oversight), Company Admin (`role="admin"`, manages company docs/users/analytics/settings), and Employee (`role="employee"`, read/chat/attendance/workflows).
- **P3 — Company Onboarding & Access Codes (`Sec. 7.1, 7.2`):** Self-service company creation or joining an existing company via an access code; department assignment (`Department` model).
- **P4 — Authentication & Account Security (`Sec. 1, 7.1`):** HttpOnly cookie JWT authentication (`SimpleJWT`), token rotation, SHA-256 hashed one-time tokens (`OneTimeToken`) for email verification and password reset, and sliding-window rate limiting.
- **P5 — Multi-Format Document Ingestion & OCR Fallback (`Sec. 1, 7.2, 7.4`):** Upload `.pdf`, `.docx`, `.pptx`, `.txt`, `.md`, `.csv`, and image files (`.png`, `.jpg`, `.jpeg`, `.webp`); automatic `pytesseract` + `pdf2image` OCR fallback when a PDF page yields `< 30` characters of selectable text; target extraction success rate **$\ge 95\%$**.
- **P6 — Overlapping Text Chunking & Embedding (`Sec. 7.4`):** Character-based sliding window chunking (`chunk_size = 900` chars, `overlap = 150` chars) with paragraph/sentence boundary awareness; dense vector embedding via `nomic-embed-text` (768-dim) or `gemini-embedding-001`.
- **P7 — Document Management Lifecycle (`Sec. 7.2`):** Document versioning (`DocumentVersion`), tags, raw preview, re-indexing, batch deletion, three access scopes (`company`, `department`, `restricted` via `DocumentAccess`), and cross-company single-document sharing (`DocumentShare`).
- **P8 — Organizational Knowledge Foundation (OKF) (`Sec. 1, 7.4, 7.5`):** Admin-authored high-priority persistent text notes stored as special `is_okf=True` documents that proposal states are *"always injected into the LLM prompt regardless of the question's phrasing."*
- **P9 — Hybrid Retrieval Pipeline (`Sec. 1, 5, 7.5, RQ1`):** Weighted linear combination of normalized Okapi BM25 ($k_1 = 1.5, b = 0.75$, weight $\alpha = 0.3$) and cosine dense similarity (weight $1 - \alpha = 0.7$), returning top $K = 4$ chunks; target Top-3 retrieval precision **$\ge 85\%$**.
- **P10 — Bilingual Streaming RAG Chat (`Sec. 1, 7.2, 7.5`):** Server-Sent Events (SSE) token streaming, multi-turn conversation history (`ChatConversation`, `ChatMessage`), inline source citations (`[DocName]`), per-message ratings (`+1`/`-1`), and automatic language mirroring in **English** and **Roman Urdu**.
- **P11 — Strict Grounding & Refusal Guardrail (`Sec. 7.5`):** System prompt forces the LLM to answer strictly from retrieved context and explicitly refuse unanswerable questions without hallucinating external facts.
- **P12 — Conversational Intent Detection & Automated Workflows (`Sec. 1, 7.6, RQ2`):** Hybrid regex + LLM JSON classifier detecting `general_query`, `schedule_meeting`, and `leave_request` in English and Roman Urdu with **$\ge 88\%$** accuracy and **$\ge 95\%$** no-false-action precision on policy queries:
  - **P12a (`schedule_meeting`):** Extracts title, date, time, duration, attendees; creates Google Calendar event via service account (or graceful simulated fallback) + sends email confirmation.
  - **P12b (`leave_request`):** Extracts employee name, leave type, start/end dates, reason; generates a downloadable pre-filled `.docx` leave application form (**$\ge 98\%$** valid `.docx` generation rate) and records an `AuditLog` entry.
- **P13 — Content Moderation & Prompt-Injection Defense (`Sec. 7.6, RQ4`):** Pre-LLM screening of user messages for profanity, harassment, and prompt-injection patterns; blocks/flags offending queries (`AskLog.flagged = True`) before reaching the LLM and logs to `AuditLog`.
- **P14 — QR-Based Daily Attendance & 3-Strike Account Freeze (`Sec. 1, 7.7, RQ3`):** Company QR endpoint (`/api/attendance/qr`) + employee check-in (`/api/attendance/mark`) recording one `AttendanceRecord` per employee per day (`unique_together = (user, date)`); monthly evaluation (`evaluate_month`) counts Mon–Fri working days minus present days, assigns a strike (`UserStrike`) if absences $> 2$ in a month, and freezes/deactivates the account (`is_frozen = True`, `is_active = False`) at $\ge 3$ cumulative strikes (**$100\%$** agreement with manual spreadsheet).
- **P15 — Admin Analytics, Announcements & Audit Log (`Sec. 7.1, 7.2`):** Admin dashboard reporting daily query volume (asks/day), unanswered queries, flagged queries, top askers, company-wide `Announcement` CRUD, and immutable `AuditLog` trail.
- **P16 — Multi-Provider LLM Abstraction & BYO Key (`Sec. 7.1, 7.5`):** Pluggable provider interface supporting local `Ollama`, `Google Gemini`, `OpenAI`, and `Anthropic` (plus `AWS Bedrock` per updated scope), configurable globally via env or per-company (`LLMConfig` with BYO API key).
- **P17 — Subscription Plans & Quota Enforcement (`Sec. 7.1, 10`):** Tiered `Plan` model enforcing `max_users`, `max_documents`, `max_storage_mb`, and `max_asks_per_month`, with proposed pricing of **Free (PKR 0)**, **Starter (PKR 2,500/mo)**, and **Growth (PKR 6,000/mo)**.

### 2.2 Non-Functional, Evaluation & Academic Milestones
- **P18 — Latency Target (`Sec. 7.8`):** Median chat Time-to-First-Byte (TTFB) **$< 2.5\text{ seconds}$** under cloud LLM provider.
- **P19 — Concurrency & Load Target (`Sec. 7.8`):** Locust load testing with **10, 25, and 50 virtual users** sustaining $< 5\text{ s}$ p95 latency and $< 1\%$ error rate.
- **P20 — Security Testing (`Sec. 7.8`):** Cross-tenant penetration test suite + **OWASP ZAP** automated baseline scan reporting zero High/Critical alerts.
- **P21 — Evaluation Datasets (`Sec. 7.3`):**
  - **P21a:** Policy corpus of **30–50 synthetic company documents** across 3 simulated organizations.
  - **P21b:** QA benchmark of **100–150 question-answer pairs** (~50% English, ~50% Roman Urdu, including 25 unanswerable refusal questions).
  - **P21c:** Intent benchmark of **150–200 labeled chat messages** across `schedule_meeting`, `leave_request`, and `general_query` (including adversarial look-alikes).
  - **P21d:** Moderation test set of **60–100 messages** (clean, profanity, harassment, prompt injection).
  - **P21e:** Attendance simulation of **10–15 synthetic employee-month records** covering 0, 1, 2, 3+ absences and leap-year February.
- **P22 — Usability Study (`Sec. 7.8`):** User Acceptance Testing (UAT) with **8–10 participants** achieving a System Usability Scale (SUS) score **$\ge 75 / 100$**.

### 2.3 User-Requested Post-Proposal Scope & Planned Roadmap Items (`U1`–`U17`)
- **U1:** AWS Bedrock (`ap-south-1` India inference profile `in.anthropic.claude-haiku-4-5-20251001-v1:0` + `amazon.titan-embed-text-v2:0`) as primary cloud provider, swappable via env/UI without code edits.
- **U2:** Custom template/form/email/letter generation (`docgen.py`) filling user details (e.g., `Saad Waseem`) into rough templates and returning copy-paste plain text or downloadable files without markdown clutter (`###`/`***`).
- **U3:** All 9 Next.js workspace pages (`overview`, `chat`, `documents`, `shared`, `attendance`, `members`, `audit`, `usage`, `settings`) + public `pricing`, `enterprise`, `infrastructure`, `policy`, `about`, `help` pages.
- **U4:** Root/super platform admin account (`Admin@openvault.site`) with cross-tenant access and MFA enforcement.
- **U5:** PostgreSQL 16 + `pgvector` HNSW index for vector search.
- **U6:** Celery + Redis background worker for asynchronous document indexing + Beat periodic tasks (re-queuing stuck pending documents, pruning old logs).
- **U7:** Redis-backed sliding-window rate limiting across multi-worker Gunicorn processes.
- **U8:** Fernet encryption at rest for `LLMConfig.api_key` and `User.mfa_secret`.
- **U9:** S3 object storage (`boto3`) with presigned PUT uploads and local-disk fallback.
- **U10:** Sentry error/performance monitoring integration.
- **U11:** Terraform IaC + GitHub Actions OIDC CI/CD targeting AWS ECS Fargate (`ap-south-1`).
- **U12:** Shared Notification System (email on doc share, notification when new docs are indexed, in-app bell + unread count, team chat with notifications, mobile push).
- **U13:** Policy violation tracker with dedicated Admin Review Queue (approve/dismiss/escalate flagged questions).
- **U14:** Additional HR/admin workflows (expense requests, multi-step manager approvals).
- **U15:** Real production email backend (AWS SES / SMTP) + full live Google Calendar setup.
- **U16:** Mobile app (Expo + React Native) replicating the web dashboard + push endpoint + Bearer-auth check on attendance QR.
- **U17:** Deferred items: Google OAuth, WhatsApp bot.

---

## 3. Current Infrastructure & Cloud Architecture (Excluding Model Hosting)

### 3.1 Repository Inventory & Line Counts (`VERIFIED`)

| Area | Path | Tracked Files | Real Line Count | Notes |
|---|---|---:|---:|---|
| **Backend Core App** | `backend/core/*.py` | 24 | **8,028** | `views.py` (2,483), `rag.py` (951), `providers.py` (928), `docgen.py` (913), `models.py` (677), `serializers.py` (337), `workflow.py` (287), `storage.py` (201), `attendance.py` (148) |
| **Backend Config** | `backend/config/*.py` | 6 | **515** | `settings.py` (459), `urls.py` (15), `celery.py` (13), `views.py` (12), `asgi.py` (9), `wsgi.py` (7) |
| **Backend Migrations** | `backend/core/migrations/*.py` | 19 | **1,028** | `0001_initial.py` through `0018_generatedartifact.py` (includes `0016_chunk_pgvector.py`) |
| **Backend Management Cmds** | `backend/core/management/commands/*.py` | 17 | **1,862** | `seed_demo.py`, `run_rag_eval.py`, `run_template_eval.py`, `bootstrap_platform_admin.py`, `evaluate_attendance.py`, etc. |
| **Backend Tests** | `backend/tests/*.py` | 23 | **3,579** | 214 test functions (plus 1 untracked `test_deploy_config.py`) |
| **Frontend App (Next.js 16)** | `frontend/**/*.{ts,tsx,mjs,css}` | 52 | **14,209** | 20 `app/**/page.tsx` routes (8,981 lines), `components/` (2,276 lines), `lib/` (2,952 lines) |
| **Terraform IaC** | `infra/**/*.tf` | 35 | **3,919** | `120` `resource` blocks across `bootstrap/`, `envs/staging/`, `envs/prod/`, and 9 modules |
| **GitHub Actions CI/CD** | `.github/workflows/*.yml` | 5 | **504** | `ci.yml` (132), `deploy.yml` (151), `rollback.yml` (60), `terraform-plan.yml` (76), `terraform-apply.yml` (85) |
| **Operational Scripts** | `scripts/*.{sh,py}` | 13 | **2,256** | `deploy_ecs.sh`, `rollback_ecs.sh`, `smoke_test.sh`, `load_test.py`, `verify_backups.sh`, etc. |
| **Documentation & ADRs** | `docs/**/*.md` | 43 | **2,600** | Architecture, runbooks, threat model, 11 ADRs (`ADR-0001` to `ADR-0011`), `FINAL_REPORT.md` |

**Git History Summary (`VERIFIED` via `git log` & `git status`):**
- **Active branch:** `infra` (`77` commits; `58` by `SenseiSaad`, `19` by `Saad Waseem`, spanning `2026-09-26` to `2026-11-04`).
- **Branch divergence (`CRITICAL`):** `remotes/origin/main` is at commit `dd354f2` (`2026-10-27`), which is **22 commits and +30,892 lines behind `infra`**. All Terraform (`infra/`), ECS deploy workflows, `docgen.py`, MFA, and pgvector work exist **only on the local `infra` branch** and have not been pushed/merged to `origin/main`.
- **Dirty working tree:** `15` modified files and `7` untracked paths (`.env.vercel.example`, `backend/.vercelignore`, `backend/templates/`, `backend/tests/test_deploy_config.py`, `backend/vercel.json`, `docs/VERCEL.md`, `frontend/vercel.json`).

---

### 3.2 Terraform IaC Inventory (`infra/`) — Written vs. Deployed (`VERIFIED` / `UNKNOWN`)

All Terraform code targets AWS region `ap-south-1` (Mumbai) with Terraform `>= 1.6` and AWS provider `~> 5.0` (`infra/envs/prod/main.tf:1-25`).

| Category | Resource Defined in Repo (`infra/modules/*`) | File:Line Evidence | Status in Code | Live in AWS (`811364789434`)? |
|---|---|---|---|---|
| **Tfstate Backend** | S3 bucket (versioned, KMS, public-block, TLS-only policy) + DynamoDB lock table | `infra/bootstrap/main.tf:25-113` | `VERIFIED` | **NOT DEPLOYED** (`aws s3api list-buckets` -> `[]`) |
| **VPC & Subnets** | VPC (`10.20.0.0/16` staging, `10.30.0.0/16` prod), 2 Public + 2 Private App + 2 Isolated Data subnets across 2 AZs, IGW, 1–2 NAT Gateways, VPC Flow Logs | `infra/modules/network/main.tf:19-160` | `VERIFIED` | **NOT DEPLOYED** (`describe-vpcs` -> only default `172.31.0.0/16`) |
| **VPC Endpoints** | Gateway S3 endpoint (`free`), Optional Interface endpoints (`ecr.api`, `ecr.dkr`, `logs`, `ssm`, `secretsmanager`, `kms`) controlled by `enable_interface_endpoints` | `infra/modules/network/main.tf:166-226` | `VERIFIED` | **NOT DEPLOYED** |
| **Security Groups** | 5 least-privilege SGs: `alb` (80/443), `ecs` (8000/3000 from ALB only, 443/587 egress), `rds` (5432 from ECS SG only), `redis` (6379 from ECS SG only), `vpce` | `infra/modules/network/main.tf:228-365` | `VERIFIED` | **NOT DEPLOYED** |
| **ECR Registries** | Immutable image tags (`IMMUTABLE`), scan-on-push, KMS encryption, lifecycle policy keeping last 20 tagged images (`api` & `web`) | `infra/modules/registry/main.tf:1-84` | `VERIFIED` | `UNKNOWN` (`ecr:DescribeRepositories` -> `AccessDenied`) |
| **RDS PostgreSQL 16** | `postgres:16.4` (`db.t4g.micro` default), GP3 KMS-encrypted storage, `rds.force_ssl=1`, Secrets Manager master password, backup retention (7d staging / 14d prod), `pgvector` enabled via migration `0016` | `infra/modules/data/main.tf:22-146`, `migrations/0016_chunk_pgvector.py:1-61` | `VERIFIED` | `UNKNOWN` (`rds:DescribeDBInstances` -> `AccessDenied`) |
| **ElastiCache Redis 7** | `aws_elasticache_replication_group` Redis 7.1 (`cache.t4g.micro`), TLS in-transit, encryption at rest, auth token in Secrets Manager | `infra/modules/data/main.tf:148-219` | `VERIFIED` | `UNKNOWN` (`elasticache` -> `AccessDenied`) |
| **S3 Media Bucket** | Private tenant document bucket (`SSE-KMS`, versioning, TLS-only bucket policy, CORS for presigned PUT, 30d noncurrent expiration, abort incomplete multipart) | `infra/modules/data/main.tf:221-334` | `VERIFIED` | **NOT DEPLOYED** (`aws s3api list-buckets` -> `[]`) |
| **Secrets & SSM** | Secrets Manager JSON app secret (`SECRET_KEY`, `LLM_KEY_ENCRYPTION_KEY`) + 7 SSM SecureString parameters (`DATABASE_URL`, `CACHE_URL`, `SECRET_KEY`, `LLM_KEY_ENCRYPTION_KEY`, `SENTRY_DSN`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`) | `infra/modules/data/main.tf:336-391`, `infra/envs/prod/main.tf:166-237` | `VERIFIED` | `UNKNOWN` (`ssm:DescribeParameters` -> `AccessDenied`) |
| **ALB & Listeners** | Public ALB, HTTP->HTTPS redirect, HTTPS `TLS13-1-2-2021-06`, path routing (`/api/*`, `/admin/*`, `/static/*` -> API `:8000`; `/*` -> Web `:3000`) | `infra/modules/ecs/main.tf:26-143` | `VERIFIED` | **NOT DEPLOYED** (`describe-load-balancers` -> `0`) |
| **ECS Fargate Cluster** | ECS cluster with Container Insights, Fargate/Fargate-Spot capacity providers, 3 services (`api`, `web`, `worker`), Execute Command enabled, circuit breaker with auto-rollback, plus standalone `migrate` task definition | `infra/modules/ecs/main.tf:1-25, 224-510` | `VERIFIED` | **NOT DEPLOYED** (`aws ecs list-clusters` -> `[]`) |
| **Autoscaling** | Application Auto Scaling for `api` and `web` services (CPU 65% and Memory 75% target tracking, `min=1..2`, `max=4..6`) | `infra/modules/ecs/main.tf:512-589` | `VERIFIED` | **NOT DEPLOYED** |
| **IAM & GitHub OIDC** | GitHub OIDC provider (`token.actions.githubusercontent.com`), `tf-plan`, `tf-apply`, `image-build`, `ecs-deploy` roles; ECS execution role + task role (scoped S3, SES, and `bedrock:InvokeModel*` on `in.anthropic.*` and `amazon.titan-embed-text-v2:0`) | `infra/modules/iam_oidc/main.tf:1-265`, `infra/modules/ecs/main.tf:145-222` | `VERIFIED` | `UNKNOWN` (`iam:ListOpenIDConnectProviders` -> `AccessDenied`) |
| **Route 53 & ACM** | Subdomain Route 53 zone (`staging.` / `app.`), ACM cert with DNS validation, ALB A/AAAA alias records | `infra/modules/dns_tls/main.tf:1-79` | `VERIFIED` | `UNKNOWN` (`route53:ListHostedZones` -> `AccessDenied`) |
| **SES Email** | `aws_sesv2_email_identity`, DKIM CNAME records, MAIL FROM domain, configuration set with TLS required | `infra/modules/ses/main.tf:1-91` | `VERIFIED` | `UNKNOWN` (`sesv2` -> `AccessDenied`) |
| **CloudWatch & Budgets** | KMS-encrypted log groups, metric filter for 5xx/ERROR, CloudWatch dashboard, 6 alarms (ALB 5xx, latency p95, unhealthy hosts, ECS CPU, RDS storage, RDS connections), SNS topic, AWS Monthly Budget ($30 staging / $150 prod) | `infra/modules/observability/main.tf:1-278` | `VERIFIED` | **NOT DEPLOYED** (`describe-alarms` -> `[]`) |
| **AWS Bedrock Access** | `in.anthropic.claude-haiku-4-5-20251001-v1:0` and `amazon.titan-embed-text-v2:0` in `ap-south-1` | Tested live via `aws bedrock get-foundation-model-availability --region ap-south-1` | `VERIFIED` | **LIVE & AUTHORIZED** (`authorizationStatus: AUTHORIZED`, `entitlementAvailability: AVAILABLE`) |
| **CloudFront / WAF** | Not defined (`WAF` and `CloudFront` resources do not exist in `infra/`) | Searched `aws_wafv2*`, `aws_cloudfront*` -> `0` matches | `MISSING` | **NOT BUILT** |

---

### 3.3 CI/CD Pipelines (`.github/workflows/`) (`VERIFIED`)

All AWS-interacting workflows use **short-lived GitHub OIDC (`aws-actions/configure-aws-credentials@v4` with `id-token: write`)** — zero long-lived `AWS_ACCESS_KEY_ID` secrets are used in GitHub Actions (`VERIFIED`).

1. **`ci.yml` (`PRs + push to main`):**
   - `secret-scan`: Runs `gitleaks/gitleaks-action@v2`.
   - `backend`: Python 3.12 + PostgreSQL 16 (`pgvector/pgvector:pg16`) + Redis 7 service containers -> runs `bandit -r core config -ll -ii`, `pip-audit -r requirements.txt`, `manage.py check`, `manage.py makemigrations --check --dry-run`, and `pytest --cov=core --cov-report=xml --cov-fail-under=60`.
   - `frontend`: Node 20 + `pnpm` -> runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm audit --audit-level=high` (**NOTE:** `pnpm audit --audit-level=high` will currently **FAIL** in CI due to 4 Critical + 36 High advisories in `frontend/pnpm-lock.yaml`!).
   - `docker`: Builds `backend/Dockerfile` (`openvault-api:ci`) and `frontend/Dockerfile` (`openvault-web:ci`).
2. **`deploy.yml` (`push to main`):**
   - Assumes `vars.BUILD_ROLE_ARN` via OIDC, builds `openvault-api:${{ github.sha }}` and `openvault-web:${{ github.sha }}` (with `NEXT_PUBLIC_API_URL=` empty for same-origin ALB routing), pushes to staging & prod ECR.
   - `staging` job assumes `vars.DEPLOY_ROLE_ARN` and runs `./scripts/deploy_ecs.sh staging <sha>` (renders new task definitions, runs one-off ECS `migrate` task and waits for exit code `0`, updates `api`/`worker`/`web` services, waits `services-stable`, runs `./scripts/smoke_test.sh`).
   - `production` job (gated by `environment: production` reviewer approval) runs `./scripts/deploy_ecs.sh prod <sha>`.
3. **`rollback.yml` (`workflow_dispatch`):**
   - Takes `environment` (`staging`|`prod`) and target `image_tag`, assumes deploy role via OIDC, and runs `./scripts/rollback_ecs.sh`.
4. **`terraform-plan.yml` (`PRs touching infra/**`):**
   - Runs `terraform fmt -check -recursive`, `tflint --recursive`, `aquasecurity/trivy-action` config scan, and `terraform plan` against staging using OIDC `TF_PLAN_ROLE_ARN`.
5. **`terraform-apply.yml` (`workflow_dispatch`):**
   - Runs `terraform plan` + `terraform apply` for `staging` or `prod` (gated by GitHub Environment reviewer) via OIDC `TF_APPLY_ROLE_ARN`.

---

### 3.4 Where Frontend, Backend & Document Indexing Run (`VERIFIED`)

- **Backend (`api`):** Gunicorn (`config.wsgi:application`, `--workers 2 --threads 4 --timeout 120`, port `8000`) inside `backend/Dockerfile` (`python:3.12-slim` + `tesseract-ocr`, `tesseract-ocr-urd`, `poppler-utils`, non-root user `app`, `readOnlyRootFilesystem = true` on ECS).
- **Frontend (`web`):** Next.js 16 standalone server (`node server.js`, port `3000`) inside `frontend/Dockerfile` (`node:20-alpine` multi-stage build, non-root user `nextjs`).
- **Document Indexing Worker (`worker`) — Hybrid Async/Sync (`backend/core/tasks.py:13-48`):**
  - When `CELERY_BROKER_URL` is set (ECS production/staging runs a dedicated `worker` ECS service executing `celery -A config worker -l info --concurrency=2 -B`), `dispatch_index_document(doc_id)` enqueues `index_document_task.delay(doc_id)` onto Redis and Celery Beat runs `requeue_stuck_documents_task` every 5 minutes (`backend/config/settings.py:429-443`).
  - When `CELERY_BROKER_URL` is blank (local dev default), it spawns a daemon `threading.Thread` so the HTTP upload returns `201 Created` (`status="pending"`) immediately while OCR/chunking/embedding runs in the background thread.
  - When `SYNC_INDEXING=true` (or `VERCEL=1`), indexing runs synchronously inside the upload HTTP request (`backend/core/tasks.py:41-44`).

---

### 3.5 Text Architecture Diagrams (`VERIFIED`)

#### Diagram A — What Actually Exists Today (Local Working State vs. Unapplied IaC)

```text
=====================================================================================
1. LIVE ON AWS ACCOUNT 811364789434 (ap-south-1) TODAY:
=====================================================================================
  [ AWS Bedrock (ap-south-1) ]
    ├── in.anthropic.claude-haiku-4-5-20251001-v1:0  (ACTIVE & AUTHORIZED)
    └── amazon.titan-embed-text-v2:0                 (ACTIVE)

  * ECS Clusters: 0   * ALBs: 0   * S3 Buckets: 0   * Custom VPCs: 0 (default only)
  * Terraform State: Not initialized / never applied (`docs/FINAL_REPORT.md:7`)

=====================================================================================
2. WHAT RUNS LOCALLY TODAY (`docker compose` / local dev):
=====================================================================================
  Browser (http://localhost:3000)
     │
     ├──► Next.js 16 Dev/Standalone (:3000)  [frontend/]
     │
     └──► Django 5.2 + DRF + Gunicorn (:8000) [backend/]
             ├── Auth: HttpOnly JWT cookies + TOTP MFA + SHA-256 OneTimeToken
             ├── DB:   SQLite (`backend/db.sqlite3`) OR optional Postgres 16 (`--profile pg`)
             ├── Cache: LocMemCache OR optional Redis 7 (`--profile redis`)
             ├── Queue: Daemon Python Thread (`tasks.py`) when CELERY_BROKER_URL is unset
             ├── Files: Local disk (`backend/data/`) + untracked `backend/templates/`
             └── LLM/Embed: Pluggable (`providers.py`) -> Ollama (:11434) / Gemini / Bedrock
```

#### Diagram B — Minimal Production Setup for 5–7 Concurrent Users (`ap-south-1`) & What Is Missing to Go Live

```text
                         Internet Users (5–7 concurrent)
                                       │ HTTPS (TLS 1.3)
                                       ▼
                        [ Route 53 Subdomain + ACM Cert ]  ◄── MISSING: Parent domain NS delegation
                                       │
                    ┌──────────────────┴──────────────────┐
                    │      Public Subnets (2 AZs)         │
                    │  [ Application Load Balancer (ALB) ]│
                    │    /api/*, /admin/* ──► API :8000   │
                    │    /*               ──► Web :3000   │
                    │  [ 1x NAT Gateway (Single-AZ) ]     │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │     Private App Subnets (2 AZs)     │
                    │  ECS Fargate Cluster (ap-south-1):  │
                    │   • web    (0.25 vCPU / 0.5 GB) x1  │
                    │   • api    (0.50 vCPU / 1.0 GB) x1  │
                    │   • worker (0.50 vCPU / 1.0 GB) x1  │ ◄── Celery Worker + Beat
                    └───┬──────────────┬──────────────┬───┘
                        │              │              │
         ┌──────────────┘              │              └──────────────┐
         ▼                             ▼                             ▼
┌─────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│ Isolated Data (2AZ) │   │ AWS Managed Services    │   │ AWS Bedrock (ap-south-1)│
│ • RDS Postgres 16.4 │   │ • S3 Bucket (KMS docs)  │   │ • Claude Haiku 4.5      │
│   + pgvector HNSW   │   │ • Secrets Mgr + SSM     │   │   (in.anthropic.*)      │
│   (db.t4g.micro)    │   │ • SES v2 (Out of Sandbox│   │ • Titan Embed Text v2   │
│ • ElastiCache Redis │   │   REQUIRED for prod!)   │   │   (1024-dim vectors)    │
│   7.1 (t4g.micro)   │   │ • CloudWatch + Budgets  │   └─────────────────────────┘
└─────────────────────┘   └─────────────────────────┘
```

### 3.6 Monthly AWS Cost Estimate for Minimal 5–7 Concurrent Users (`ap-south-1` Mumbai)

**Assumptions:** Region `ap-south-1` (Mumbai), 730 hours/month, single-AZ NAT (`single_nat_gateway = true`), single-AZ `db.t4g.micro` RDS (20 GB GP3), single-node `cache.t4g.micro` Redis, `enable_interface_endpoints = false` (uses free S3 gateway endpoint + NAT), 1x task each for `api` (0.5 vCPU/1 GB), `web` (0.25 vCPU/0.5 GB), `worker` (0.5 vCPU/1 GB on **Fargate Spot** for worker), and ~5,000 RAG chat queries/month (~15M input tokens, ~2.5M output tokens on Claude Haiku 4.5 + 5M Titan Embed V2 tokens).

| Component | Sizing (`infra/envs/staging` minimal profile) | Monthly Cost (USD) | Cost Optimization Note |
|---|---|---:|---|
| **NAT Gateway (x1)** | 730 hrs @ $0.045/hr + ~5 GB data @ $0.045/GB | **$33.08** | Largest idle cost; can drop to **$3.50/mo** with a `t4g.nano` NAT instance or placing ECS in public subnets with `assign_public_ip=true` + strict SG (blocked only admitting ALB SG) |
| **Application Load Balancer** | 730 hrs @ $0.0225/hr + ~0.1 LCU | **$17.20** | Required for managed ACM HTTPS + path routing |
| **ECS Fargate (`api` + `web` + `worker`)** | `api` (0.5 vCPU/1GB): ~$18.10; `web` (0.25 vCPU/0.5GB): ~$9.05; `worker` (0.5 vCPU/1GB Spot): ~$5.50 | **$32.65** | Or reduce `api` to `0.25 vCPU / 0.5 GB` + combine Beat in `worker` -> saves ~$9/mo |
| **RDS PostgreSQL 16 (`db.t4g.micro`)** | Single-AZ (730 hrs @ ~$0.018/hr) + 20 GB GP3 ($2.30) | **$15.44** | ($0.00 for first 12 months if AWS Free Tier eligible) |
| **ElastiCache Redis (`cache.t4g.micro`)** | Single node (730 hrs @ ~$0.017/hr) | **$12.41** | ($0.00 on AWS Free Tier, or replace with Upstash free tier) |
| **Route 53 + S3 + KMS + Secrets + Logs** | 1 hosted zone ($0.50), 2 KMS keys ($2.00), 1 Secret ($0.40), 5 GB S3/Logs (~$1.50) | **$4.40** | 7 SSM standard parameters are $0.00 |
| **AWS Bedrock (`ap-south-1`)** | 15M input tokens ($1/M = $15) + 2.5M output tokens ($5/M = $12.50) + Titan Embed V2 ($0.10) | **~$10.00–$27.60** | Usage-based (~$5–$10/mo at 5–7 users / ~1,500 asks/mo) |
| **Total (As-Written Terraform Minimal)** | With 1x NAT Gateway, no Free Tier credits | **~$125.18 / mo** | Matches `docs/COST_MODEL.md` ($118–$130/mo) |
| **Total (With Free Tier RDS/Redis OR Public-IP ECS dropping NAT)** | Removing NAT Gateway (-$33) + Free Tier RDS/Redis (-$27.85) | **~$64.33 – $79.00 / mo** | Recommended initial 5–7 user launch posture |

---

## 4. Local Readiness Verdict & Evidence

### 4.1 Clean-Clone Startup Audit (`PARTIAL` — 3 Undocumented Gotchas)

If a buyer or evaluator clones the repo from git and copies `.env.example` -> `.env`:
1. **`git clone` from `origin/main` gets an outdated repo (`CRITICAL`):** `origin/main` (`dd354f2`) is 22 commits behind local `infra` (`08e1036`).
2. **`backend/templates/` is UNTRACKED in git (`?? backend/templates/`) (`HIGH`):** `backend/core/docgen.py:39` reads `TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"` (`form_expense_claim.md`, `form_it_access_request.md`, `leave_request_form.txt`). On a clean git checkout or CI Docker build, `backend/templates/` is missing unless committed!
3. **`docker compose up --build` requires `SECRET_KEY` manually generated (`LOW`):** `docker-compose.yml:15` has `${SECRET_KEY:?Set SECRET_KEY in .env}`, and `.env.example:4` has `SECRET_KEY=` (empty). Thus `cp .env.example .env && docker compose up` fails immediately until the user generates a secret key and fills `SECRET_KEY=...`.
4. **No `lint` script in `frontend/package.json` (`LOW`):** Running `pnpm lint` fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL: Command "lint" not found` (`frontend/package.json:7-14` only defines `dev`, `build`, `start`, `typecheck`, `test`, `test:watch`).

### 4.2 Automated Test, Build & Evaluation Results (`VERIFIED`)

All commands below were executed against `/home/saad/Desktop/OpenVault`:

1. **Backend Test Suite & Coverage (`pytest --cov=core --cov=config`):**
   - **Result:** **`214 passed` in `~190s` (`0 failed`)** (`VERIFIED`).
   - **Total Coverage:** **`74%`** (`5,572` statements, `1,454` missed; excluding `management/commands/*`, core runtime coverage is **`81%`**):
     - `core/auth.py`: `100%` | `core/crypto.py`: `100%` | `core/permissions.py`: `100%` | `core/qr_tokens.py`: `100%` | `core/admin.py`: `100%`
     - `core/attendance.py`: `99%` | `core/mfa.py`: `98%` | `core/serializers.py`: `97%` | `core/middleware.py`: `96%` | `core/models.py`: `95%`
     - `core/docgen.py`: `93%` | `core/ratelimit.py`: `93%` | `core/mfa_admin.py`: `86%` | `core/moderation.py`: `85%` | `core/uploads.py`: `83%`
     - `core/workflow.py`: `81%` | `core/tasks.py`: `80%` | `core/views.py`: `79%` | `config/settings.py`: `78%` | `core/netguard.py`: `75%`
     - `core/providers.py`: `72%` | `core/rag.py`: `63%` | `core/storage.py`: `55%`
2. **Offline RAG Evaluation (`python manage.py run_rag_eval`):**
   - **Result:** `questions: 84, k: 4 | hit-rate@4: 0.982 | MRR: 0.539 | refusal proxy: 1.0 | cross-tenant leaks: 0 | ACL violations: 0 -> RAG eval passed.` (`VERIFIED`).
3. **Deterministic Template/Docgen Evaluation (`python manage.py run_template_eval`):**
   - **Result:** `cases: 20 | placeholder_accuracy: 0.75 | no_invention_rate: 1.0 | missing_line_rate: 1.0 | pass_rate: 0.75` (`5/20` cases failed strict `kept=False` check: `t01`, `t04`, `t05`, `t07`, `t13`) (`VERIFIED`).
4. **Frontend Typecheck, Unit Tests & Production Build (`frontend/`):**
   - `pnpm typecheck` (`next typegen && tsc --noEmit`): **Passed (`0` errors)** (`VERIFIED`).
   - `pnpm test --run` (Vitest): **`3 passed` test files (`lib/i18n.test.ts`, `lib/pricing.test.ts`, `lib/markdown-render.test.tsx`), `12 passed` tests** (`VERIFIED`).
   - `pnpm build` (`next build` Next.js 16.3.3 Turbopack): **Compiled in `8.8s`, all `22/22` static routes generated cleanly** (`VERIFIED`).

### 4.3 End-to-End User Flow Matrix (`VERIFIED`)

| # | User Flow | Verdict | Evidence (`file:line` & test verification) |
|---|---|---|---|
| 1 | **Register -> Verify Email -> Login -> Refresh -> Logout** | **`WORKS`** | `backend/core/views.py:216-435`, `frontend/app/auth/page.tsx:1-123`, `frontend/app/auth/verify/page.tsx:1-77`. Tested in `backend/tests/test_auth.py` (cookie rotation, SHA-256 verification token, lockout). Locally `REQUIRE_EMAIL_VERIFICATION=false` allows immediate login; console email prints verification URL. |
| 2 | **Create Company / Join via Access Code** | **`WORKS`** | `backend/core/views.py:239-280`, `backend/core/models.py:42-108` (`Company.access_code` auto-generated). Tested in `backend/tests/test_isolation.py` & `test_smoke_flow.py`. |
| 3 | **Upload Doc -> OCR/Chunking/Indexing -> Preview/Download/Versions** | **`WORKS`** | `backend/core/views.py:725-1065`, `backend/core/rag.py:130-265`, `frontend/app/workspace/documents/page.tsx:1-1596`. Supports PDF, DOCX, PPTX, TXT, MD, CSV, PNG/JPG/WEBP + OKF notes + S3 presigned uploads (`test_uploads.py`, `test_s3_storage.py`). |
| 4 | **Bilingual RAG Chat with Citations + Template/Email/Letter Drafts** | **`WORKS`** | `backend/core/views.py:1215-1535` (`/api/chat` & `/api/chat/stream`), `backend/core/rag.py:415-690`, `backend/core/docgen.py:1-913`, `frontend/app/workspace/chat/page.tsx:1-1633`. Plain-text formatting + copy-paste ready artifacts & `.docx`/`.pdf`/`.md` exports (`test_docgen.py`). |
| 5 | **Cross-Company & Scoped Document Sharing (`company`/`department`/`restricted`)** | **`WORKS`** | `backend/core/views.py:1068-1212`, `frontend/app/workspace/shared/page.tsx:1-154`. Enforced in `rag.accessible_documents(user)` (`backend/core/rag.py:390-413`) and verified in `backend/tests/test_isolation.py`. |
| 6 | **Admin Analytics, Announcements, Members & Audit Log** | **`WORKS`** | `backend/core/views.py:1590-1890`, `frontend/app/workspace/page.tsx:1-785`, `frontend/app/workspace/members/page.tsx:1-790`, `frontend/app/workspace/audit/page.tsx:1-489`. Tracks asks/day, unanswered, flagged, top askers, and audit events. |
| 7 | **Attendance QR Generation -> Scan Check-in -> Monthly 3-Strike Freeze** | **`WORKS`** | `backend/core/views.py:2010-2215`, `backend/core/attendance.py:1-148`, `backend/core/qr_tokens.py:1-31`, `frontend/app/workspace/attendance/page.tsx:1-276`. Tested in `backend/tests/test_attendance.py` & `test_qr_tokens.py`. |
| 8 | **Platform Admin (`Admin@openvault.site`) + TOTP MFA** | **`WORKS`** | `backend/core/mfa.py:1-78`, `backend/core/mfa_admin.py:1-87`, `backend/core/management/commands/create_platform_admin.py:1-95`. Tested in `backend/tests/test_mfa.py` & `test_platform_admin_mfa.py`. |
| 9 | **Notification System (in-app bell, doc-share email, index alert, push)** | **`NOT BUILT`** | `0` models, `0` endpoints, `0` UI components in `backend/` or `frontend/`. |
| 10 | **Policy Violation Admin Review Queue (approve/dismiss/escalate)** | **`PARTIAL`** | Flagged prompts are logged (`AskLog.flagged=True`, `moderation.py`) and shown in analytics (`views.py:1792`), plus admins can manually adjust attendance strikes (`views.py:2135`), but there is no review-queue state machine (`status=pending_review|approved|dismissed`). |
| 11 | **Mobile App (Expo + React Native) & Bearer Auth on QR** | **`NOT BUILT`** | No mobile directory exists; furthermore `REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]` (`settings.py:239`) only enables `CookieJWTAuthentication` (Bearer header tokens are not accepted unless `JWTAuthentication` is added). |

---

## 5. Online Readiness Verdict ("Only Need to Add `.env`") & Env Inventory

### 5.1 Brutally Honest Verdict: **FALSE (Not "Only Add `.env`")** (`VERIFIED`)

The claim *"I only need to supply the updated `.env` to deploy"* is **false** for initial deployment (though **true for subsequent deployments** once bootstrapped). Here are the exact reasons why:
1. **GitHub Actions & ECS do NOT read a `.env` file:** In the AWS architecture (`infra/envs/prod/main.tf:166-237` and `.github/workflows/deploy.yml`), runtime configuration comes from **Terraform variables (`terraform.tfvars`)**, **AWS SSM Parameter Store / Secrets Manager**, and **GitHub Actions Environment Variables/Secrets** (populated by `scripts/setup_github.sh`).
2. **LLM Provider Swapping Works Without Code Changes (`VERIFIED`):** `backend/core/providers.py:727-885` cleanly decouples chat (`LLM_PROVIDER = ollama | openai | anthropic | gemini | bedrock`) and embeddings (`EMBED_PROVIDER = ollama | openai | gemini | bedrock | none`). Furthermore, Company Admins can switch providers/models live in the UI (`frontend/app/workspace/settings/page.tsx` -> `LLMConfig` model), and ECS task roles are pre-wired with `bedrock:InvokeModel*` (`infra/modules/ecs/main.tf:194-213`).
   - **CAVEAT on Embedding Swaps (`backend/core/migrations/0016_chunk_pgvector.py:18-35`):** While switching **chat** providers is instant, `Chunk.embedding_vec` is created with a fixed vector dimension (`EMBED_DIM`, default `1024` for Bedrock Titan V2, vs `768` for Ollama `nomic-embed-text`, `1536` for OpenAI, `3072` for Gemini). Changing `EMBED_PROVIDER` after running migrations requires altering `EMBED_DIM` and running `python manage.py reindex_embeddings`.

### 5.2 Complete Environment Variable Inventory (`VERIFIED` from `backend/config/settings.py`)

| Variable | Read At (`file:line`) | Default in Code | Required in Prod? | Purpose |
|---|---|---|---|---|
| `SECRET_KEY` | `settings.py:39` | None (`ImproperlyConfigured` if blank) | **YES** | Django cryptographic signing + JWT HMAC signing (`SIGNING_KEY`) |
| `ENVIRONMENT` | `settings.py:31` | `"development"` | **YES (`production`)** | Triggers strict production startup assertions (`settings.py:446-459`) |
| `DEBUG` | `settings.py:30` | `False` | **YES (`false`)** | Must be `false` in production (startup fails if `true` when `ENVIRONMENT=production`) |
| `ALLOW_INSECURE_HTTP` | `settings.py:35` | `False` | **NO (`false`)** | Disables HSTS/SSL redirect only for local Docker HTTP |
| `ALLOWED_HOSTS` | `settings.py:55` | `localhost,127.0.0.1` | **YES** | Comma-separated hostnames (cannot contain `*` in prod, `settings.py:451`) |
| `PUBLIC_BASE_URL` | `settings.py:66` | `http://localhost:3000` | **YES** | Used in email verification/reset links and artifact URLs |
| `CORS_ALLOWED_ORIGINS` | `settings.py:217` | `http://localhost:3000,...` | **YES** | Exact origins allowed to send credentials (`Cookie`) |
| `CSRF_TRUSTED_ORIGINS` | `settings.py:229` | Derived from `CORS_ALLOWED_ORIGINS` | Recommended | Explicit HTTPS origins for CSRF verification |
| `COOKIE_SECURE` | `settings.py:259` | `not DEBUG and not ALLOW_INSECURE_HTTP` | Auto (`true`) | Marks `ov_access`/`ov_refresh` cookies `Secure` |
| `COOKIE_SAMESITE` | `settings.py:261` | `"Lax"` | Optional (`Lax`) | Keep `Lax` for same-origin ALB; `None` for split-domain Vercel+Render |
| `COOKIE_DOMAIN` | `settings.py:260` | `None` | Optional | Optional shared parent domain for cookies |
| `ACCESS_TOKEN_MINUTES` | `settings.py:244` | `15` | Optional | Access JWT lifetime in minutes |
| `REFRESH_TOKEN_DAYS` | `settings.py:245` | `7` | Optional | Refresh JWT lifetime in days |
| `DATABASE_URL` | `settings.py:124` | Unset (falls back to `POSTGRES_*` or SQLite) | **YES (ECS/Neon)** | Full PostgreSQL DSN (`postgres://...`); parsed by `dj-database-url` |
| `POSTGRES_DB` / `USER` / `PASSWORD` / `HOST` / `PORT` | `settings.py:137-159` | Unset | Alt to `DATABASE_URL` | Used by `docker-compose.yml` `--profile pg` |
| `DB_CONN_MAX_AGE` | `settings.py:126` | `60` (`0` on Vercel) | Optional | Persistent DB connection pooling lifetime |
| `DB_SSL_REQUIRE` | `settings.py:130` | `True` in prod | Auto (`true`) | Forces `sslmode=require` on PostgreSQL |
| `CACHE_URL` | `settings.py:179` | `""` (`LocMemCache`) | **YES (ECS)** | `redis://` or `rediss://` URL for shared rate-limiting & cache |
| `CELERY_BROKER_URL` | `settings.py:424` | Defaults to `CACHE_URL` if `redis*` | Auto from `CACHE_URL` | Redis broker for Celery background indexing & Beat |
| `SYNC_INDEXING` | `settings.py:301` | `True` on Vercel else `False` | Optional (`false`) | Runs document indexing synchronously in HTTP request |
| `LLM_PROVIDER` | `settings.py:267` | `"ollama"` | **YES (`bedrock`)** | Default chat provider (`ollama`, `bedrock`, `gemini`, `openai`, `anthropic`) |
| `LLM_KEY_ENCRYPTION_KEY` | `settings.py:269` | `""` (derives from `SECRET_KEY`) | **YES** | Dedicated Fernet secret so rotating `SECRET_KEY` doesn't break saved tenant keys |
| `BEDROCK_REGION` | `settings.py:283` | `"ap-south-1"` | **YES** | AWS region for Bedrock runtime |
| `BEDROCK_MODEL` | `settings.py:282` | `in.anthropic.claude-haiku-4-5-20251001-v1:0` | **YES** | Default Bedrock chat inference profile |
| `BEDROCK_API_KEY` | `settings.py:284` | `""` (uses IAM role on ECS) | Optional on ECS | Bearer token or `AKIA...:SECRET` when running outside AWS |
| `EMBED_PROVIDER` | `settings.py:286` | Same as `LLM_PROVIDER` | **YES (`bedrock`)** | Vector embedding provider (`bedrock`, `ollama`, `gemini`, `openai`, `none`) |
| `BEDROCK_EMBED_MODEL` | `settings.py:290` | `amazon.titan-embed-text-v2:0` | **YES** | Bedrock embedding model |
| `EMBED_DIM` | `settings.py:293` | `1024` | **YES (`1024`)** | Must match embedding model output width (`1024` Titan V2, `768` nomic) |
| `TOP_K` / `RAG_MAX_CONTEXT_CHARS` | `settings.py:291-292` | `4` / `12000` | Optional | Retrieval top-$k$ cutoff and prompt context cap |
| `AWS_STORAGE_BUCKET_NAME` | `settings.py:92` | `""` (uses local disk `DATA_DIR`) | **YES (ECS)** | S3 bucket for tenant documents and generated forms |
| `AWS_S3_REGION_NAME` | `settings.py:93` | `AWS_REGION` or `ap-south-1` | **YES** | Region for S3 presigned URLs |
| `REQUIRE_EMAIL_VERIFICATION` | `settings.py:64` | `False` | **YES (`true`)** | Enforces verified email before login |
| `EMAIL_BACKEND` / `EMAIL_HOST` / `PORT` / `USER` / `PASSWORD` | `settings.py:308-315` | Console backend | **YES (SES SMTP)** | SMTP configuration for verification, reset, and workflow emails |
| `ATTENDANCE_QR_REQUIRED` | `settings.py:326` | `not DEBUG` (`True` in prod) | Auto (`true`) | Requires daily HMAC-signed token from `/api/attendance/qr` to mark attendance |
| `PLATFORM_ADMIN_REQUIRE_MFA` | `settings.py:331` | `True` in prod | Auto (`true`) | Blocks platform-admin endpoints unless TOTP MFA is verified |
| `SENTRY_DSN` | `settings.py:397` | `""` | Recommended | Enables Sentry error/trace telemetry (`send_default_pii=False`) |
| `NEXT_PUBLIC_API_URL` | `frontend/lib/api.ts:7` | Auto-detected from `window.location` | Empty `""` on ALB | Set empty `""` for same-origin ALB; set full URL for split frontend/API hosts |

### 5.3 Complete Production-Ready `.env.example` Template

```dotenv
# ============================================================================
# OpenVault — Complete Unified Environment Template (.env.example)
# ============================================================================

# ── 1. Core Security & Environment ──────────────────────────────────────────
# Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(50))"
SECRET_KEY=CHANGE_ME_GENERATE_WITH_SECRETS_TOKEN_URLSAFE_50
LLM_KEY_ENCRYPTION_KEY=CHANGE_ME_GENERATE_SEPARATE_FERNET_SECRET_50
ENVIRONMENT=development          # development | staging | production
DEBUG=false
ALLOW_INSECURE_HTTP=true         # MUST be false in staging/production!

# ── 2. Hosts, Origins & Cookies ─────────────────────────────────────────────
DOMAIN=localhost
PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000   # Set empty "" behind same-origin ALB
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=7
COOKIE_SECURE=false              # Set true in staging/production (HTTPS)
COOKIE_SAMESITE=Lax              # Lax for same-origin ALB; None for split domains
COOKIE_DOMAIN=

# ── 3. Database (SQLite default locally; PostgreSQL 16 + pgvector in prod) ──
# Uncomment DATABASE_URL (or POSTGRES_*) to use PostgreSQL:
# DATABASE_URL=postgresql://openvault:STRONG_PASS@db:5432/openvault?sslmode=require
# POSTGRES_DB=openvault
# POSTGRES_USER=openvault
# POSTGRES_PASSWORD=
# POSTGRES_HOST=db
# POSTGRES_PORT=5432
DB_CONN_MAX_AGE=60

# ── 4. Cache, Rate Limiting & Celery Worker (Redis 7) ───────────────────────
# CACHE_URL=redis://redis:6379/0
# CELERY_BROKER_URL=redis://redis:6379/0
# CELERY_RESULT_BACKEND=redis://redis:6379/0
SYNC_INDEXING=false

# ── 5. Object Storage (Local disk default; S3 / Cloudflare R2 in prod) ──────
DATA_DIR=./data
MAX_UPLOAD_SIZE=52428800
# AWS_STORAGE_BUCKET_NAME=openvault-prod-docs
# AWS_S3_REGION_NAME=ap-south-1
# AWS_S3_ENDPOINT_URL=
# AWS_S3_ACCESS_KEY_ID=
# AWS_S3_SECRET_ACCESS_KEY=

# ── 6. AI Chat & Embeddings Provider (Swappable without code changes) ───────
# Options: bedrock | ollama | gemini | openai | anthropic
LLM_PROVIDER=bedrock
EMBED_PROVIDER=bedrock
# Must match embedding model width: Bedrock Titan V2=1024, Ollama nomic=768, OpenAI=1536, Gemini=3072
EMBED_DIM=1024
TOP_K=4
RAG_MAX_CONTEXT_CHARS=12000

# 6a) AWS Bedrock (ap-south-1 Mumbai — uses IAM Task Role on ECS, or BEDROCK_API_KEY off-AWS)
BEDROCK_REGION=ap-south-1
BEDROCK_MODEL=in.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0
BEDROCK_API_KEY=

# 6b) Local / Self-Hosted Ollama Fallback
LLM_URL=http://host.docker.internal:11434
LLM_MODEL=llama3.2:3b
EMBED_MODEL=nomic-embed-text
OLLAMA_KEEP_ALIVE=30m
SELFHOSTED_LLM_URL=
SELFHOSTED_LLM_MODEL=qwen2.5:7b

# 6c) Optional Third-Party Cloud APIs
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBED_MODEL=gemini-embedding-001
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-haiku-latest

# ── 7. Email (Console locally; AWS SES / SMTP in prod) ──────────────────────
REQUIRE_EMAIL_VERIFICATION=false
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=email-smtp.ap-south-1.amazonaws.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=OpenVault <no-reply@openvault.site>

# ── 8. Security Gates, Observability & Optional Integrations ────────────────
ATTENDANCE_QR_REQUIRED=true
PLATFORM_ADMIN_REQUIRE_MFA=true
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
GOOGLE_SERVICE_ACCOUNT_FILE=
GOOGLE_CALENDAR_ID=primary
```

### 5.4 Exact Ordered Blockers Before Going Live Online (`VERIFIED`)

1. **Blocker 1 — Unmerged `infra` Branch & Untracked `backend/templates/`:** `origin/main` does not contain `infra/`, `.github/workflows/deploy.yml`, or `backend/templates/`. Pushing to `main` right now won't even trigger the ECS pipeline, and building `backend/Dockerfile` from git will miss `backend/templates/`.
2. **Blocker 2 — CI Pipeline Fails on `pnpm audit --audit-level=high` (`.github/workflows/ci.yml:109`):** `frontend/pnpm-lock.yaml` has **4 Critical and 36 High** vulnerabilities (`next@16.3.3` RCEs and `shadcn` -> `undici`/`proxy-addr`). Upgrading `next` to `>=16.4.4` and removing `shadcn` from runtime `dependencies` is required for CI to go green.
3. **Blocker 3 — One-Time AWS & Terraform Bootstrap Not Executed:**
   - Apply `infra/bootstrap` (`terraform init && terraform apply`) to create the state bucket and DynamoDB lock table.
   - Apply `infra/envs/staging` with `-target=module.dns_tls.aws_route53_zone.env` first, then delegate the NS records at your domain registrar (`openvault.site`) — otherwise `aws_acm_certificate_validation` will hang until timeout!
   - Complete `terraform apply` for `infra/envs/staging` (and `prod`).
   - Populate SSM secrets (`SECRET_KEY`, `LLM_KEY_ENCRYPTION_KEY`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`) and run `./scripts/push_first_images.sh staging` + `./scripts/setup_github.sh staging`.
4. **Blocker 4 — AWS SES Sandbox Mode:** New AWS accounts start in the SES Sandbox (can only send emails to verified addresses). If `REQUIRE_EMAIL_VERIFICATION=true` is enabled in production before AWS approves SES production access, **no external customer can sign up or verify their email**.

---

## 6. Requirement Traceability Matrix (Proposal `P1`–`P22` + Planned `U1`–`U17`)

| ID | Requirement / Feature | Status | File:Line / Command Evidence | Remaining Hours |
|---|---|---|---|---:|
| **P1** | Multi-tenant organization & ORM isolation (`company_id` FK on all models, `0%` leakage) | **`DONE` (`VERIFIED`)** | `backend/core/models.py:42-677` (all 20 models scoped), `backend/core/rag.py:390-413`, `backend/tests/test_isolation.py:1-460`, `run_rag_eval` (`cross-tenant leaks: 0`) | 0h |
| **P2** | Three-tier RBAC (`is_platform_admin`, `admin`, `employee`) | **`DONE` (`VERIFIED`)** | `backend/core/models.py:110-165`, `backend/core/permissions.py:1-36` (`IsPlatformAdmin`, `IsCompanyAdmin`, `IsCompanyMember`) | 0h |
| **P3** | Company onboarding, access codes & departments | **`DONE` (`VERIFIED`)** | `backend/core/models.py:42-108, 168-181`, `backend/core/views.py:239-280, 1590-1660` | 0h |
| **P4** | HttpOnly cookie JWT, rotation, SHA-256 `OneTimeToken`, sliding-window rate limiting | **`DONE` (`VERIFIED`)** | `backend/core/auth.py:1-76`, `backend/core/models.py:223-262`, `backend/core/ratelimit.py:1-108`, `backend/core/views.py:216-435` | 0h |
| **P5** | Upload PDF/DOCX/PPTX/TXT/MD/CSV/images + Tesseract OCR fallback (`<30` chars/page) | **`DONE` (`VERIFIED`)** | `backend/core/rag.py:130-245` (`MIN_SELECTABLE_CHARS_PER_PAGE = 30`, `pytesseract` `eng+urd`), `backend/core/uploads.py:1-88` (magic-byte validation) | 0h |
| **P6** | Sliding-window chunking (`900` chars, `150` overlap) + dense embeddings | **`DONE` (`VERIFIED`)** | `backend/core/rag.py:248-315` (`CHUNK_SIZE = 900`, `CHUNK_OVERLAP = 150`), `backend/core/providers.py:727-885` | 0h |
| **P7** | Doc versions, tags, preview, reindex, batch delete, scopes (`company`/`department`/`restricted`), cross-company share | **`DONE` (`VERIFIED`)** | `backend/core/models.py:264-371, 441-504`, `backend/core/views.py:725-1212` | 0h |
| **P8** | OKF persistent notes (`is_okf=True`) | **`DIFFERENT FROM PROPOSAL` (`VERIFIED`)** | Proposal says *"always injected regardless of question"*; `backend/core/rag.py:427-460` (`OKF_BOOST = 0.15`) ranks OKF chunks in the candidate pool with an additive boost instead of unconditional stuffing (superior design: prevents context-window exhaustion). | 0h |
| **P9** | Hybrid retrieval (`0.3` BM25 + `0.7` dense cosine, `TOP_K = 4`, Top-3 precision $\ge 85\%$) | **`DONE` (`VERIFIED`)** | `backend/core/rag.py:318-485` (`BM25_WEIGHT = 0.3`, `DENSE_WEIGHT = 0.7`, `k1=1.5, b=0.75`); `run_rag_eval` achieved `hit-rate@4 = 98.2%` (`84` questions). | 0h |
| **P10** | Bilingual (English + Roman Urdu) streaming SSE chat, history, citations, message ratings | **`DONE` (`VERIFIED`)** | `backend/core/views.py:1215-1585`, `backend/core/rag.py:520-690`, `frontend/app/workspace/chat/page.tsx:1-1633` | 0h |
| **P11** | Strict grounding & refusal guardrail | **`DONE` (`VERIFIED`)** | `backend/core/rag.py:495-565` (`SYSTEM_PROMPT` + `WEAK_SCORE_THRESHOLD`), `run_rag_eval` refusal proxy `1.0` | 0h |
| **P12** | Intent detection (`schedule_meeting`, `leave_request`, `general_query`) -> Google Calendar + `.docx` leave form | **`DONE` (`VERIFIED`)** | `backend/core/workflow.py:1-287`, `backend/core/docgen.py:1-913`, `backend/tests/test_workflows.py` & `test_docgen.py` | 0h |
| **P13** | Pre-LLM moderation & prompt-injection defense (`AskLog.flagged`, `AuditLog`) | **`DONE` (`VERIFIED`)** | `backend/core/moderation.py:1-106`, `backend/core/views.py:1265-1295`, `backend/tests/test_moderation.py` | 0h |
| **P14** | Daily QR attendance + monthly evaluation (`>2` absences = strike, $\ge 3$ strikes = freeze) | **`DIFFERENT FROM PROPOSAL` (`VERIFIED`)** | `backend/core/attendance.py:1-148`, `backend/core/qr_tokens.py:1-31`. Exceeds proposal: implements HMAC-signed rotating daily QR tokens (proposal called signed QR tokens "future work") + adds `Holiday` and `AttendanceExemption` models. | 0h |
| **P15** | Admin analytics (asks/day, unanswered, flagged, top askers), announcements, audit log | **`DONE` (`VERIFIED`)** | `backend/core/views.py:1665-1890`, `frontend/app/workspace/page.tsx`, `frontend/app/workspace/audit/page.tsx` | 0h |
| **P16** | Multi-provider LLM (`Ollama`, `Gemini`, `OpenAI`, `Anthropic`, `Bedrock`) + per-tenant `LLMConfig` BYO key | **`DONE` (`VERIFIED`)** | `backend/core/providers.py:1-928`, `backend/core/models.py:506-563`, `frontend/app/workspace/settings/page.tsx:1-950` | 0h |
| **P17** | Subscription `Plan` enforcement (`max_users`, `max_documents`, `max_storage_mb`, `max_asks_per_month`) | **`DONE` (`VERIFIED`)** | `backend/core/models.py:183-221`, enforced in `views.py:265, 755, 1245`, `frontend/app/pricing/page.tsx:1-233` (Note: PKR 2,500/6,000 pricing is economically underwater; see Sec. 8.4) | 2h |
| **P18** | Median chat TTFB $< 2.5\text{ s}$ | **`PARTIAL` (`UNKNOWN` live)** | Streaming SSE is implemented (`views.py:1395`), and Bedrock `ap-south-1` Haiku 4.5 is configured, but no live production latency benchmark report has been captured yet. | 2h |
| **P19** | Concurrency load testing (10, 25, 50 virtual users) | **`PARTIAL` (`VERIFIED`)** | `scripts/load_test.py:1-195` (stdlib concurrent load generator) and `seed_loadtest.py` exist, but proposal specifies Locust scenarios at 10/25/50 VUs against PostgreSQL/ECS. | 3h |
| **P20** | Cross-tenant security test suite + OWASP ZAP baseline scan | **`PARTIAL` (`VERIFIED`)** | Cross-tenant test suite is comprehensive (`backend/tests/test_isolation.py`, `214` tests), plus `bandit` (`0` high/med) and `gitleaks` (`0` leaks) ran cleanly, but no OWASP ZAP scan report is committed. | 2h |
| **P21** | Proposal Evaluation Datasets (30–50 docs, 100–150 QA pairs, 150–200 intent msgs, 60–100 moderation msgs) | **`PARTIAL` (`VERIFIED`)** | `backend/evals/golden_set.jsonl` has **84 QA rows** across **13 synthetic docs** (`run_rag_eval.py:40-104`) and `template_cases.jsonl` has **20 cases** (`pass_rate=0.75`). Needs +17–37 docs, +16–66 QA rows, and standalone JSONL benchmarks for the 150–200 intent and 60–100 moderation claims to strictly satisfy FYP defense tables. | 8h |
| **P22** | Usability Study (8–10 participants, SUS $\ge 75$) | **`MISSING` (`VERIFIED`)** | No UAT survey responses or SUS calculation document in `docs/`. | 4h |
| **U1** | AWS Bedrock (`ap-south-1` Haiku 4.5 + Titan Embed V2) swappable without code changes | **`DONE` (`VERIFIED`)** | `backend/core/providers.py:555-725, 845-885`, verified live with `aws bedrock get-foundation-model-availability --region ap-south-1` (`AUTHORIZED`). | 0h |
| **U2** | Template/form/email/letter generation (`docgen.py`) with plain-text chat & user data filling | **`PARTIAL` (`VERIFIED`)** | `backend/core/docgen.py:1-913` + `GeneratedArtifact` (`models.py:587`) works and exports `.md`/`.txt`/`.docx`/`.pdf`/`.html`/`.json`, **BUT** `backend/templates/` is untracked in git and `run_template_eval` fails 5/20 edge cases (`pass_rate: 0.75`). | 3h |
| **U3** | All 9 Next.js workspace pages + public marketing/pricing pages + responsive sidebar | **`DONE` (`VERIFIED`)** | All 20 `app/**/page.tsx` routes (`8,981` LOC) and `frontend/app/workspace/layout.tsx` (`h-dvh overflow-hidden`) are built and pass `next build`. | 0h |
| **U4** | Root platform admin (`Admin@openvault.site`) + MFA | **`DONE` (`VERIFIED`)** | `backend/core/management/commands/create_platform_admin.py`, `bootstrap_platform_admin.py`, `core/mfa.py`, `core/mfa_admin.py` | 0h |
| **U5** | PostgreSQL 16 + `pgvector` HNSW index | **`DONE` (`VERIFIED`)** | `backend/core/migrations/0016_chunk_pgvector.py:1-61` (`vector_cosine_ops` HNSW index), `backend/core/rag.py:445-475` (`CosineDistance`) | 0h |
| **U6** | Celery + Redis background indexing + Beat stuck-doc recovery | **`DONE` (`VERIFIED`)** | `backend/config/celery.py:1-13`, `backend/core/tasks.py:1-74`, `requeue_stuck_documents.py` | 0h |
| **U7** | Redis sliding-window rate limiting | **`DONE` (`VERIFIED`)** | `backend/core/ratelimit.py:1-108`, `backend/config/settings.py:178-195` (`django.core.cache.backends.redis.RedisCache`) | 0h |
| **U8** | Encrypt `LLMConfig.api_key` (and `User.mfa_secret`) at rest | **`DONE` (`VERIFIED`)** | `backend/core/crypto.py:1-47` (`Fernet` + PBKDF2/SHA-256 key derivation), `migrations/0014_encrypt_llmconfig_keys.py` | 0h |
| **U9** | S3 storage + presigned PUT uploads | **`DONE` (`VERIFIED`)** | `backend/core/storage.py:1-201`, `backend/core/views.py:880-965`, `backend/tests/test_s3_storage.py` | 0h |
| **U10** | Sentry monitoring integration | **`DONE` (`VERIFIED`)** | `backend/config/settings.py:397-416` (`sentry_sdk.init` with `DjangoIntegration`, `send_default_pii=False`) | 0h |
| **U11** | Terraform IaC + GitHub Actions OIDC CI/CD for AWS ECS | **`PARTIAL` (`VERIFIED`)** | All HCL (`3,919` lines) and workflows (`504` lines) are written and lint-clean, but **unmerged to `main` and unapplied in AWS**. | 6h |
| **U12** | Shared Notification System (doc-share email, indexed alert, in-app bell + unread count, team chat, mobile push) | **`MISSING` (`VERIFIED`)** | Not started (`0` models/endpoints/UI). **Note:** Cut "team chat" (Slack/WhatsApp clone scope creep); build only the `Notification` model + bell UI + SES email hooks. | 16h |
| **U13** | Policy violation tracker with Admin Review Queue | **`PARTIAL` (`VERIFIED`)** | Flagging (`AskLog.flagged`) + strikes (`UserStrike`) exist; missing `ModerationIncident` / review-queue status (`pending`/`dismissed`/`strike_issued`) + admin review UI. | 8h |
| **U14** | More workflows (expense requests, approvals) | **`PARTIAL` (`VERIFIED`)** | Expense claim & IT access form templates exist in `backend/templates/` and `docgen.py`, but there is no stateful approval workflow model (`WorkflowRequest` with manager approve/reject). | 10h |
| **U15** | Real email backend (SES/SMTP) + live Google Calendar | **`PARTIAL` (`VERIFIED`)** | Code & Terraform SES (`infra/modules/ses`) exist, but SES is not applied/out of sandbox and no Google service account JSON is provisioned. | 3h |
| **U16** | Mobile app (Expo + React Native) + push endpoint + Bearer-auth on attendance QR | **`MISSING` (`VERIFIED`)** | No mobile repo/folder exists; `CookieJWTAuthentication` in `backend/core/auth.py` ignores `Authorization: Bearer <token>` headers needed by mobile clients. | 45h |

### 6.1 Extra Features Built That Were NOT in the Proposal (`VERIFIED`)
1. **Multi-Format Template & Document Generator (`backend/core/docgen.py`, 913 LOC + `GeneratedArtifact` model):** Deterministic placeholder filling + exports to `.md`, `.txt`, `.docx`, `.pdf` (`fpdf2`), `.html`, and `.json`.
2. **TOTP Multi-Factor Authentication (`backend/core/mfa.py`, `mfa_admin.py`):** RFC 6238 TOTP MFA with backup codes and mandatory platform-admin MFA enforcement (`PLATFORM_ADMIN_REQUIRE_MFA`).
3. **HMAC-Signed Rotating Daily Attendance QR Tokens (`backend/core/qr_tokens.py`):** Proposal explicitly deferred signed QR tokens to "future work"; the codebase already implements them.
4. **Company Holidays & Attendance Exemptions (`Holiday`, `AttendanceExemption` in `models.py:636-677`):** Excludes public/company holidays and excused leave dates from monthly strike calculations.
5. **SSRF Network Guard (`backend/core/netguard.py`):** Blocks private/loopback/link-local/metadata IPs (`169.254.169.254`) when tenants configure custom `LLMConfig.base_url` endpoints.
6. **Production AWS ECS Fargate + pgvector + Celery + S3 Architecture (`infra/`):** Full 9-module Terraform suite + 11 ADRs (`docs/decisions/`).
7. **Dual Deployment Track (`vercel.json`, `docs/VERCEL.md`):** Untracked files in the working tree add a serverless Vercel + Neon + R2 deployment option alongside AWS ECS.

### 6.2 Proposal / Planned Items You Should Renegotiate or Drop Immediately
1. **DROP "Team Chat with Notifications" (from `U12`):** Building real-time employee-to-employee messaging turns a focused RAG compliance product into a worse Slack/Teams clone and adds massive WebSocket/moderation liability. Keep notifications strictly for **system events** (document shared, document indexed, strike warning, workflow status).
2. **DEFER the Expo Mobile App (`U16`, ~45 hours) until after 3 paying web customers:** The Next.js 16 web app is already responsive (`h-dvh`, mobile drawer in `workspace/layout.tsx`) and QR scanning works in mobile Safari/Chrome. Add a `manifest.json` (PWA) in 1 hour instead of maintaining a duplicate 20-screen React Native codebase right now.
3. **AMEND Proposal Section 7.5 (OKF Injection) in your FYP Final Thesis Report:** Document that OKF changed from "unconditional prompt stuffing" to "additive relevance boosting (`OKF_BOOST = 0.15`)" so examiners see it as an intentional engineering optimization rather than a deviation.

---

## 7. Security, Quality & Performance Findings (Severity-Ranked)

### CRITICAL Severity

#### `[CRIT-1]` 2.73 MB SQLite Database Backup Containing User Password Hashes Tracked in Git (`VERIFIED`)
- **Evidence:** `git ls-files backend/db.sqlite3*` returns `backend/db.sqlite3.before-account-reset-20261104T151855Z.bak` (`2,732,032` bytes, committed in `08e1036`). Inspection via `sqlite3` confirmed it contains **7 `core_user` records with `pbkdf2_sha256$1000000$...` password hashes**, **6 companies**, **54 documents**, **1,142 document chunks**, and **16 chat messages**.
- **Risk:** Anyone with read access to the git repository gets real/demo user password hashes and internal document chunks, and the `.bak` file gets baked into Docker contexts if not excluded.
- **Exact Fix:**
  ```bash
  git rm --cached backend/db.sqlite3.before-account-reset-20261104T151855Z.bak
  rm -f backend/db.sqlite3.before-account-reset-20261104T151855Z.bak
  git filter-repo --path backend/db.sqlite3.before-account-reset-20261104T151855Z.bak --invert-paths
  ```

#### `[CRIT-2]` 4 Critical & 36 High Frontend Dependency Vulnerabilities (`next@16.3.3` RCEs & `shadcn` in `dependencies`) (`VERIFIED`)
- **Evidence:** Running `pnpm audit --prod` in `frontend/` reports **95 vulnerabilities (4 Critical, 36 High, 45 Moderate, 10 Low)**:
  1. `next@16.3.3` (`frontend/package.json:21`): Vulnerable to **3 Critical RCEs** (Unauthenticated RCE in `use cache`, RCE in `next/og` `ImageResponse`, Unauthenticated RCE in Image Optimization API with SVG) + **2 High SSRF/DoS** advisories (patched in `next >= 16.4.1`; `16.4.4` is available).
  2. `shadcn@^4.11.0` (`frontend/package.json:27`): Placed in production `dependencies` instead of being invoked via `pnpm dlx shadcn@latest`, pulling in `@modelcontextprotocol/sdk`, `proxy-addr < 2.0.8` (**Critical**), and `undici` (**6 High advisories**).
- **Risk:** Active Critical RCE advisories in Next.js 16.3.3, AND `.github/workflows/ci.yml:109` (`pnpm audit --audit-level=high`) will hard-fail every CI run.
- **Exact Fix:** In `frontend/package.json`, upgrade `"next": "16.4.4"`, remove `"shadcn": "^4.11.0"` from `"dependencies"`, and run `pnpm install`.

---

### HIGH Severity

#### `[HIGH-1]` Untracked `backend/templates/` Directory Breaks Clean Clone & Docker CI Builds (`VERIFIED`)
- **Evidence:** `git status --short` shows `?? backend/templates/` (`form_expense_claim.md`, `form_it_access_request.md`, `leave_request_form.txt`). `backend/core/docgen.py:39` loads templates from `backend/templates/`.
- **Risk:** Any Docker image built in GitHub Actions or cloned by a buyer will lack `backend/templates/`, breaking built-in template discovery.
- **Exact Fix:** `git add backend/templates/ && git commit -m "Track built-in document templates"`

#### `[HIGH-2]` DNS Race in `netguard.py` Allows SSRF via DNS Rebinding (`TOCTOU`) (`VERIFIED`)
- **Evidence:** `backend/core/netguard.py:37-61` (`validate_outbound_url`) resolves the hostname via `socket.getaddrinfo(host, None)` to check `is_private`/`is_loopback`, and then `backend/core/providers.py` makes a **separate** `urllib.request.urlopen(url)` call that performs a second DNS lookup.
- **Risk:** A malicious tenant admin can configure a custom `LLMConfig.base_url` pointing to a DNS-rebinding domain (1st resolution returns a public IP to pass `validate_outbound_url`; 2nd resolution in `urllib` returns `169.254.169.254` ECS Task IAM credentials endpoint or internal RDS/Redis IPs).
- **Exact Fix:** Either disable custom `LLMConfig.base_url` in multi-tenant production via a setting (`ALLOW_CUSTOM_LLM_URLS=False` default in prod), or pin the resolved IP in a custom `urllib.request.HTTPHandler` / `HTTPConnection` subclass that connects directly to the validated IP with the original `Host` header.

#### `[HIGH-3]` Mobile / Bearer Token Auth Missing on API (`CookieJWTAuthentication` Only) (`VERIFIED`)
- **Evidence:** `backend/config/settings.py:238-240` sets `DEFAULT_AUTHENTICATION_CLASSES = ("core.auth.CookieJWTAuthentication",)`, and `backend/core/auth.py:42-60` returns `None` immediately if the `ov_access` cookie is absent (`raw = request.COOKIES.get(...)`).
- **Risk:** Native mobile apps, CLI scripts, or Bearer-authenticated QR scanners sending `Authorization: Bearer <jwt>` are treated as anonymous (`401 Unauthorized`).
- **Exact Fix:** In `backend/core/auth.py:44`, fall back to `super().authenticate(request)` when the `ov_access` cookie is not present so both HttpOnly cookies (web) and `Authorization: Bearer` headers (mobile/API) work seamlessly.

---

### MEDIUM Severity

#### `[MED-1]` Synchronous Vector Embedding Inside Upload Thread / Worker Blocks on Large PDFs (`VERIFIED`)
- **Evidence:** `backend/core/rag.py:695-745` (`index_document`) extracts text, chunks it, and calls `embed(pieces)` in a single transaction/function. In `backend/core/providers.py:720`, `BedrockEmbedProvider.embed()` loops over chunks **sequentially one HTTP call per chunk** (`for text in texts: ... invoke_model(...)`).
- **Risk:** A 100-page PDF (~250 chunks) makes **250 sequential HTTP calls** to Bedrock Titan Embed V2 (~25–40 seconds total), tying up one of only 2 Celery worker concurrency slots (`--concurrency=2`).
- **Exact Fix:** Use `concurrent.futures.ThreadPoolExecutor(max_workers=8)` inside `BedrockEmbedProvider.embed()` and `OllamaEmbedProvider.embed()` to parallelize chunk embedding requests (cuts 250-chunk indexing time from ~35s to ~4.5s).

#### `[MED-2]` `run_template_eval` Fails 5 of 20 Deterministic Cases (`75%` Pass Rate) (`VERIFIED`)
- **Evidence:** Running `python manage.py run_template_eval` outputs `pass_rate: 0.75` (`FAIL t01, t04, t05, t07, t13: filled=True kept=False`).
- **Risk:** In 5/20 template test cases, `docgen.py` modifies non-placeholder structural lines (`kept=False`), violating strict template preservation.
- **Exact Fix:** Inspect `backend/evals/template_report.json` for `t01, t04, t05, t07, t13` and tighten line-matching regexes in `backend/core/docgen.py`.

#### `[MED-3]` Dual Deployment Tracks in Working Tree (`Vercel` vs `AWS ECS`) Create Config Confusion (`VERIFIED`)
- **Evidence:** Untracked files `.env.vercel.example`, `backend/vercel.json`, `frontend/vercel.json`, `docs/VERCEL.md` and unstaged edits in `backend/config/settings.py` add Vercel serverless support (`IS_VERCEL`) on top of the ECS Fargate `infra` branch.
- **Risk:** Buyers and CI pipelines see two competing hosting models (serverless Vercel with synchronous indexing vs. AWS ECS Fargate with Celery/Redis).
- **Exact Fix:** Decide whether Vercel is an official secondary demo target (if so, commit the files cleanly and document in `README.md` as "Zero-Cost Demo Track vs. Production AWS ECS Track") or move Vercel files to a separate branch.

---

### LOW Severity

#### `[LOW-1]` `frontend/package.json` Missing `"lint"` Script (`VERIFIED`)
- **Evidence:** `pnpm lint` fails with `Command "lint" not found` (`frontend/package.json:7-14`).
- **Exact Fix:** Add `"lint": "eslint ."` (with `@next/eslint-plugin-next`) or `"lint": "next typegen && tsc --noEmit"` to `frontend/package.json`.

#### `[LOW-2]` No AWS WAF or CloudFront in `infra/` (`VERIFIED`)
- **Evidence:** Public ALB (`infra/modules/ecs/main.tf:26`) is exposed directly to the internet on ports 80/443 without `aws_wafv2_web_acl`.
- **Exact Fix:** Acceptable for 5–7 users to save ~$10/mo in WAF base fees (since Django `ratelimit.py` + `moderation.py` + ` netguard.py` enforce application-layer protection), but add an optional `enable_waf = false` variable in `infra/modules/ecs` for enterprise buyers.

---

## 8. Sellability & Exit-Readiness Assessment

### 8.1 Buyer Due-Diligence Scorecard (1–10 Scale)

| Criterion | Score | Brutally Honest Buyer Justification |
|---|---:|---|
| **1. Multi-Tenant Isolation & Security** | **8.5 / 10** | Strongest part of the repo: every model is tenant-scoped (`company` FK), verified by 214 automated tests + 84-row RAG isolation eval (`0` cross-tenant leaks), HttpOnly JWT cookies, Fernet encryption for BYO keys (`crypto.py`), TOTP MFA (`mfa.py`), and daily HMAC QR tokens. Docked 1.5 pts for `db.sqlite3*.bak` in git, `next@16.3.3` CVEs, and DNS-rebinding TOCTOU in `netguard.py`. |
| **2. Architecture & Cloud/DevOps Maturity** | **8.0 / 10** | Well above typical FYP/seed SaaS quality: modular Terraform (`3,919` LOC, 9 modules), GitHub OIDC CI/CD (no static AWS keys), ECS Fargate + RDS pgvector + Redis + S3 + SES + CloudWatch + 11 ADRs. Docked 2 pts because **it has never been applied live in AWS** and `infra` is unmerged to `main`. |
| **3. Product Completeness (Web SaaS)** | **7.5 / 10** | All 20 Next.js routes (`chat`, `documents`, `members`, `attendance`, `audit`, `usage`, `settings`, `shared`, `overview`, etc.), bilingual English/Roman Urdu RAG, OCR, and multi-format document/template generation work end-to-end. Docked 2.5 pts for missing notifications (`U12`) and admin moderation review queue (`U13`). |
| **4. Code Quality, Testing & Maintainability** | **7.5 / 10** | `74%` total backend test coverage (`81%` core runtime), clean `bandit` and `tflint` scans, readable Django codebase. Docked 2.5 pts because `backend/core/views.py` is a `2,483`-line monolith (needs splitting into `views/auth.py`, `views/docs.py`, `views/chat.py`, `views/attendance.py`, `views/admin.py`) and frontend has only 12 unit tests (no Playwright E2E tests). |
| **5. IP Cleanliness & Legal Assignability** | **3.0 / 10** | **MAJOR DEALBREAKER TODAY:** Proposal lists **3 student co-authors** (`Saad Waseem [B-28488]`, `M Akmal [B-28723]`, `M Talha Khalid [B-28390]`) and **University of South Asia** (`Supervisor: Ma'am Iqra`), plus there is no `LICENSE` file or signed IP assignment agreement in the repo. No serious buyer will wire money without 100% clear chain of title. |
| **6. Unit Economics & Pricing Viability** | **3.5 / 10** | Proposed plans (**Free PKR 0**, **Starter PKR 2,500/mo =~$9**, **Growth PKR 6,000/mo =~$21.50**) lose money on infrastructure and LLM tokens until ~18+ companies, and unthrottled Free/Starter plans expose you to negative gross margins per tenant. |
| **7. Commercial Traction & Revenue** | **1.0 / 10** | **0 live production deployments, 0 paying companies, 0 MRR, 0 LOIs/pilot agreements.** Currently a pre-revenue technical asset, not a cash-flowing SaaS business. |
| **Overall Exit Readiness Score** | **5.6 / 10** | **(48% Weighted Sale Readiness)** — High-grade technical asset blocked by legal IP sign-offs, unapplied deployment, and zero customer revenue. |

---

### 8.2 Licensing, Dependency & FYP IP Ownership Risks (`CRITICAL` for Sale)

1. **University of South Asia & Co-Author IP Encumbrance (`VERIFIED` from Proposal Cover Page):**
   - Your FYP proposal explicitly names **Saad Waseem (B-28488)**, **M Akmal (B-28723)**, and **M Talha Khalid (B-28390)** under **Department of Computer Science, University of South Asia**. Even though `git shortlog -sn --all` shows 100% of commits (`77/77`) were authored by you (`SenseiSaad` / `Saad Waseem`), under Pakistani copyright law and standard HEC/university FYP policies, co-listed group members and/or the university can claim joint ownership of the software artifact unless waived in writing.
   - **Mandatory Fix Before Selling:** Execute a 1-page **IP Assignment & Waiver Agreement** signed by **M Akmal**, **M Talha Khalid**, and an authorized **University of South Asia CS Department Head / ORIC representative** confirming that: (a) the university retains only a non-commercial academic grading license to the FYP report, and (b) 100% of commercial copyright and source code ownership of *OpenVault* belongs exclusively to Saad Waseem (or your registered entity).
2. **Dependency License Audit (`VERIFIED`):**
   - Direct dependencies in `backend/requirements.txt` and `frontend/package.json` use permissive licenses (**BSD-3**, **MIT**, **Apache-2.0**), with two exceptions to note in buyer disclosures:
     - `psycopg2-binary==2.9.10` (**LGPL v3 with OpenSSL/linking exception**): Permissible for SaaS and dynamic Python import, or swap to `psycopg[binary]` v3 (pure **LGPL-3.0** / **BSD-style** libpq wrapper) if a buyer has a strict no-LGPL policy.
     - `fpdf2==2.9.0` (**LGPL-3.0**): Dynamically imported Python library (`import fpdf`); permissible for hosted SaaS without triggering copyleft source disclosure, provided you do not modify `fpdf2` internals.
     - External system binaries (`tesseract-ocr` **Apache-2.0**, `poppler-utils` **GPL-2.0** invoked via CLI subprocess in `pdf2image`): Invoking `pdftoppm` as a separate OS process in a hosted SaaS container does not infect proprietary Python application code under GPLv2, though buyers doing on-prem binary redistribution should be informed.

---

### 8.3 Realistic Valuation Range & Reasoning

1. **Today (Pre-Revenue Code + Unapplied IaC + Unresolved Co-Author IP):** **$1,500 – $4,000 USD (PKR 420k – 1.1M)** as a "code-only starter kit / acqui-hire portfolio piece" on marketplaces like Acquire.com / Flippa, because buyers discount pre-revenue code heavily when there is no live traffic or signed IP waiver.
2. **After Fixing P0/P1 + Live AWS Deployment + Signed IP Waivers + 3–5 Pilot Companies (even at $200–$400 MRR):** **$10,000 – $25,000 USD (PKR 2.8M – 7.0M)** on MicroAcquire / Acquire.com or to a Pakistani HR-tech / ERP agency (e.g., PayPeople, Decibel, FolksHR, or a regional system integrator wanting an instant bilingual AI compliance module).
3. **With $1,500–$2,500 MRR (~15–25 Pakistani SMEs/mid-market tenants, <5% churn, 6 months history):** **$55,000 – $95,000 USD (PKR 15M – 26.5M)** (valued at **3.0x–4.0x ARR** for B2B micro-SaaS with proprietary compliance workflows and clean AWS IaC).

---

### 8.4 Pakistan Startup Pricing & Break-Even Math (Why PKR 0 / 2,500 / 6,000 Fails)

- **Exchange Rate Used:** `1 USD = 278 PKR`.
- **Fixed Monthly AWS Base Cost (Minimal Prod Setup):**
  - Standard Terraform setup (`1x NAT`, `ALB`, `ECS`, `RDS`, `Redis`): **`$125/mo` = `PKR 34,750/mo`**.
  - Optimized setup (Free Tier RDS/Redis or NAT removed): **`$68/mo` = `PKR 18,900/mo`**.
- **Variable AI Cost per Active Company per Month (`ap-south-1` Bedrock Claude Haiku 4.5 + Titan Embed V2):**
  - Assume 1 company = 25 employees, 2,500 questions/mo (~3,000 input tokens + 400 output tokens per question) + 50 document uploads/mo:
  - Input: $2,500 \times 3,000 = 7.5\text{M tokens} \times \$1.00/\text{M} = \$7.50$
  - Output: $2,500 \times 400 = 1.0\text{M tokens} \times \$5.00/\text{M} = \$5.00$
  - Embeddings + S3 + SES: $\approx \$0.75$
  - **Variable Cost per Active Company (2,500 asks/mo):** **`$13.25/mo` = `PKR 3,683/mo`**.

> **CRITICAL FINDING:** Under your proposal's **Starter Plan (PKR 2,500/mo = $8.99/mo)**, if a company uses 2,500 asks/month on Claude Haiku 4.5, **your variable Bedrock bill alone is PKR 3,683/mo — you lose PKR 1,183/month on every Starter customer before paying a single rupee of fixed AWS server costs!** Even on the **Growth Plan (PKR 6,000/mo = $21.58/mo)**, gross profit after variable AI cost is only **PKR 2,317/mo ($8.33/mo)**, requiring **15 Growth companies** just to break even on the $125/mo AWS base bill!

#### Recommended Sustainable Pricing Table (Pakistan B2B SaaS — `backend/core/management/commands/seed_plans.py` & `frontend/app/pricing/page.tsx`)

| Tier | Target Customer | Monthly Price (PKR / USD) | Included Limits (`Plan` Model) | Max Variable AI Cost | Gross Margin (After AI Cost) | Break-Even Companies Needed (vs $68–$125 Fixed AWS) |
|---|---|---|---:|---:|---:|---:|
| **14-Day Pilot (Replaces Eternal Free Tier)** | Trial evaluation only | **PKR 0** *(14-day cap, or BYO API Key)* | 5 users, 10 docs, 50 MB, **150 asks total** (or unlimited if tenant sets BYO Gemini/Bedrock key) | **$0.80** (PKR 220) | N/A (CAC) | N/A |
| **Starter (SME)** | 10–25 employee PK startups/agencies | **PKR 9,500 / mo** (~$34/mo) | 25 users, 75 docs, 500 MB, **1,500 asks/mo** | **$7.95** (PKR 2,210) | **77%** (+PKR 7,290 / $26.20) | **3 – 5 companies** |
| **Growth (Mid-Market)** | 25–100 employee companies | **PKR 24,500 / mo** (~$88/mo) | 100 users, 400 docs, 5 GB, **6,000 asks/mo** + Custom Templates & Attendance QR | **$31.80** (PKR 8,840) | **64%** (+PKR 15,660 / $56.30) | **2 – 3 companies** |
| **Enterprise / Dedicated** | 100+ staff (banks, factories, universities) | **PKR 65,000+ / mo** (~$235/mo) | Unlimited docs, SSO/MFA, Dedicated S3 prefix / BYO Bedrock key, SLA | **$60.00** (PKR 16,680) | **74%+** (+PKR 48,320 / $174) | **1 company breaks even entire platform!** |

---

### 8.5 Top 10 Highest-ROI Actions to Raise Sale Value (Ranked by Value Added per Hour of Work)

| Rank | Action | Est. Hours | Why It Dramatically Increases Buyer Valuation |
|---:|---|---:|---|
| **1** | **Get signed IP Assignment & Waiver from M Akmal, M Talha Khalid & USA supervisor** + add `LICENSE` file | **2.0h** | Eliminates the #1 legal blocker that kills 100% of software acquisitions during due diligence. |
| **2** | **Purge `backend/db.sqlite3*.bak` from git history + commit `backend/templates/` + merge `infra` -> `main`** | **1.0h** | Fixes critical git hygiene failure, makes `origin/main` match reality, and makes clean clones work out of the box. |
| **3** | **Upgrade `next` to `16.4.4` and remove `shadcn` from `frontend/package.json` `dependencies`** | **0.5h** | Eliminates all **4 Critical & 36 High** npm CVEs and makes `.github/workflows/ci.yml` (`pnpm audit`) pass green. |
| **4** | **Update `seed_plans.py` and `frontend/app/pricing/page.tsx` to profitable PKR 9,500 / 24,500 / 65,000 tiers** | **1.5h** | Fixes negative unit economics and proves to buyers that 1 Enterprise or 3 Starter tenants cover 100% of AWS bills. |
| **5** | **Bootstrap & deploy live on AWS (`ap-south-1`) with custom domain HTTPS (`openvault.site`) + seed demo tenant** | **5.0h** | Buyers pay 3x–5x more for a live, clickable HTTPS SaaS with real CloudWatch metrics than for local-only code. |
| **6** | **Onboard 2–3 real Pakistani SME pilot companies (even at PKR 5,000–9,500/mo or signed LOIs)** | **8.0h** | Moves asset from "student FYP code" ($2k–$4k) to "revenue-generating B2B SaaS" ($15k–$25k+). |
| **7** | **Parallelize chunk embeddings in `providers.py` (`ThreadPoolExecutor`)** | **1.5h** | Cuts 20+ file / large PDF indexing latency by **6x–8x** (directly solving your "indexing is taking very long" pain point). |
| **8** | **Fix `CookieJWTAuthentication` to also accept `Authorization: Bearer` + fix `netguard.py` DNS-rebinding** | **2.5h** | Makes the API immediately mobile/CLI-ready and closes the SSRF TOCTOU security finding. |
| **9** | **Fix the 5 failing `run_template_eval` cases (`t01, t04, t05, t07, t13`) to reach `95%+` pass rate** | **2.5h** | Turns your deterministic template/form generator into a verified `95%+` benchmarked differentiator. |
| **10** | **Build a lightweight in-app + email `Notification` center (doc shared, doc indexed, strike alert)** | **12.0h** | Completes the core collaborative SaaS loop without wasting 40+ hours on team chat or native mobile apps. |

---

## 9. DevOps & Cloud Engineering Practice Plan (Job-Readiness Track)

### 9.1 Honest Assessment of Your Current DevOps State
- **What exists in the repo:** The `infra/` directory (`3,919` lines of Terraform across 9 modules) and `.github/workflows/` (`504` lines across 5 OIDC workflows) + `docs/decisions/` (11 ADRs) are **already senior-level cloud engineering artifacts**.
- **Your actual skill gap:** Because `docs/FINAL_REPORT.md:7` confirms **nothing in `infra/` has ever been `terraform apply`-ed to AWS**, you have not yet practiced the real-world operational friction where DevOps engineers earn their salary: **state bootstrapping, ACM DNS delegation deadlocks, IAM permission boundary debugging (`openvault_user` currently gets `AccessDenied` on RDS/ECR/SSM/IAM!), ECS task crash-loop troubleshooting, and live rollback drills**.

### 9.2 Prioritized 6-Step Hands-On DevOps Build Order

1. **Step 1 — Fix IAM Permissions & Bootstrap Remote State (`2 hours`):**
   - Attach AdministratorAccess (or the scoped bootstrap policy in `docs/AWS_PREREQUISITES.md`) to your provisioning principal, run `terraform init && terraform apply` in `infra/bootstrap/`, and inspect the created S3 state bucket and DynamoDB lock table (`aws dynamodb scan --table-name openvault-tf-locks`).
2. **Step 2 — Two-Phase Terraform Apply & Route 53 DNS Delegation (`2 hours`):**
   - Run `terraform init -backend-config=backend.hcl` in `infra/envs/staging`.
   - Practice targeted apply (`terraform apply -target=module.dns_tls.aws_route53_zone.env`), copy the 4 Route 53 NS records into your domain registrar (`openvault.site`), verify propagation with `dig NS staging.openvault.site +short`, and then run full `terraform apply` so ACM certificate validation completes without hanging.
3. **Step 3 — First Container Push, SSM Secret Injection & One-Off ECS Migration Task (`2 hours`):**
   - Populate the 7 SSM `SecureString` parameters via `aws ssm put-parameter --type SecureString --overwrite`, run `./scripts/push_first_images.sh staging`, and trigger a standalone ECS Fargate migration task (`aws ecs run-task`) while tailing logs live with `aws logs tail /ecs/openvault-staging/migrate --follow`.
4. **Step 4 — GitHub Actions OIDC CI/CD End-to-End Pipeline & Intentional Rollback Drill (`2 hours`):**
   - Run `./scripts/setup_github.sh staging`, merge `infra` -> `main`, watch `.github/workflows/deploy.yml` assume `openvault-staging-image-build` and `openvault-staging-ecs-deploy` via OIDC (zero static AWS keys), and verify `./scripts/smoke_test.sh` passes.
   - **Practice Drill:** Deploy a deliberate bad healthcheck commit or trigger `.github/workflows/rollback.yml` with the previous git SHA and capture the CloudWatch + ECS deployment circuit-breaker timeline for your portfolio.
5. **Step 5 — RDS Automated Backup Restore Drill (`1.5 hours`):**
   - Run `./scripts/verify_backups.sh staging` (`scripts/verify_backups.sh:1-142`) to restore the latest RDS snapshot into a temporary instance, verify `pgvector` chunk counts, and tear down the temporary instance.
6. **Step 6 — Load Testing & CloudWatch Alarm Triggering (`1.5 hours`):**
   - Run `python3 scripts/load_test.py --url https://staging.openvault.site --users 25 --duration 120` while observing ECS CPU/Memory target-tracking autoscaling (`infra/modules/ecs/main.tf:512-589`) and CloudWatch p95 latency metrics.

### 9.3 Ready-to-Use Resume Bullets (Use ONLY After Completing Steps 1–6 Above)

- **Cloud Architecture & IaC:** Architected and provisioned a multi-AZ AWS production environment (`ap-south-1`) using modular **Terraform (`3,900+` LOC across 9 modules)** encompassing **ECS Fargate** (`api`, `web`, `Celery worker`), **RDS PostgreSQL 16 (`pgvector` HNSW)**, **ElastiCache Redis 7**, **S3 KMS**, **ALB (`TLS 1.3`)**, **Route 53/ACM**, and **SES v2** within a ~$68–$125/mo SME cost envelope.
- **Zero-Secret CI/CD & Release Engineering:** Built immutable **GitHub Actions OIDC** pipelines (`ci`, `deploy`, `rollback`, `terraform-plan/apply`) eliminating long-lived AWS keys, automating `gitleaks`/`bandit`/`pip-audit`/`trivy` gates, running pre-traffic ECS `migrate` tasks, and enforcing post-deploy smoke tests with automated task-definition rollbacks.
- **Container Hardening & Observability:** Hardened Docker/Fargate workloads with non-root users, `readOnlyRootFilesystem`, least-privilege security groups, and KMS-encrypted **CloudWatch** logs/dashboards/alarms integrated with **Sentry** and **AWS Budgets**.

---

## 10. Prioritized Remaining-Work Roadmap (`P0` / `P1` / `P2`)

### `P0` — Blocks Go-Live & Clean Repo State (Must Do First: **14.0 Hours Total**)
1. **`[1.0h]` Clean Git History & Working Tree:** Remove `backend/db.sqlite3.before-account-reset-20261104T151855Z.bak` from git (`[CRIT-1]`), commit `backend/templates/` (`[HIGH-1]`), reconcile/commit modified working-tree files, and merge/push `infra` -> `origin/main`.
2. **`[0.5h]` Fix Frontend CVEs & Lint Script:** Upgrade `next` to `16.4.4`, remove `shadcn` from `dependencies` (`[CRIT-2]`), and add `"lint"` script in `frontend/package.json` (`[LOW-1]`).
3. **`[1.5h]` Parallelize Document Chunk Embeddings:** Add `ThreadPoolExecutor(max_workers=8)` to `BedrockEmbedProvider.embed()` and `OllamaEmbedProvider.embed()` in `backend/core/providers.py` (`[MED-1]`).
4. **`[2.5h]` Fix Template Eval Edge Cases:** Fix the 5 failing deterministic template cases (`t01, t04, t05, t07, t13`) in `backend/core/docgen.py` so `python manage.py run_template_eval` hits $\ge 95\%$ (`[MED-2]`).
5. **`[2.5h]` Security Hardening (`netguard.py` + Bearer Auth):** Pin resolved IP or disable custom `LLMConfig.base_url` in prod (`[HIGH-2]`) and allow `Authorization: Bearer` fallback in `CookieJWTAuthentication` (`[HIGH-3]`).
6. **`[6.0h]` Execute 1-Time AWS & GitHub Bootstrap (`ap-south-1`):** Run `infra/bootstrap`, delegate Route 53 NS records, apply `infra/envs/staging` (or `prod`), populate SSM parameters, request AWS SES production access, and run `./scripts/push_first_images.sh` + `./scripts/setup_github.sh`.

### `P1` — Before 10 Paying Companies & FYP Final Defense (**37.5 Hours Total**)
1. **`[1.5h]` Revise Subscription Pricing:** Update `seed_plans.py` and `frontend/app/pricing/page.tsx` to profitable tiers (**PKR 9,500 / 24,500 / 65,000** + 14-day pilot cap).
2. **`[12.0h]` Build Core Notification System (`U12` scoped):** Add `Notification` model (`user`, `company`, `kind`, `title`, `body`, `link`, `read_at`, `created_at`), trigger on document shared / document indexed / strike issued, send async SES email via Celery, and add bell icon + unread badge in `frontend/app/workspace/layout.tsx`.
3. **`[8.0h]` Policy Violation Admin Review Queue (`U13`):** Add `review_status` (`pending`, `dismissed`, `escalated`, `strike_issued`) and `reviewed_by` to `AskLog` (or `ModerationIncident`), plus an Admin Review Queue tab in `frontend/app/workspace/audit/page.tsx`.
4. **`[8.0h]` Expand Academic Evaluation Datasets (`P21`):** Expand `golden_set.jsonl` from 84 -> 120 QA pairs across 30 synthetic docs, and add standalone `intent_set.jsonl` (150 rows) and `moderation_set.jsonl` (60 rows) management command runners so every table in your FYP thesis is 100% reproducible from a single command.
5. **`[8.0h]` Run & Document FYP Load, Security & UAT Reports (`P18–P20, P22`):** Run Locust/load test (`10, 25, 50` users), OWASP ZAP baseline scan against staging, and 8–10 user SUS questionnaire, committing the results to `docs/EVALUATION_RESULTS.md`.

### `P2` — Before Selling the Company / SaaS Asset (**26.0 Hours Total**)
1. **`[2.0h]` Legal & IP Cleanroom Package:** Obtain signed IP Assignment & Waiver letters from co-authors (`M Akmal`, `M Talha Khalid`) and university supervisor, and add `LICENSE` + `NOTICE.md`.
2. **`[10.0h]` Stateful Manager Approval Workflow (`U14`):** Add `WorkflowRequest` model (`leave` / `expense` / `it_access`, `status=pending|approved|rejected`, `approver`, `artifact` FK) with 1-click admin approval in the workspace.
3. **`[6.0h]` Split `backend/core/views.py` (`2,483` LOC) & Add Playwright E2E Smoke Suite:** Refactor `views.py` into domain modules (`views/auth.py`, `views/documents.py`, `views/chat.py`, `views/attendance.py`, `views/admin.py`) and add 5 Playwright browser tests.
4. **`[8.0h]` Buyer Data Room & Pilot Customer Onboarding:** Prepare a buyer due-diligence folder (`docs/DATA_ROOM.md`: architecture, P&L unit economics, AWS bill screenshots, SOC2/ISO readiness mapping) and onboard 3–5 pilot companies.

> **Total Remaining Engineering Effort:** **`77.5 Hours`** (`14.0h` P0 + `37.5h` P1 + `26.0h` P2) — roughly **2 to 3 weeks of focused solo execution** (excluding the optional 45h Expo mobile app, which should be deferred).

---

## 11. Questions You Must Answer & Exact Commands You Must Run

### 11.1 Five Strategic Questions You Must Answer Before Proceeding
1. **FYP Co-Authors & University IP (`M Akmal`, `M Talha Khalid`, University of South Asia):** Were `M Akmal` and `M Talha Khalid` only part of the academic proposal group while you wrote 100% of the code (`77/77` commits), and will they sign a 1-page IP waiver assigning commercial rights to you before you pitch buyers?
2. **Primary Hosting Track (`AWS ECS Fargate` vs. `Vercel + Neon + R2`):** Your working tree has untracked Vercel files (`backend/vercel.json`, `frontend/vercel.json`, `docs/VERCEL.md`) alongside the 3,919-line AWS ECS Terraform stack on branch `infra`. Do you want to commit the Vercel config as a "free demo track" alongside AWS ECS, or discard the untracked Vercel files and stay 100% focused on AWS ECS?
3. **Production Domain Name (`openvault.site` vs. custom domain):** Do you already own and control the DNS registrar for `openvault.site` (needed for Route 53 NS delegation, ACM TLS validation, and SES DKIM validation)?
4. **Pricing Update Approval:** Are you ready to replace the money-losing `PKR 0 / 2,500 / 6,000` tiers in `seed_plans.py` and `frontend/app/pricing/page.tsx` with the positive-margin `14-Day Pilot / PKR 9,500 / PKR 24,500 / PKR 65,000` structure?
5. **Notification Scope:** Do you agree to cut "employee-to-employee team chat" from the notification task (`U12`) and build only system notifications (bell icon + unread count + SES email on doc share / doc indexed / strike alert)?

### 11.2 Exact Commands You Must Run to Verify `UNKNOWN` AWS Resources
Because the local AWS CLI profile (`arn:aws:iam::811364789434:user/openvault_user`) returned `AccessDenied` on RDS, ElastiCache, ECR, Route 53, SSM, and IAM OIDC, run these exact commands using your root or Administrator IAM session to verify nothing billable exists in those services:

```bash
# 1. Verify no RDS PostgreSQL instances or snapshots exist in ap-south-1 or us-east-1
aws rds describe-db-instances --region ap-south-1 --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus]' --output table
aws rds describe-db-snapshots --region ap-south-1 --snapshot-type manual --output table

# 2. Verify no ElastiCache Redis clusters exist
aws elasticache describe-replication-groups --region ap-south-1 --query 'ReplicationGroups[*].[ReplicationGroupId,Status]' --output table

# 3. Verify ECR repositories & images
aws ecr describe-repositories --region ap-south-1 --query 'repositories[*].[repositoryName,repositoryUri]' --output table

# 4. Verify Route 53 hosted zones (each hosted zone costs $0.50/month)
aws route53 list-hosted-zones --query 'HostedZones[*].[Id,Name,ResourceRecordSetCount]' --output table

# 5. Verify SSM Parameter Store & Secrets Manager
aws ssm describe-parameters --region ap-south-1 --output table
aws secretsmanager list-secrets --region ap-south-1 --query 'SecretList[*].[Name,ARN]' --output table

# 6. Verify GitHub OIDC provider & IAM roles
aws iam list-open-id-connect-providers --output table
aws iam list-roles --query 'Roles[?contains(RoleName, `openvault`)].[RoleName,Arn]' --output table

# 7. Verify SES sandbox status & verified identities in ap-south-1
aws sesv2 get-account --region ap-south-1 --query '{ProductionAccessEnabled:ProductionAccessEnabled,EnforcementStatus:EnforcementStatus,SendQuota:SendQuota}' --output json
```
