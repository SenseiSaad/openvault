# OpenVault

> **Private, Zero-Trust Knowledge Infrastructure & Permission-Aware AI for Registered Organizations.**

OpenVault is an enterprise document repository and retrieval-augmented generation (RAG) assistant designed for organizations that require strict tenant isolation, zero-trust intra-company access controls, auditable cross-company collaboration, multi-turn AI chat history, attendance tracking, and CPA/assurance compliance readiness.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Implemented Features](#key-implemented-features)
3. [Architecture & How It Works](#architecture--how-it-works)
4. [Security & Authentication Flow](#security--authentication-flow)
5. [Plans & PKR Billing](#plans--pkr-billing)
6. [Data Privacy: Google Gemini vs. Local Ollama](#data-privacy-google-gemini-vs-local-ollama)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Data Models & Schema](#data-models--schema)
9. [Roles & Permission Hierarchy](#roles--permission-hierarchy)
10. [Local Development & Quick Start](#local-development--quick-start)
11. [Docker Compose Quick Start](#docker-compose-quick-start)
12. [Platform Administration Commands](#platform-administration-commands)
13. [Project Team & Attribution](#project-team--attribution)

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
- Tiered subscription plans (Free, Starter, SME, Enterprise) priced in **Pakistani Rupees (PKR)** with server-side quota enforcement on seats, documents, storage, and monthly AI asks.
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

### 🤖 Multi-Provider Hybrid RAG Assistant
- Dual-mode chat interface:
  - **Local Mode:** Offline, privacy-first inference via **Ollama** (`qwen2.5:1.5b` or `llama3.2:3b`, `nomic-embed-text`).
  - **Online Mode:** Cloud inference via **Google Gemini** (`gemini-3.8-flash`, `text-embedding-004`), with support for **OpenAI** (`gpt-4o-mini`) and **Anthropic Claude** (`claude-3-5-haiku-latest`).
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
| **Free** | PKR 0 / mo | 5 | 50 | 512 MB | 100 | Basic RAG, Audit log |
| **Starter** | PKR 2,500 / mo | 15 | 500 | 5 GB | 2,000 | + File versioning |
| **SME** | PKR 6,000 / mo | 50 | 5,000 | 25 GB | 10,000 | + Departments, BYO Custom LLM key |
| **Enterprise** | Custom quote | Unlimited | Unlimited | Unlimited | Unlimited | All features enabled, Dedicated support |

### Infrastructure Cost Basis
- A typical deployment running on an AWS EC2 `t3.small` instance (~$15/month ≈ PKR 4,200/month) easily supports the cloud-API configuration (Gemini / OpenAI).
- Deployments running local models via Ollama run smoothly on an EC2 `t3.medium` or GPU-backed instance (~$30/month ≈ PKR 8,400/month).

To seed or refresh plans in the database:
```bash
backend/.venv/bin/python backend/manage.py seed_plans
```

---

## Data Privacy: Google Gemini vs. Local Ollama

Organizations often ask about data security when querying documents with AI. OpenVault provides complete clarity and control:

### 1. Cloud AI: Google Gemini (Online Mode)
- **What is sent:** When a user asks a question, the question and the top retrieved passages from permitted documents are transmitted over TLS to the Google Gemini API.
- **Paid / Commercial API Tier:** Under Google's enterprise API terms, **customer data is NOT used to train Google models**. Data is processed solely for inference and retained only temporarily for abuse monitoring.
- **Free AI Studio Tier:** Prompt data may be sampled by Google for product improvement. Use paid API keys in enterprise production.

### 2. Local AI: Ollama (Offline Mode)
- **Zero Data Leakage:** Both the embedding model (`nomic-embed-text`) and chat model (`qwen2.5` or `llama3.2`) run 100% on your own server.
- **Strict Privacy:** No text, vectors, or questions ever leave your server or network. Ideal for classified, healthcare, or sensitive legal documents.

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
./start.sh

# To stop both servers
./stop.sh
```

---

## Docker Compose Quick Start

To run the entire stack in containers:

```bash
# Build and start frontend and backend with SQLite
docker compose up --build

# Or with PostgreSQL profile
docker compose --profile pg up --build
```

Access points:
- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

---

## Platform Administration Commands

### Create or Promote a Root Platform Admin
Root platform administrators have global cross-tenant visibility, can switch active tenant contexts in the workspace, and manage subscription plans.

```bash
# Create a new platform admin:
python backend/manage.py create_platform_admin root@openvault.internal --password "YourStrongPassword!123"

# Promote an existing user:
python backend/manage.py create_platform_admin user@company.com --promote
```

### Seed Subscription Plans
```bash
python backend/manage.py seed_plans
```

---

## Project Team & Attribution

**OpenVault — Final Year Project (FYP)**  
*University of South Asia*

- **Saad Waseem**
- **M Akmal**
- **M Talha**

*Project Presentation: `OpenVault.pptx`*
