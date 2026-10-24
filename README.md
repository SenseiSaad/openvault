# OpenVault

> **Private, Zero-Trust Knowledge Infrastructure & Permission-Aware AI for Registered Organizations.**

OpenVault is an enterprise document repository and retrieval-augmented generation (RAG) assistant designed for organizations that require strict tenant isolation, zero-trust intra-company access controls, auditable cross-company collaboration, multi-turn AI chat history, attendance tracking, and CPA/assurance compliance readiness.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Implemented Features](#key-implemented-features)
3. [Security & Authentication Flow](#security--authentication-flow)
4. [Plans & PKR Billing](#plans--pkr-billing)
5. [Data Privacy: AWS Bedrock and Ollama](#data-privacy-aws-bedrock-and-ollama)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Repository Layout](#repository-layout)
8. [Local Development & Quick Start](#local-development--quick-start)
9. [Docker Compose Quick Start](#docker-compose-quick-start)
10. [Cloud Deployment (Amplify + Render)](#cloud-deployment-amplify--render)
11. [Running the Tests](#running-the-tests)
12. [Production Deployment (single host)](#production-deployment-single-host)
13. [Platform Administration Commands](#platform-administration-commands)
14. [Academic Documentation](#academic-documentation)
15. [Project Team & Attribution](#project-team--attribution)

---

## Executive Summary

Unlike conventional document repositories or public search tools, OpenVault is built around **employer-controlled private access**:

- **Strict Multi-Tenancy:** Every document, vector chunk, user account, attendance record, and audit entry is bound to a verified `Company` tenant.
- **Zero-Trust Document Scoping:** Documents can be scoped company-wide, to a specific department, or locked to selected people (`restricted`). Even same-company executives cannot search or view restricted files without explicit grant.
- **Controlled Cross-Company Collaboration:** Organizations locate partner companies via unique 5-character share codes (`access_code`). Admins can grant exactly one document to one specific registered employee at a partner company, with immediate revocation and download restrictions.
- **Permission-Aware RAG:** Chat retrieval filters documents based on the requesting user's explicit permissions *before* running hybrid retrieval (BM25 + cosine similarity), ensuring the AI never leaks unauthorized information.
- **Multi-Turn Persistent Chat:** Interactive threaded conversations with the last 6 turns supplied to the LLM, thumbs up/down user feedback, and live citations.
- **CPA & Assurance Audit Readiness:** Every sign-in, upload, download, share, revocation, member modification, and AI prompt is logged in an immutable audit trail with IP tracking and CSV export.

---

## Key Implemented Features

### 🏢 Multi-Tenancy & Subscriptions
- Isolated company workspaces identified by slug and unique 5-character `access_code`.
- Company self-service settings: name, website, contact email, phone, and seat cap.
- Tiered subscription plans (Free, Starter, Business, Enterprise) priced in **Pakistani Rupees (PKR)** with server-side quota enforcement on seats, documents, storage, and monthly AI asks.
- Cross-tenant platform administration for root operators with an active tenant switcher.

### 🔐 Zero-Trust Document Management
- Supported formats: **PDF (`.pdf`)**, **Word (`.docx`)**, **PowerPoint (`.pptx`)**, **Markdown (`.md`)**, **Plain Text (`.txt`, `.csv`)**, and scanned PDFs/images via OCR.
- Three-tier access scoping:
  - `Entire company`: Searchable and downloadable by all active members of the tenant.
  - `Department`: Scoped strictly to colleagues in the assigned department.
  - `Selected people`: Searchable and downloadable only by the uploader and explicitly authorized colleagues.
- **Async Indexing:** Uploads return immediately (`indexing_status="pending"`), indexing proceeds in background workers with retry capability.
- **Document Versioning:** Upload new versions of existing documents while preserving archive history and sharing rules.
- **In-Browser Text Preview:** View extracted text chunks directly without forced downloads.
- **Tagging & Filtering:** Categorize documents with custom tags and filter chips.
- **Batch Management:** Select multiple documents for bulk deletion.

### 🤝 Granular Cross-Company Collaboration
- Tenant lookup via 5-character access code (`GET /api/companies/search?code=...`).
- Granular per-user, per-document grants (`POST /api/documents/<id>/shares`).
- Configurable download permission per grant (`can_download: true/false`).
- Instant revocation (`DELETE /api/documents/<id>/shares/<user_id>`).
- Dedicated "Shared with me" view displaying externally granted files.

### 🤖 Bedrock + Ollama RAG Assistant
- Two chat modes: **AWS Bedrock** is the hosted default; **Ollama** is the optional local/server endpoint.
- Bedrock uses the India inference profile for chat and Titan Text Embeddings V2 for document retrieval. The Render service stores the Bedrock API key as a secret.
- Ollama must be running at an endpoint reachable from the Django API. On the hosted Render deployment, “Local” means that configured server endpoint—not Ollama on each user's computer.
- **Hybrid Retrieval:** Blended 70% dense cosine similarity + 30% BM25 keyword retrieval.
- **Persistent Threads:** Threaded chat history sidebar, title renaming, and deletion.
- **User Feedback:** Thumbs up / down rating on assistant answers.
- **Automated Workflows:** Detects intent to schedule meetings (Google Calendar / email simulation) and generate leave application forms (`.docx`).
- **Policy Flagging:** Non-blocking audit-logged safety alerts for compliance tripping.
- **Urdu Language Support:** Bilingual UI with Roman Urdu toggle and auto-matching AI reply instructions.

### 📋 Member Administration, Attendance & Audit
- Department assignment for teammates.
- Inline member role editing (`admin`, `employee`, `viewer`) and account activation/deactivation.
- QR-code attendance check-in with 3-strike policy tracking.
- Broadcast company announcements posted by administrators.
- 30-day analytics dashboard: total asks, unanswered questions, flagged questions, user satisfaction, and monthly quota usage.
- 100-event paginated audit log with client-side filtering and **CSV export**.

---

## Security & Authentication Flow

OpenVault uses **HttpOnly cookie-based JWT sessions** to guard against token theft:

1. **Sign-In:** When a user logs in via `POST /api/auth/login`, the server returns standard JSON metadata while setting two secure cookies:
   - `openvault_access`: Access token (15-minute lifetime), `HttpOnly`, `SameSite=Lax`.
   - `openvault_refresh`: Refresh token (7-day lifetime), `HttpOnly`, `SameSite=Lax`.
2. **Automatic Request Signing:** The browser automatically attaches credentials with every request (`credentials: 'include'`). Raw tokens never touch JavaScript `localStorage`, neutralizing XSS exfiltration.
3. **Silent Refresh Interceptor:** When an API request returns `401 Unauthorized`, the client interceptor (`lib/api.ts`) transparently issues `POST /api/auth/refresh` to renew the access cookie and replays the original request without user interruption.
4. **Token Rotation:** On every refresh, old refresh tokens are blacklisted and a fresh refresh cookie is issued (`ROTATE_REFRESH_TOKENS=True`).
5. **Rate Limiting:** Sliding-window rate limiters prevent brute-force attacks:
   - Login: 8 attempts/minute per IP + email.
   - Registration / Password Reset: 5 attempts/10 minutes per IP.
   - Company code lookup: 20 attempts/minute.
6. **Password Reset & Verification:** Secure 30-minute one-time hashed tokens sent via email (`POST /api/auth/forgot-password` and `POST /api/auth/reset-password`).

---

## Plans & PKR Billing

OpenVault subscription tiers are denominated in **Pakistani Rupees (PKR)** and enforced server-side:

| Tier | Price | Member Seats | Documents | Storage | Monthly Asks | Advanced Features |
|---|---|---|---|---|---|---|
| **Free** | PKR 0 / mo | 3 | 20 | 512 MB | 50 | Basic RAG, Audit log |
| **Starter** | PKR 4,500 / mo | 15 | 200 | 5 GB | 1,500 | + File versioning |
| **Business** | PKR 12,500 / mo | 50 | 1,000 | 25 GB | 6,000 | + Departments, BYO Custom LLM key |
| **Enterprise** | PKR 35,000 / mo | Unlimited | Unlimited | Unlimited | Unlimited | All features enabled, Dedicated support |

> The `Plan` table (`manage.py seed_plans`) is the single source of truth for these
> numbers; the pricing page reads them from `GET /api/plans` at runtime.

### Infrastructure Cost Basis
- A typical deployment running on an AWS EC2 `t3.small` instance (~$15/month ≈ PKR 4,200/month) easily supports the Bedrock API configuration.
- Deployments running local models via Ollama run smoothly on an EC2 `t3.medium` or GPU-backed instance (~$30/month ≈ PKR 8,400/month).

To seed or refresh plans in the database:
```bash
backend/.venv/bin/python backend/manage.py seed_plans
```

---

## Data Privacy: AWS Bedrock and Ollama

Organizations often ask about data security when querying documents with AI. OpenVault provides complete clarity and control:

### 1. Cloud AI: Amazon Bedrock
- **What is sent:** A user's question and only the passages allowed by the document permission filter are sent over TLS to the configured Bedrock inference profile.
- The current profile is the India geographic profile. Files and the database remain on the Render service in Oregon, so the selected passages travel from Render to Bedrock in India for inference.
- AWS states that Bedrock inputs and outputs are not used to train the underlying foundation models. Review the relevant model and AWS service terms before processing regulated data.

### 2. Ollama mode
- Chat generation runs on the configured Ollama server. For a fully local RAG path, document and query embeddings must also use a private Ollama endpoint and the document index must be rebuilt with that embedding model.
- The current hosted setup uses Bedrock embeddings. Selecting Ollama for chat alone does not make retrieval fully local.

---

## API Endpoints Reference

All application endpoints are served under `/api/`:

### Authentication
- `POST /api/auth/register` — Register a new company and primary admin.
- `POST /api/auth/login` — Sign in; sets HttpOnly access & refresh cookies.
- `POST /api/auth/refresh` — Silent refresh of access cookie.
- `POST /api/auth/logout` — Blacklists refresh token and clears cookies.
- `GET /api/auth/me` — Retrieve current authenticated user profile.
- `PATCH /api/auth/update-me` — Update full name, title, language (`en`/`ur`), or password.
- `POST /api/auth/forgot-password` — Request password reset email.
- `POST /api/auth/reset-password` — Complete password reset with token.
- `POST /api/auth/request-verification` — Send email verification link.
- `POST /api/auth/verify` — Verify email token.

### Documents
- `GET /api/documents?page=1&page_size=50` — List permitted documents (paginated).
- `POST /api/documents/upload` — Upload file (multipart: file, category, description, access_scope, department, tags).
- `GET|PATCH|DELETE /api/documents/<id>` — View, update metadata, or delete document.
- `GET /api/documents/<id>/download` — Authenticated file download.
- `GET /api/documents/<id>/preview` — In-browser preview of extracted text chunks.
- `POST /api/documents/<id>/reindex` — Trigger re-indexing.
- `GET /api/documents/<id>/versions` — View document version history.
- `POST /api/documents/<id>/versions/new` — Upload a new document version.

### Collaboration & Sharing
- `GET /api/companies/search?code=<code>` — Look up company by access code.
- `GET /api/companies/<code>/members` — List selectable partner employees.
- `GET|POST /api/documents/<id>/shares` — Manage external document access grants.
- `DELETE /api/documents/<id>/shares/<user_id>` — Revoke external access grant.
- `GET /api/shared-with-me` — List documents shared with caller by other companies.

### Chat & AI Inference
- `POST /api/ask` — Stream NDJSON RAG response (supports `conversation_id`, `mode`, `provider`).
- `GET /api/conversations` — List chat threads (paginated).
- `GET|PATCH|DELETE /api/conversations/<id>` — Load, rename, or delete conversation.
- `POST /api/messages/<id>/rate` — Rate an assistant response (thumbs `+1` / `-1`).
- `GET /api/llm-status` — Health status of local and online models.

### Administration & Operations
- `GET /api/admin/company` · `PATCH /api/admin/company` — Manage company profile and seat limit.
- `GET|POST /api/admin/users` · `PATCH|DELETE /api/admin/users/<id>` — Manage teammates, roles, and status.
- `GET|POST /api/admin/departments` · `DELETE .../<id>` — Manage departments.
- `GET|POST /api/admin/announcements` · `DELETE .../<id>` — Broadcast company announcements.
- `GET /api/admin/analytics?days=30` — Usage analytics, unanswered questions, ratings.
- `GET /api/admin/audit?page=1&page_size=100` — Activity audit trail (JSON).
- `GET /api/admin/audit?export=csv` — Export audit trail to CSV file.
- `GET|PUT|DELETE /api/admin/llm-config` — Manage company or platform LLM configuration.
- `POST /api/admin/llm-test` — Live connectivity test for configured LLM.
- `GET /api/plans` — Public catalogue of subscription plans.
- `POST /api/admin/companies/<id>/plan` — Platform admin assigns tenant subscription plan.
- `GET /api/health` — Platform health check (returns 200 OK or 503 Service Unavailable).

---

## Repository Layout

```text
OpenVault/
├── backend/                 Django 5.1 API, RAG pipeline, tests, management commands
│   ├── config/              settings, URLs, WSGI entry point
│   ├── core/                tenancy, documents, chat, billing, audit
│   ├── scripts/             AWS Bedrock / inference utility scripts
│   ├── tests/               pytest suite
│   ├── Dockerfile           Render and container build
│   └── render-entrypoint.sh
├── frontend/                Next.js 16 App Router UI (static-export capable)
│   ├── app/                 routes and pages
│   ├── components/          UI and infrastructure sections
│   └── lib/                 API client, i18n, pricing helpers
├── docs/
│   ├── aws/                 AWS/ECS/ECR architecture and Activate notes
│   ├── deployment/          Amplify + Render + Cloudflare runbook
│   └── notes/               project and security-audit notes
├── deploy/                  Caddy configuration and backup script
├── amplify.yml              AWS Amplify build spec (frontend deploy)
├── render.yaml              Render Blueprint (API, upload disk, DATABASE_URL secret)
└── docker-compose*.yml      local/full-stack container options
```

---

## Local Development & Quick Start

### Prerequisites
- **Python 3.11+**
- **Node.js 20+**
- **pnpm** (or npm)
- **Ollama** (optional, for offline models)

### 1. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate

# Install requirements
pip install -r backend/requirements.txt

# Configure environment
cp backend/.env.example backend/.env
# Generate a secret and paste it into SECRET_KEY= in backend/.env
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

# Run migrations and seed subscription plans
python backend/manage.py migrate
python backend/manage.py seed_plans
```

### 2. Frontend Setup
```bash
cd frontend
pnpm install
cd ..
```

### 3. Launching Dev Servers
```bash
# Starts Django on :8000 and Next.js on :3000
./run.sh

# To stop both servers
./run.sh stop

# Other commands
./run.sh status
./run.sh restart
```

---

## Docker Compose Quick Start

To run the entire stack in containers:

```bash
cp .env.example .env          # set SECRET_KEY at minimum
docker compose up --build     # SQLite (zero-config local)
docker compose --profile pg --profile redis up --build   # PostgreSQL + Redis
```

Access points:
- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

Both images run as non-root, expose container healthchecks, and the API image
collects static files at build time (served by WhiteNoise).

---

## Running the Tests

```bash
# Backend (pytest + Django test DB)
cd backend
pip install -r requirements-dev.txt
python -m pytest

# Frontend (Vitest)
cd frontend
pnpm test
pnpm typecheck
```

CI runs the backend checks/tests, frontend typecheck/tests, the standalone
server build, and the AWS Amplify static export on every push/PR
(`.github/workflows/ci.yml`).

---

## Cloud Deployment (Amplify + Render)

The current public deployment uses two managed hosts from this one repository:

| Component | Host | Build input |
| --- | --- | --- |
| Web UI | AWS Amplify Hosting | `frontend/` via `amplify.yml` (Next.js static export) |
| API, PostgreSQL, uploads | Render | repo root as Docker context, `backend/Dockerfile`, `render.yaml` |

The step-by-step runbook, including Cloudflare DNS and smoke tests, is in
[`docs/deployment/amplify-render-cloudflare.md`](docs/deployment/amplify-render-cloudflare.md).

Key points:

- `frontend/next.config.mjs` defaults to a static export, so Amplify detects
  this as Next.js SSG. Amplify's managed SSR runtime currently supports Next.js
  through v15, while this app uses Next.js 16. `NEXT_PUBLIC_API_URL` is set to
  `https://api.saadops.site` in `amplify.yml`.
  If Amplify reports `Can't find required-server-files.json`, the existing
  app/branch is still registered as SSR; see the runbook for the one-time
  `WEB` / `Next.js - SSG` conversion.
- Render runs migrations and `seed_plans` at container start, then gunicorn.
  The PostgreSQL database already exists in Render and is attached through a
  secret `DATABASE_URL`; the 10 GB upload disk is declared in `render.yaml` and
  is single-instance.
- `DATABASE_URL`, `BEDROCK_API_KEY`, SMTP credentials, and the platform-admin
  password are Render secrets. Never put them in `amplify.yml`,
  `NEXT_PUBLIC_*`, or Git.
- The attached Render database starts empty. To avoid the paid Render Shell,
  set `BOOTSTRAP_PLATFORM_ADMIN_EMAIL` and `BOOTSTRAP_PLATFORM_ADMIN_PASSWORD`
  as Render environment secrets; startup creates the single platform admin.
  Remove both variables after the first successful startup.

---

## Production Deployment (single host)

A single-host production stack is included: **PostgreSQL + Redis + Django/gunicorn
+ Next.js + Caddy (automatic HTTPS)**.

```bash
cp .env.production.example .env.production   # fill in every CHANGE-ME value
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Before going live, confirm:

1. **DNS** for `DOMAIN` points at the server and ports 80/443 are open (Caddy issues the certificate).
2. `SECRET_KEY` and `LLM_KEY_ENCRYPTION_KEY` are long random values, and the encryption key is backed up.
3. **SMTP** is configured and `REQUIRE_EMAIL_VERIFICATION=true`.
4. `ENVIRONMENT=production`, `DEBUG=false`, `COOKIE_SECURE=true` (the backend refuses to start otherwise).
5. A platform admin exists: `docker compose -f docker-compose.prod.yml --env-file .env.production exec -it api python manage.py create_platform_admin you@example.com` (it prompts for a password).
6. Backups are scheduled (see the cron entry below).

```bash
# /etc/cron.d/openvault-backup — nightly DB + media backup, kept 30 days.
15 2 * * * root cd /opt/openvault && BACKUP_DIR=/mnt/backups ./deploy/backup.sh >> /var/log/openvault-backup.log 2>&1
```

### Security controls enabled for production

- HttpOnly + SameSite cookies, rotating refresh tokens with a **blacklist** (old tokens die on refresh, logout, and password change).
- Password policy enforced server-side (min 8, no common/numeric/similar passwords).
- Per-IP/account rate limits. The single-host Compose stack shares counters through **Redis**; the one-worker Render launch uses in-process memory (add a Redis service before scaling Render workers).
- Provider API keys encrypted at rest (`core.crypto`); the API only reports whether a key is set.
- Whitelisted hosts/CORS/CSRF, HSTS + HTTPS redirect, `X-Frame-Options: DENY`, nosniff, WhiteNoise static serving.
- Startup refuses insecure configuration (`ENVIRONMENT=production` + `COOKIE_SECURE=false`).
- Containers run as non-root; PostgreSQL/Redis/API/Next are not published directly (only Caddy's 80/443).
- JSON log rotation (10 MB × 3) is configured for every service.

---

## Platform Administration Commands

### Create or Promote a Root Platform Admin
Root platform administrators have global cross-tenant visibility, can switch active tenant contexts in the workspace, and manage subscription plans.

```bash
# Create a new platform admin (prompts for a hidden password):
python backend/manage.py create_platform_admin root@openvault.internal

# Promote an existing user instead of creating a second admin:
python backend/manage.py create_platform_admin user@company.com --promote
```

Passwords are never stored in this repository. For Render deployments without
Shell access, set `BOOTSTRAP_PLATFORM_ADMIN_EMAIL` and
`BOOTSTRAP_PLATFORM_ADMIN_PASSWORD` as secret environment variables. The
container creates/promotes that account after migrations; remove both variables
after the first successful startup. Use a unique, strong password. The
`create_platform_admin` command remains available for local and self-hosted
deployments with shell access.

### Seed Subscription Plans
```bash
python backend/manage.py seed_plans
```

---

## Academic Documentation

OpenVault is the Final Year Project submission for the University of South Asia.
The academic material is kept alongside the source so the repository can be
used for evaluation and further study:

- [`proposal.md`](proposal.md) — full project proposal
- `OpenVault_FYP_Proposal.docx` — formatted proposal
- `DocuTrust_AI_FYP_Proposal.docx` — earlier proposal draft
- `OpenVault.pptx` — project presentation
- `OpenVault_NVIDIA_Inception_Pitch_Deck.pdf` — pitch deck
- [`docs/aws/`](docs/aws/) — AWS/ECS/ECR architecture and Activate application notes
- [`docs/notes/improvement.md`](docs/notes/improvement.md) — security and quality audit notes
- [`docs/archive/readme-draft.md`](docs/archive/readme-draft.md) — archived README draft (historical only)

---

## Project Team & Attribution

**OpenVault — Final Year Project (FYP)**  
*University of South Asia*

- **Saad Waseem**
- **M Akmal**
- **M Talha**

*Project Presentation: `OpenVault.pptx`*
