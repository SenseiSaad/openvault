# OpenVault

> **Private Knowledge Infrastructure with Least-Privilege Document ACLs & Permission-Aware AI for Registered Organizations.**

OpenVault is an enterprise document repository and retrieval-augmented generation (RAG) assistant designed for organizations that require strict tenant isolation, least-privilege intra-company access controls, auditable cross-company collaboration, multi-turn AI chat history, attendance tracking, and compliance audit readiness.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Features](#key-features)
3. [Security & Authentication Flow](#security--authentication-flow)
4. [Plans & USD Billing](#plans--usd-billing)
5. [Data Privacy: AWS Bedrock & Ollama](#data-privacy-aws-bedrock--ollama)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Repository Layout](#repository-layout)
8. [Local Development & Quick Start](#local-development--quick-start)
9. [Deploying to Vercel (Frontend + Backend)](#deploying-to-vercel-frontend--backend)
10. [Docker Compose & Self-Hosted Deployment](#docker-compose--self-hosted-deployment)
11. [Running the Tests](#running-the-tests)
12. [Platform Administration Commands](#platform-administration-commands)

---

## Executive Summary

OpenVault is built around **employer-controlled private access**:

- **Strict Multi-Tenancy:** Every document, vector chunk, user account, attendance record, and audit entry is bound to a verified `Company` tenant.
- **Least-Privilege Document Scoping:** Documents can be scoped company-wide, to a specific department, or locked to selected people (`restricted`). Even same-company executives cannot search or view restricted files without an explicit grant.
- **Controlled Cross-Company Collaboration:** Organizations locate partner companies via unique 5-character share codes (`access_code`). Admins can grant a specific document to a registered employee at a partner company, with immediate revocation and download restrictions.
- **Permission-Aware RAG:** Chat retrieval filters documents based on the requesting user's explicit permissions *before* running hybrid retrieval (BM25 + dense cosine similarity), ensuring the AI never leaks unauthorized information.
- **Multi-Turn Persistent Chat:** Interactive threaded conversations with recent turns supplied to the LLM, thumbs up/down user feedback, and live source citations.
- **Audit Readiness:** Every sign-in, upload, download, share, revocation, member modification, and AI prompt is recorded in an append-only (at the API layer) audit trail with IP tracking and CSV export.

---

## Key Features

### Multi-Tenancy & Subscriptions
- Isolated company workspaces identified by slug and unique 5-character `access_code`.
- Company self-service settings: name, website, contact email, phone, and seat cap.
- Tiered subscription plans (Free, Starter, Business, Enterprise) priced in **USD** with server-side quota enforcement on seats, documents, storage, and monthly AI asks.
- Cross-tenant platform administration for root operators with an active tenant switcher.

### Least-Privilege Document Management
- Supported formats: **PDF (`.pdf`)**, **Word (`.docx`)**, **PowerPoint (`.pptx`)**, **Markdown (`.md`)**, **Plain Text (`.txt`, `.csv`)**, and scanned PDFs/images via OCR (tesseract + poppler are installed in the API image).
- Three-tier access scoping (`company`, `department`, `restricted`).
- **Flexible Storage Backend:** Supports Amazon S3 object storage (with presigned direct browser uploads for files > 4 MB on serverless deployments) and local filesystem storage.
- **Adaptive Indexing:** Runs inline on serverless functions (Vercel) or in background threads on long-running servers, with retry capability (`POST /api/documents/<id>/reindex`).
- **Document Versioning:** Upload new versions of existing documents while preserving archive history and sharing rules.
- **In-Browser Text Preview:** View extracted text chunks directly without forced downloads.

### Granular Cross-Company Collaboration
- Tenant lookup via 5-character access code (`GET /api/companies/search?code=...`).
- Granular per-user, per-document grants (`POST /api/documents/<id>/shares`) with configurable download permission (`can_download: true/false`).
- Instant revocation (`DELETE /api/documents/<id>/shares/<user_id>`).
- Dedicated "Shared with me" view displaying externally granted files.

### Bedrock + Ollama RAG Assistant
- **AWS Bedrock** (Claude Haiku 4.5 via the India `in.` geographic inference profile + Titan Text Embeddings V2) as the hosted default, plus support for **Ollama**, **OpenAI**, **Anthropic**, and **Google Gemini**.
- **Hybrid Retrieval:** Blended 70% dense cosine similarity + 30% BM25 keyword retrieval.
- **Automated Workflows:** Detects intent to schedule meetings (Google Calendar / email notification) and generate auto-filled leave application forms (`.docx`).
- **Policy Flagging:** Non-blocking audit-logged safety alerts for compliance monitoring.
- **Bilingual UI:** English and Urdu / Roman Urdu support.

### Member Administration, Attendance & Audit
- Department assignment, inline member role editing (`admin`, `employee`, `viewer`), and account activation/deactivation.
- QR-code attendance check-in with 3-strike policy tracking.
- Broadcast company announcements and 30-day usage analytics dashboard.
- Paginated audit log with client-side filtering and **CSV export**.

---

## Security & Authentication Flow

1. **HttpOnly Cookie JWT Sessions:** `POST /api/auth/login` sets `openvault_access` (15-min) and `openvault_refresh` (7-day) cookies with `HttpOnly` and `SameSite=Lax`.
2. **Automatic Request Signing:** The browser attaches credentials automatically (`credentials: 'include'`); tokens never touch `localStorage`.
3. **Silent Refresh Interceptor:** On `401 Unauthorized`, `frontend/lib/api.ts` calls `POST /api/auth/refresh` and replays the original request.
4. **Token Rotation & Blacklisting:** Old refresh tokens are blacklisted on every refresh, logout, and password change.
5. **Sliding-Window Rate Limiting:** Protects login, registration, password reset, and company code lookup (backed by Redis when `CACHE_URL` is configured, or in-memory cache locally).

---

## Plans & USD Billing

| Tier | Price | Member Seats | Documents | Storage | Monthly Asks | Features |
|---|---|---|---|---|---|---|
| **Free** | \$0 / mo | 3 | 20 | 512 MB | 50 | Basic RAG, Audit log |
| **Starter** | \$15 / mo | 15 | 200 | 5 GB | 1,500 | + File versioning |
| **Business** | \$49 / mo | 50 | 1,000 | 25 GB | 6,000 | + Departments, BYO Custom LLM key |
| **Enterprise** | \$129 / mo | Unlimited | Unlimited | Unlimited | Unlimited | All features enabled, Dedicated support |

To seed or refresh plans in the database:
```bash
python backend/manage.py seed_plans
```

---

## Data Privacy: AWS Bedrock & Ollama

- **Amazon Bedrock:** Only the user's question and passages permitted by the document ACL filter are sent over TLS to the configured AWS Bedrock inference profile (`in.anthropic.claude-haiku-4-5-20251001-v1:0`). AWS Bedrock does not use customer prompts or outputs to train foundation models.
- **Ollama (Local / Private Server):** When both `LLM_PROVIDER=ollama` and `EMBED_PROVIDER=ollama` point to a private Ollama server, prompts and embeddings stay entirely on your infrastructure.

---

## API Endpoints Reference

All endpoints are served under `/api/`:

- **Health:** `GET /api/health`
- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/update-me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/request-verification`, `POST /api/auth/verify`
- **Documents:** `GET /api/documents`, `POST /api/documents/upload`, `POST /api/documents/presign`, `POST /api/documents/confirm`, `GET|PATCH|DELETE /api/documents/<id>`, `GET /api/documents/<id>/download`, `GET /api/documents/<id>/preview`, `POST /api/documents/<id>/reindex`, `GET /api/documents/<id>/versions`, `POST /api/documents/<id>/versions/new`
- **Sharing:** `GET /api/companies/search?code=<code>`, `GET /api/companies/<code>/members`, `GET|POST /api/documents/<id>/shares`, `DELETE /api/documents/<id>/shares/<user_id>`, `GET /api/shared-with-me`
- **Chat & AI:** `POST /api/ask`, `GET /api/conversations`, `GET|PATCH|DELETE /api/conversations/<id>`, `POST /api/messages/<id>/rate`, `GET /api/llm-status`
- **Workflows & Attendance:** `GET /api/workflow/forms/<user_id>/<name>`, `POST /api/attendance/scan`, `GET /api/attendance/me`, `GET /api/attendance/qr`, `POST /api/admin/attendance/evaluate`
- **Administration:** `GET|PATCH /api/admin/company`, `GET|POST /api/admin/users`, `PATCH|DELETE /api/admin/users/<id>`, `GET|POST /api/admin/departments`, `DELETE /api/admin/departments/<id>`, `GET|POST /api/admin/announcements`, `DELETE /api/admin/announcements/<id>`, `GET /api/admin/analytics`, `GET /api/admin/usage`, `GET /api/admin/audit`, `GET|PUT|DELETE /api/admin/llm-config`, `POST /api/admin/llm-test`, `GET /api/plans`, `GET /api/admin/companies`, `POST /api/admin/companies/<id>/plan`, `POST /api/admin/switch-company`, `POST /api/admin/detach-company`

---

## Repository Layout

```text
OpenVault/
├── backend/                 Django 5.1 API, RAG pipeline, S3/local storage, tests
│   ├── api/index.py         Vercel Python WSGI serverless entrypoint
│   ├── config/              Django settings, URLs, WSGI/ASGI entrypoints
│   ├── core/                Tenancy, documents, storage, RAG, billing, audit
│   ├── tests/               Pytest suite
│   ├── vercel.json          Vercel serverless configuration for backend
│   └── Dockerfile           Container build for Docker / Render
├── frontend/                Next.js 16 App Router UI (Vercel, Amplify SSG, and Docker ready)
│   ├── app/                 Routes and pages
│   ├── components/          UI and workspace components
│   ├── lib/                 API client (with S3 presigned upload fallback), i18n, auth
│   └── vercel.json          Vercel configuration for frontend
├── docs/                    Deployment and AWS Bedrock documentation
├── deploy/                  Caddy configuration and backup script
├── .env.vercel.example      Ready-to-copy environment variables for Vercel
├── amplify.yml              AWS Amplify build spec (frontend static export)
├── render.yaml              Render Blueprint
└── docker-compose*.yml      Local and single-host production container stacks
```

---

## Local Development & Quick Start

### 1. Backend Setup
```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

cp backend/.env.example backend/.env
# Generate a secret and set SECRET_KEY in backend/.env:
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

python backend/manage.py migrate
python backend/manage.py seed_plans
```

### 2. Frontend Setup
```bash
cd frontend
pnpm install
cd ..
```

### 3. Run Dev Servers
```bash
./run.sh          # Starts Django on :8000 and Next.js on :3000
./run.sh stop     # Stops both servers
```

---

## Deploying to Vercel (Frontend + Backend)

OpenVault is configured so both `backend/` and `frontend/` can be deployed directly to Vercel from this GitHub repository while keeping PostgreSQL on Render (and AWS Amplify active for the frontend until you cut over).

### 1. Database Preparation (Render PostgreSQL)
- Keep your existing Render PostgreSQL instance.
- Copy the **External Database URL** from Render and append `?sslmode=require` (e.g. `postgresql://user:pass@dpg-xxx.oregon-postgres.render.com/openvault?sslmode=require`).
- Ensure Render's PostgreSQL Access Control allows external connections (`0.0.0.0/0`).

### 2. Deploy the Backend to Vercel
1. In the Vercel Dashboard, click **Add New → Project** and import this GitHub repository.
2. Set **Root Directory** to `backend`.
3. Paste the backend environment variables from [`.env.vercel.example`](.env.vercel.example) into **Settings → Environment Variables**:
   - `DATABASE_URL`, `SECRET_KEY`, `LLM_KEY_ENCRYPTION_KEY` (reuse your existing Render keys so sessions and encrypted LLM keys remain valid).
   - `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `PUBLIC_BASE_URL`.
   - `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_REGION_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (for persistent document storage on S3).
   - `BEDROCK_*` and `EMAIL_*` settings.
4. Click **Deploy**. Verify health at `https://<your-backend>.vercel.app/api/health`.
5. Attach your custom API domain (e.g. `api.saadops.site`) under **Settings → Domains**.
6. Run database migrations and plan seeding against the external `DATABASE_URL` when releasing schema updates:
   ```bash
   DATABASE_URL="postgresql://...?sslmode=require" SECRET_KEY="temp" \
     backend/.venv/bin/python backend/manage.py migrate
   DATABASE_URL="postgresql://...?sslmode=require" SECRET_KEY="temp" \
     backend/.venv/bin/python backend/manage.py seed_plans
   ```
7. If migrating existing files from a Render disk to S3, run:
   ```bash
   python backend/manage.py migrate_files_to_s3
   ```

### 3. Deploy the Frontend (Amplify Now, Vercel Anytime)
- **While on AWS Amplify:** Amplify continues using `amplify.yml` (`output: 'export'`) and talks to `NEXT_PUBLIC_API_URL=https://api.saadops.site`. Include your Amplify domain in the backend's `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
- **When moving Frontend to Vercel:**
  1. In Vercel, click **Add New → Project** and import the same repository.
  2. Set **Root Directory** to `frontend`.
  3. Set environment variable `NEXT_PUBLIC_API_URL=https://api.saadops.site`.
  4. Click **Deploy** (`frontend/next.config.mjs` automatically detects `VERCEL=1` and builds natively for Vercel).
  5. Attach `openvault.saadops.site` to the frontend Vercel project.

---

## Docker Compose & Self-Hosted Deployment

```bash
# Local zero-config SQLite stack:
cp .env.example .env
docker compose up --build

# Single-host production stack (PostgreSQL + Redis + Django + Next.js + Caddy HTTPS):
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## Running the Tests

```bash
# Backend (pytest)
cd backend
pip install -r requirements-dev.txt
python -m pytest

# Frontend (Vitest + TypeScript)
cd frontend
pnpm test
pnpm typecheck
```

---

## Platform Administration Commands

```bash
# Create a new root platform administrator:
python backend/manage.py create_platform_admin root@openvault.internal

# Promote an existing user to platform admin:
python backend/manage.py create_platform_admin user@company.com --promote

# Seed or update subscription plans:
python backend/manage.py seed_plans
```
