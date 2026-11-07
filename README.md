# OpenVault

> **Private Multi-Tenant Knowledge Infrastructure with Least-Privilege Document ACLs, Deterministic Document Generation, and Permission-Aware AI for Enterprise Organizations.**

OpenVault is an enterprise document repository and retrieval-augmented generation (RAG) assistant designed for organizations that require strict tenant isolation, least-privilege intra-company access controls, auditable cross-company collaboration, multi-turn AI chat history with citations, legal-safe attendance tracking, and compliance audit readiness.

---

## Zero-Step Quickstart (Clone & Run in One Line)

OpenVault includes an automated launcher that handles `.env` generation, cryptographic key generation, migrations, demo corpus seeding, and service orchestration automatically:

```bash
git clone https://github.com/SenseiSaad/openvault.git OpenVault
cd OpenVault

# Option A: Full Docker Compose stack (Next.js :3000 + Django :8000 + SQLite)
./scripts/start_local.sh --docker

# Option B: Native local development (runs with local node + python venv)
./scripts/start_local.sh --native

# Stop all running instances:
./scripts/start_local.sh --stop
```

Chat and retrieval support both local and cloud LLMs:
* **Local (Zero-Cloud / Offline):** Install [Ollama](https://ollama.com), run `ollama pull nomic-embed-text && ollama pull qwen2.5:3b`, and set `LLM_PROVIDER=ollama`.
* **Hosted Cloud (Production Default):** Set AWS Bedrock credentials (`BEDROCK_*`) for Claude 3.5 / Haiku + Titan Embeddings v2, or supply `GEMINI_API_KEY` / `OPENAI_API_KEY`.

---

## AWS Production Deployment (ECS Fargate + RDS pgvector)

The production architecture is codified in Terraform (`infra/`, ~3,900 LOC across 9 modular components):
* **Compute:** AWS ECS Fargate with Application Load Balancer (ALB).
* **Database & Vectors:** Amazon RDS PostgreSQL 16 with `pgvector` HNSW vector indexes (`core_chunk.embedding_vec`).
* **Caching & Broker:** Amazon ElastiCache Redis 7 for rate-limiting and task queuing.
* **Storage:** Encrypted Amazon S3 bucket for documents, version archives, and generated artifacts.
* **CI/CD:** Automated GitHub Actions workflows with AWS OIDC authentication (no static IAM credentials).

```bash
cp deploy.config.example deploy.config
$EDITOR deploy.config
cp .env.production.example .env.production
$EDITOR .env.production

# Run preflight checks, infrastructure provisioning, and first deployment:
./scripts/bootstrap.sh
```

See [`docs/DEPLOY.md`](docs/DEPLOY.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full runbooks and infrastructure specs.

---

## Table of Contents

1. [Architecture & Key Features](#architecture--key-features)
2. [Tenant Isolation & Document ACLs](#tenant-isolation--document-acls)
3. [AI Retrieval, Workflows & DocGen](#ai-retrieval-workflows--docgen)
4. [Compliance, Legal Safeguards & Feature Flags](#compliance-legal-safeguards--feature-flags)
5. [Security & Authentication](#security--authentication)
6. [Subscription Plans & Commercial Pricing](#subscription-plans--commercial-pricing)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Management Commands](#management-commands)
9. [Running Tests & Quality Assurance](#running-tests--quality-assurance)

---

## Architecture & Key Features

### Strict Multi-Tenancy
* Every document, chunk, user account, attendance record, and audit entry has a mandatory foreign key to a verified `Company` tenant.
* Cross-tenant leaks are mathematically impossible at the database query layer: all retrieval, search, and admin queries enforce `company=request.user.company`.
* Organizations locate partner companies via unique 8-character access codes (`access_code`).

### Least-Privilege Document Scoping
* **Supported formats:** PDF (`.pdf`), Word (`.docx`), PowerPoint (`.pptx`), Markdown (`.md`), Plain Text (`.txt`, `.csv`), and scanned PDFs/images via OCR (`tesseract` + `poppler`).
* **Three Access Scopes:**
  1. `company`: Visible to all authenticated members of the tenant.
  2. `department`: Automatically restricted to members of the document's assigned department.
  3. `restricted`: Locked strictly to explicitly granted individuals (`DocumentAccess`), invisible even to company managers without access grants.
* **Granular Cross-Company Collaboration:** Admins can share a specific single document with a named user at a partner company (`DocumentShare`), with configurable download permissions and instant revocation.

---

## AI Retrieval, Workflows & DocGen

### Hybrid Retrieval Engine
* **Blended Retrieval:** 70% dense vector similarity (cosine distance over 1024-dim Bedrock Titan Text Embeddings v2 or 768-dim Ollama) + 30% BM25 keyword matching with stemming.
* **Database Acceleration:** Uses PostgreSQL `pgvector` with HNSW indexes in production; falls back to an in-memory NumPy vector scan on local SQLite development.
* **Grounded Answers:** Returns exact document citations with highlighted passage snippets. Refuses to invent facts if company documents do not contain the answer.
* **Bilingual Support:** Responds fluently in English, Urdu, and Roman Urdu.

### Deterministic Document Generation (DocGen)
* Fills HR forms, leave requests, expense claim sheets, IT access requests, and official letters with real employee and company profile data.
* Deterministic rule-based template parser (no hallucinated personal details, no model cost).
* Exports finished documents to `.docx`, `.pdf`, `.md`, and `.txt`.

---

## Compliance, Legal Safeguards & Feature Flags

OpenVault includes production-grade feature flags and legal compliance guards designed to prevent HR liability and database schema corruption:

### 1. Attendance Tracking & Warn-Only Default
* QR-code check-in with HMAC-SHA256 signed, short-lived tokens bound to the company's access code.
* **Warn-Only Safety Mode (`ATTENDANCE_AUTO_FREEZE=false`):** When employees accumulate 3 strikes in a month, strikes are recorded and flagged on the admin dashboard, but user accounts are **never** automatically locked out without manual HR confirmation.
* **Company Feature Toggle (`enable_attendance`):** Tenants who only want a document search engine can disable attendance completely; the UI hides attendance tabs and the API returns 403.

### 2. Document Generation Toggle (`enable_docgen`)
* Companies requiring a strict, read-only knowledge base can disable DocGen. Chat automatically bypasses template parsing and routes 100% of queries to pure RAG retrieval.

### 3. Vector Dimension & Model Drift Guard
* Mismatched embedding vector dimensions (e.g., Bedrock 1024d vs. Ollama 768d vs. OpenAI 1536d) cause fatal SQL errors on PostgreSQL `vector(N)` columns.
* `LLMConfigSerializer` surfaces proactive dimension warnings in the admin settings API.
* Documents track `embed_model` and flag `reindex_required=True` whenever active model geometry changes.
* CLI diagnostic commands monitor coverage and alignment:
  ```bash
  python backend/manage.py check_embeddings
  python backend/manage.py reindex_embeddings --all
  ```

---

## Security & Authentication

1. **HttpOnly Cookie JWT Sessions:** Login sets `openvault_access` (15-min) and `openvault_refresh` (7-day) cookies with `HttpOnly`, `SameSite=Lax`, and `Secure` (in HTTPS production). Tokens never touch `localStorage`.
2. **Silent Refresh Interceptor:** The Next.js API client intercepts `401 Unauthorized` responses, refreshes tokens via `POST /api/auth/refresh`, and replays requests transparently.
3. **Token Rotation & Revocation:** Old refresh tokens are blacklisted upon refresh, password reset, or logout.
4. **Sliding-Window Rate Limiting:** Redis-backed (or cache-backed locally) rate limiters protect login, registration, password resets, and search endpoints.
5. **SSRF & Cryptography:** Outbound URLs for BYO AI endpoints pass an SSRF guard. Custom provider API keys are encrypted at rest with Fernet (`AES-128-CBC` + `HMAC-SHA256`).

---

## Subscription Plans & Commercial Pricing

OpenVault enforces plan quotas on member seats, document counts, storage capacity, and monthly AI queries at the API layer:

| Tier | Price (USD) | Member Seats | Documents | Storage | Monthly Asks | Included Features |
|---|---|---|---|---|---|---|
| **Free** | \$0 / mo | 3 | 20 | 512 MB | 50 | Hybrid RAG, Audit log, QR Attendance |
| **Starter** | \$29 / mo | 15 | 200 | 5 GB | 1,500 | + File versioning, DocGen exports |
| **Business** | \$99 / mo | 50 | 1,000 | 25 GB | 6,000 | + Departments, BYO AI keys, Priority search |
| **Enterprise** | \$299+ / mo | Unlimited | Unlimited | Unlimited | Unlimited | Dedicated ECS instance, On-Prem AI, Custom SLA |

Seed or refresh plans in the database:
```bash
python backend/manage.py seed_plans
```

---

## API Endpoints Reference

All endpoints are served under `/api/`:

* **System Health:** `GET /api/health`
* **Authentication:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/update-me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
* **Documents:** `GET /api/documents`, `POST /api/documents/upload`, `GET|PATCH|DELETE /api/documents/<id>`, `GET /api/documents/<id>/download`, `GET /api/documents/<id>/preview`, `POST /api/documents/<id>/reindex`, `GET|POST /api/documents/<id>/versions`
* **Collaboration:** `GET /api/companies/search?code=<code>`, `GET /api/companies/<code>/members`, `GET|POST /api/documents/<id>/shares`, `DELETE /api/documents/<id>/shares/<user_id>`, `GET /api/shared-with-me`
* **Chat & AI:** `POST /api/ask`, `GET /api/conversations`, `GET|PATCH|DELETE /api/conversations/<id>`, `POST /api/messages/<id>/rate`, `GET /api/llm-status`
* **Templates & DocGen:** `GET /api/templates`, `POST /api/docgen`, `POST /api/artifacts/from-text`, `GET /api/artifacts/<id>`, `GET /api/artifacts/<id>/download`
* **Attendance:** `POST /api/attendance/scan`, `GET /api/attendance/me`, `GET /api/attendance/qr`, `GET|POST /api/admin/attendance/holidays`, `GET|POST /api/admin/attendance/exemptions`, `POST /api/admin/attendance/evaluate`
* **Administration:** `GET|PATCH /api/admin/company`, `GET|POST /api/admin/users`, `PATCH|DELETE /api/admin/users/<id>`, `GET|POST /api/admin/departments`, `GET /api/admin/analytics`, `GET /api/admin/usage`, `GET /api/admin/audit`, `GET|PUT|DELETE /api/admin/llm-config`, `POST /api/admin/llm-test`, `GET /api/plans`

---

## Management Commands

```bash
# Seed initial plans and demo corpus:
python backend/manage.py seed_plans
python backend/manage.py seed_policy_docs

# Check embedding coverage and detect model/dimension drift:
python backend/manage.py check_embeddings

# Reindex chunks (safe backfill or full geometry recompute):
python backend/manage.py reindex_embeddings
python backend/manage.py reindex_embeddings --all

# Create or promote root platform administrators:
python backend/manage.py create_platform_admin admin@openvault.site
```

---

## Running Tests & Quality Assurance

```bash
# Backend pytest suite (220+ tests: isolation, tenancy, guards, RAG, auth):
backend/.venv/bin/pytest backend/tests/

# Frontend test suite (Vitest):
cd frontend && pnpm test

# Frontend production compile check (Turbopack):
cd frontend && pnpm build
```
