# OpenVault

> **Archived draft — superseded by the root `README.md`.** Kept for historical
> detail only; some sections describe earlier behavior (for example, before
> department-level scoping, document versioning, and async indexing were added).
> Do not use this file as current setup instructions.

> **Private, Zero-Trust Knowledge Infrastructure & Permission-Aware AI for Registered Organizations.**

OpenVault is an enterprise document repository and retrieval-augmented generation (RAG) assistant designed for organizations that require strict tenant isolation, zero-trust intra-company access controls, auditable cross-company collaboration, and CPA/assurance compliance readiness.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Implemented Features](#key-implemented-features)
3. [Architecture & How It Works](#architecture--how-it-works)
4. [Technology Stack](#technology-stack)
5. [Application Pages & Routes](#application-pages--routes)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Data Models & Schema](#data-models--schema)
8. [Roles & Permission Hierarchy](#roles--permission-hierarchy)
9. [AI & RAG Pipeline Setup](#ai--rag-pipeline-setup)
10. [Local Development & Quick Start](#local-development--quick-start)
11. [What Is Remaining / Roadmap](#what-is-remaining--roadmap)
12. [Project Team & Attribution](#project-team--attribution)

---

## Executive Summary

Unlike conventional document repositories or public document marketplaces, OpenVault is built exclusively around **employer-controlled private access**:

- **No Public Library / No Free Browsing:** Public discovery and guest accounts were intentionally decommissioned. Every user belongs to a verified enterprise tenant.
- **Tenant Isolation:** Every document, vector chunk, member account, and audit log row is bound to a `Company` foreign key.
- **Zero-Trust Document Scoping:** Documents can be published company-wide (`company`) or locked down to selected people (`restricted`). Even C-suite executives in the same tenant cannot view or query restricted files unless explicitly granted access.
- **Controlled Cross-Company Collaboration:** Organizations locate partner companies via unique 5-character share codes (`access_code`). Admins can grant exactly one document to one specific registered employee at a partner company, with immediate revocation and download restrictions.
- **Permission-Aware RAG:** Chat retrieval filters documents based on the requesting user's explicit ACL *before* searching vector embeddings, ensuring the AI never leaks unauthorized information.
- **CPA & Assurance Audit Readiness:** Every sign-in, upload, download, share, revocation, member modification, and AI prompt is logged in an append-only audit trail with IP tracking.

---

## Key Implemented Features

### 🏢 Multi-Tenancy & Isolation
- Isolated company workspaces identified by slug and unique 5-character `access_code`.
- Company profiles with contact information, website, phone, and optional seat limits (`max_employees`).
- Platform helper / superadmin tooling for seamless cross-tenant inspection and development switching.

### 🔐 Zero-Trust Document Management
- Support for multiple document formats: **PDF (`.pdf`)**, **Word (`.docx`)**, **PowerPoint (`.pptx`)**, **Markdown (`.md`)**, and **Plain Text (`.txt`, `.csv`)**.
- Two-tier access scoping:
  - `Entire company`: Searchable and downloadable by all active members of the tenant.
  - `Selected people`: Searchable and downloadable only by the uploader and explicitly authorized colleagues.
- Curated Knowledge Notes (`is_okf`): Organizational Knowledge Framework documents are permanently injected into the RAG context to reinforce company compliance guidelines and rules.
- Authenticated file downloads with server-side download permission validation.

### 🤝 Controlled Cross-Company Sharing
- Tenant lookup via 5-character access code (`GET /api/companies/search?code=...`).
- Member resolution for partner companies (`GET /api/companies/<code>/members`).
- Granular per-user, per-document grants (`POST /api/documents/<id>/shares`).
- Configurable download permission per grant (`can_download: true/false`).
- Instant access revocation (`DELETE /api/documents/<id>/shares/<user_id>`).
- Dedicated "Shared with me" view displaying externally granted files.

### 🤖 Multi-Provider RAG AI Assistant
- Dual-mode chat interface:
  - **Local Mode:** Offline, privacy-first inference via **Ollama** (`qwen2.5:1.5b` or `llama3.2:3b`, `nomic-embed-text`).
  - **Online Mode:** Cloud inference via **Google Gemini** (`gemini-1.5-flash`, `text-embedding-004`), with support for **OpenAI** (`gpt-4o-mini`) and **Anthropic Claude** (`claude-3-5-haiku-latest`).
- Real-time NDJSON token streaming (`POST /api/ask`).
- In-place Gemini API key configuration modal directly in the chat interface.
- Automatic keyword fallback (normalized term frequency) when vector embeddings or embedding models are unavailable.
- Citation tracking returning the exact source document names alongside streamed answers.
- Prompt injection protection built into the system instructions.

### 📋 Member Administration & Audit Trail
- Company seat limits enforced during member creation.
- Member invitation with job titles (e.g., CEO, CFO, CTO, HR, Legal, Engineer) for clear recipient selection.
- Role management: `admin`, `employee`, `viewer`.
- 200-row searchable and filterable activity audit trail per company.
- Interactive CPA Readiness scorecard and control checklist.

### 🎨 Modern UI & Design System
- Modern editorial aesthetic with warm neutrals, serif accents, and responsive layout.
- Light, Dark, and System theme switching with custom `ThemeProvider` and persistent `localStorage`.
- Toast notifications (`toaster.tsx`) and accessible confirmation dialogs (`confirm-dialog.tsx`).
- Responsive sidebar navigation on desktop and top bar on mobile.

---

## Architecture & How It Works

### High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Next.js 16 Client                    │
│   (App Router, React 19, Tailwind CSS v4, Lucide)     │
└───────────┬────────────────────────────────┬───────────┘
            │ HTTP / JSON REST               │ NDJSON Stream
            ▼                                ▼
┌────────────────────────────────────────────────────────┐
│                 Django 5 REST API (:8000)               │
│      (SimpleJWT Auth, Multi-Tenant Scoped Views)       │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌─────────────────────────┐      ┌───────────────────────┐
│     SQLite Database     │      │   RAG Engine & LLM    │
│  - Companies & Users    │      │ - In-Memory Vectors   │
│  - Documents & Chunks   │      │ - Ollama / Gemini /   │
│  - Access Grants/Shares │      │   OpenAI / Claude     │
│  - Audit Logs           │      │ - Keyword Fallback    │
└─────────────────────────┘      └───────────────────────┘
```

### The RAG Pipeline Lifecycle

1. **Upload & Ingestion:**
   - The file is saved to `backend/data/<company-slug>/<uuid>_<filename>`.
   - Text is parsed using `pypdf`, `python-docx`, `python-pptx`, or UTF-8 decoding.
   - Text is split on paragraph breaks into ~900-character windows with 150-character overlaps.
   - Embedding vectors are computed via the active embedding provider and packed as float32 binary blobs in `Chunk` rows.
2. **Permission-Constrained Retrieval:**
   - When a user asks a question, `accessible_doc_ids(user)` computes the permitted document set:
     - Company-wide documents owned by the user's company.
     - Restricted documents where the user has a `DocumentAccess` grant.
     - External documents where the user has a `DocumentShare` record.
   - Any document marked `is_okf=True` has its chunks immediately prepended to context.
   - Remaining chunks are ranked using cosine similarity against the question embedding vector, or normalized keyword matching if offline.
3. **Prompt Synthesis & Streaming:**
   - Top chunks are formatted into sanitized `[Doc Name]` blocks.
   - The system prompt instructs the model to answer *only* from context and cite document names.
   - Tokens are streamed incrementally back to the client as NDJSON lines.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | Next.js 16.3.3 | App Router, Server & Client Components |
| **UI Library** | React 19 | View rendering |
| **Styling** | Tailwind CSS v4 + `tw-animate-css` | Responsive styling and animations |
| **Icons** | Lucide React 1.16.0 | UI iconography |
| **Backend Framework** | Django 5.1.4 + DRF 3.15.2 | RESTful API and ORM |
| **Authentication** | `djangorestframework-simplejwt` 5.3.1 | Stateless JWT Bearer tokens |
| **Database** | SQLite 3 | Prototype multi-tenant storage |
| **Vector Math** | NumPy 2.2.1 | Cosine similarity & vector packing |
| **Document Parsers** | `pypdf`, `python-docx`, `python-pptx` | Text extraction from binary formats |
| **LLM Integrations** | Ollama, Google Gemini, OpenAI, Anthropic | Local & cloud model adapters |
| **Deployment Spec** | AWS Amplify (`amplify.yml`) | Frontend SSR deployment |

---

## Application Pages & Routes

### Public & Informational Routes
- `/` — **Landing Page:** Value proposition, 3 pillars, access control diagram, CPA evidence overview, and entry CTAs.
- `/about` — **About OpenVault:** Tenant isolation details, operating model, and assurance handoff guides.
- `/help` — **How It Works:** 4-step onboarding guide, upload rules, and sharing FAQs.
- `/policy` — **Privacy & Security:** Core rules governing private vaults, least-privilege, and auditability.
- `/auth` — **Access Gateway:** Role selection directing users to enterprise registration, employee login, or admin login.
- `/enterprise` — **Enterprise Auth:** Dual-tab screen for employee/admin login (`?tab=signin`) or registering a new organization (`?tab=create`).

### Private Enterprise Workspace (`/workspace`)
- `/workspace` — **Overview Dashboard:** Company profile card with access code, live LLM status indicator, stat counters, CPA readiness scorecard, recent uploads, and recent audit activity.
- `/workspace/documents` — **Document Vault:** Upload modal (scope, category, description, OKF toggle), search/filter/sort, download, custom confirmation deletion, and cross-company sharing manager.
- `/workspace/chat` — **Ask AI:** Streaming RAG chat, Local (Ollama) vs Online (Gemini) toggle, model readiness indicators, in-place Gemini key configuration, and source citations.
- `/workspace/shared` — **Shared With Me:** Dedicated list of files shared by external partner companies with view/download permissions.
- `/workspace/members` — **Member Management (Admin only):** Seat limit usage, member invitation with job title assignment, role permissions (`admin`, `employee`, `viewer`), and member deletion.
- `/workspace/audit` — **Audit Log (Admin only):** Complete 200-event activity trail with action filtering, actor filtering, text search, IP addresses, and timestamps.
- `/workspace/settings` — **AI Settings (Admin only):** Platform-wide LLM backend selection (Ollama, OpenAI, Anthropic, Gemini), model parameters (temperature, max tokens), and live ping test.

---

## API Endpoints Reference

All application endpoints are served under `/api/`:

### Authentication & Profiles
- `POST /api/auth/register` — Create a new company and its primary admin user.
- `POST /api/auth/login` — Sign in with work email and password.
- `GET /api/auth/me` — Retrieve the authenticated user profile and company data.

### Document Operations
- `GET /api/documents` — List all documents permitted for the authenticated member.
- `POST /api/documents/upload` — Upload, parse, chunk, embed, and index a document.
- `DELETE /api/documents/<id>` — Remove a document and delete its stored disk file.
- `GET /api/documents/<id>/download` — Download the document file (permission-gated).

### Cross-Company Collaboration
- `GET /api/companies/search?code=<code>` — Look up a registered company by 5-character access code.
- `GET /api/companies/<code>/members` — Retrieve selectable members for a partner company.
- `GET /api/documents/<id>/shares` — List all external users granted access to a document.
- `POST /api/documents/<id>/shares` — Share a document with a partner company user.
- `DELETE /api/documents/<id>/shares/<user_id>` — Revoke a user's access grant.
- `GET /api/shared-with-me` — List documents shared with the current user by other companies.

### RAG & AI Inference
- `POST /api/ask` — Stream an NDJSON RAG answer with document citations.
- `GET /api/llm-status` — Probe local and online model connectivity.

### Administration & Settings
- `GET /api/admin/users` — List members of the caller's company.
- `POST /api/admin/users` — Create a new member (respects seat limit).
- `DELETE /api/admin/users/<id>` — Remove a member from the company.
- `GET /api/admin/audit` — Retrieve up to 200 recent audit log entries.
- `GET /api/admin/llm-config` — View active platform LLM settings.
- `PUT /api/admin/llm-config` — Update platform LLM settings.
- `POST /api/admin/llm-test` — Ping the configured LLM with a test prompt.
- `GET /api/admin/companies` — (Superadmin only) List all registered companies.
- `POST /api/admin/switch-company` — (Superadmin only) Switch active tenant context.

---

## Data Models & Schema

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│             Company             │       │              User               │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ id (PK)                         │◄──┐   │ id (PK)                         │
│ name: CharField(200)            │   └───┤ company: FK(Company)            │
│ slug: SlugField(unique)         │       │ email: EmailField(unique)       │
│ access_code: CharField(5,unique)│       │ full_name: CharField(200)       │
│ website: CharField(200)         │       │ title: CharField(120)           │
│ contact_email: EmailField()     │       │ role: CharField(admin/emp/view) │
│ phone: CharField(40)            │       │ is_active / is_staff            │
│ max_employees: PositiveInt(null)│       └──────────────┬──────────────────┘
└────────────────┬────────────────┘                      │
                 │                                       │
                 ▼                                       │
┌─────────────────────────────────┐                      │
│            Document             │                      │
├─────────────────────────────────┤                      │
│ id (PK)                         │                      │
│ company: FK(Company)            │                      │
│ filename: CharField(300)        │                      │
│ stored_path: CharField(500)     │                      │
│ category: CharField(50)         │                      │
│ description: TextField()        │                      │
│ downloads: IntegerField()       │                      │
│ is_okf: BooleanField()          │                      │
│ access_scope: company/restricted│                      │
│ num_chunks: IntegerField()      │                      │
│ uploaded_by: FK(User)           │                      │
└───────┬─────────────────────────┘                      │
        │                                                │
        ├──────────────────────┬─────────────────────────┤
        ▼                      ▼                         ▼
┌───────────────┐      ┌───────────────┐         ┌───────────────┐
│     Chunk     │      │DocumentAccess │         │ DocumentShare │
├───────────────┤      ├───────────────┤         ├───────────────┤
│ document: FK  │      │ document: FK  │         │ document: FK  │
│ company: FK   │      │ user: FK ─────┼─────────┤ shared_with:FK│
│ ord: Integer  │      │ can_download  │         │ shared_by: FK │
│ text: Text    │      └───────────────┘         │ can_download  │
│ embedding: Bin│                                └───────────────┘
└───────────────┘
```

---

## Roles & Permission Hierarchy

| Role | Access Scope | Permissions |
|---|---|---|
| **`admin`** | Full Company Workspace | Upload/delete documents, manage team members, view audit trail, share/revoke cross-company access, configure AI settings. |
| **`employee`** | Standard Workspace | Upload documents, read allowed company files, share allowed documents, query the AI assistant, download permitted files. |
| **`viewer`** | Read-Only | Read permitted company files and download files where download permission is enabled. Cannot upload or delete. |
| **`Platform Helper / Superadmin`** | Global Platform | Inspect all tenants, switch active company context, test LLM providers. |

---

## AI & RAG Pipeline Setup

### 1. Local AI (Default: Ollama)
No data leaves the local machine or EC2 instance.
```bash
# Install Ollama (https://ollama.com)
ollama pull qwen2.5:1.5b       # Chat model
ollama pull nomic-embed-text   # Embedding model
```
In `backend/.env`:
```env
LLM_PROVIDER=ollama
LLM_URL=http://localhost:11434
LLM_MODEL=qwen2.5:1.5b
EMBED_PROVIDER=ollama
EMBED_MODEL=nomic-embed-text
```

### 2. Online AI (Google Gemini / OpenAI / Anthropic)
In `backend/.env` or via **Workspace → Settings**:
```env
# Gemini
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash
GEMINI_EMBED_MODEL=text-embedding-004

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-haiku-latest
```

---

## Local Development & Quick Start

### Prerequisites
- **Python 3.11+** (Python 3.12 recommended)
- **Node.js 20+**
- **pnpm** (or npm)

### 1. Backend Setup
```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env    # configure SECRET_KEY
python backend/manage.py migrate
python backend/manage.py seed_demo
```

### 2. Frontend Setup
```bash
cd frontend
pnpm install
cp .env.example .env.local
cd ..
```

### 3. Launching Both Servers
```bash
# Starts both servers and launches browser
./run.sh

# Or manage headlessly
./start-dev.sh
./start-dev.sh status
./start-dev.sh stop
```

Default access points:
- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Django API:** [http://localhost:8000](http://localhost:8000)
- **Django Admin:** [http://localhost:8000/admin/](http://localhost:8000/admin/)

### Demo data and admin access
The production deployment does not seed demo users. Create the intended admin through the secure management command or the registration flow. The local-only `seed_demo` command now requires `DEMO_SEED_PASSWORD` from an ignored environment file and refuses to run in production.

---

## What Is Remaining / Roadmap

While OpenVault has a fully working end-to-end prototype, the following architectural, functional, and security enhancements represent the recommended production roadmap (detailed in `improvement.md`):

### 🔴 High Priority: Security Hardening
- [ ] **HttpOnly Cookie Authentication:** Migrate JWT storage out of `localStorage` into `HttpOnly`, `SameSite=Strict` cookies to eliminate XSS token theft vectors.
- [ ] **Token Refresh & 401 Interceptors:** Implement refresh token rotation on the backend and automatic silent refresh / redirect on the frontend.
- [ ] **Per-Tenant LLM Scoping:** Scope `LLMConfig` per tenant so individual companies manage their own API keys rather than sharing a global singleton.
- [ ] **Credential Cleanup:** Remove hardcoded credentials from demo scripts (`add_admin.py`, `backend/create_admin.py`, `hash.py`).
- [ ] **Rate Limiting:** Add throttling to `POST /api/auth/login`, `POST /api/documents/upload`, `POST /api/ask`, and `company_members` lookup to prevent enumeration.

### 🟠 Medium Priority: Scalability & Backend Architecture
- [ ] **PostgreSQL + pgvector:** Replace SQLite and in-memory `numpy` cosine loops with PostgreSQL and `pgvector` for scalable, sub-millisecond vector indexing.
- [ ] **Asynchronous Document Ingestion:** Offload PDF/DOCX parsing and vector embedding to background workers using **Celery** + Redis.
- [ ] **Cloud Object Storage:** Integrate `django-storages` with AWS S3 / MinIO instead of saving files to the local container disk.
- [ ] **Atomic Transactions:** Wrap multi-step operations (`upload_document`, `register_company`) in `@transaction.atomic`.
- [ ] **RESTful Document Detail Endpoints:** Add `GET` and `PATCH` methods to `/api/documents/<id>` for updating categories, descriptions, or access scopes.

### 🟡 Medium Priority: User Experience & Feature Additions
- [ ] **In-Browser Document Preview:** Add native preview for Markdown (`react-markdown`), PDF (`<iframe>` or `react-pdf`), and plain text without forcing file downloads.
- [ ] **Persistent Chat History:** Store conversation sessions (`ChatSession`, `ChatMessage`) with a history sidebar and transcript export.
- [ ] **Multi-Turn Context:** Enable conversational memory across multiple turns in the RAG prompt assembly.
- [ ] **Document Versioning:** Support uploading new versions of existing documents while preserving shares and IDs.
- [ ] **Audit Trail Pagination & Export:** Add cursor-based pagination and CSV/PDF export for compliance auditors.
- [ ] **Member Role Updates:** Allow admins to edit existing member roles inline without deleting and re-inviting them.

### 🟢 Low Priority: DevOps & Quality Assurance
- [ ] **Containerization:** Provide production-ready `Dockerfile` and `docker-compose.yml` for unified backend, frontend, database, and Redis orchestration.
- [ ] **Automated Test Suite:** Add backend tests (`pytest-django`) and frontend component/E2E tests (`vitest`, Playwright).
- [ ] **CI/CD Pipeline:** Implement GitHub Actions for automated linting, typechecking, and deployment.
- [ ] **Health Check Endpoint:** Add `GET /api/health` probe for load balancers.

---

## Project Team & Attribution

**OpenVault — Final Year Project (FYP)**  
*University of South Asia*

- **Saad Waseem**
- **M Akmal**
- **M Talha**

*Project Presentation: `OpenVault.pptx`*
