# OpenVault — Comprehensive Improvement Report

> Full audit of every source file in `frontend/` (26 files) and `backend/` (21 files), plus configuration and deployment manifests. This report identifies **visual**, **functional**, **security**, **architectural**, and **enterprise/university readiness** improvements.

---

## Table of Contents

1. [Critical Security Issues](#1-critical-security-issues)
2. [Visual & UI/UX Improvements](#2-visual--uiux-improvements)
3. [Frontend Code Quality & Architecture](#3-frontend-code-quality--architecture)
4. [Backend Code Quality & Architecture](#4-backend-code-quality--architecture)
5. [Functional Gaps — Features to Add](#5-functional-gaps--features-to-add)
6. [Enterprise Readiness](#6-enterprise-readiness)
7. [University / Educational Institution Readiness](#7-university--educational-institution-readiness)
8. [Database & Scalability](#8-database--scalability)
9. [RAG Pipeline Improvements](#9-rag-pipeline-improvements)
10. [DevOps & Deployment](#10-devops--deployment)
11. [Documentation & Cleanup](#11-documentation--cleanup)
12. [Summary Scorecard](#12-summary-scorecard)

---

## 1. Critical Security Issues

These must be fixed **before any production or institutional deployment**.

### 1.1 JWT Stored in `localStorage` — XSS Vulnerable

**File:** `frontend/lib/api.ts`

The token is stored as `localStorage.getItem('securekb_token')`. Any XSS vulnerability (a malicious script injected via a document title, chat message, or third-party dependency) can silently steal every user's session token.

**Fix:** Move JWT storage to `HttpOnly`, `Secure`, `SameSite=Strict` cookies set by the Django backend. The frontend should never touch the raw token; the browser sends the cookie automatically.

### 1.2 Global LLM Config is a Cross-Tenant Privilege Escalation

**File:** `backend/core/views.py` → `llm_config` view

`LLMConfig` is a singleton row (`pk=1`) shared by **all tenants**, but it's writable by any company admin (`IsAdmin` permission). A rogue tenant admin can:

- Change `base_url` to an attacker-controlled server, intercepting every company's RAG prompts (which contain private document text).
- Overwrite the API key, causing a denial-of-service for all tenants.

**Fix:** Either scope LLM config per-company, or restrict this view to a platform-level superadmin role that is separate from tenant admins.

### 1.3 Credential handling

Production passwords and provider keys must not be embedded in source, demo seed data, or documentation. Admin creation prompts securely or generates a random password. The local-only demo seed command requires an environment secret and refuses to run in production.

### 1.4 Insecure Production Defaults

**File:** `backend/config/settings.py`

```python
SECRET_KEY = os.environ["SECRET_KEY"]
ALLOWED_HOSTS = ["*"]                           # accepts requests from any hostname
CORS_ALLOW_ALL_ORIGINS = True                   # any origin can call the API
DEBUG = True                                    # by default
```

**Fix:** Require `SECRET_KEY` from environment (crash if missing). Default `DEBUG` to `False`. Whitelist specific hosts and CORS origins.

### 1.5 No File Upload Size Limits

**File:** `backend/core/views.py` → `upload_document`

`f.read()` loads the entire uploaded file into memory synchronously. A 500 MB file will cause an out-of-memory crash. There is no `FILE_UPLOAD_MAX_MEMORY_SIZE` or `DATA_UPLOAD_MAX_MEMORY_SIZE` configured.

**Fix:** Add `DATA_UPLOAD_MAX_MEMORY_SIZE` in settings (e.g. 50 MB). Use `UploadedFile.chunks()` for streaming writes. Reject files exceeding the limit with a clear error.

### 1.6 API Key Stored in Plaintext

**File:** `backend/core/models.py` → `LLMConfig.api_key`

Third-party API keys (OpenAI, Anthropic, Gemini) are stored as plaintext in the SQLite database.

**Fix:** Encrypt at rest using `django-fernet-fields` or similar. Better yet, read keys from environment variables / a secrets manager and never persist them in the DB.

### 1.7 Cross-Tenant Member Directory Leakage

**File:** `backend/core/views.py` → `company_members`

Any authenticated user who knows (or brute-forces) a 5-character `access_code` can retrieve **every employee's name, email, job title, and role** in that company. The code space is only 36⁵ ≈ 60 million — feasible to enumerate.

**Fix:** Rate-limit this endpoint. Require mutual opt-in (both companies must approve a sharing relationship before the member list is visible). Increase the code length.

### 1.8 No Token Refresh or 401 Interceptor

**Files:** `frontend/lib/api.ts`, `frontend/lib/auth.tsx`

- Only an access token is issued; there is no refresh token rotation.
- When the token expires, API calls silently fail — the user stays on the page in a broken state.
- No 401 interceptor to auto-redirect to `/enterprise`.

**Fix:** Implement refresh token rotation on the backend. Add a response interceptor in `api.ts` that catches 401 and triggers `logout()` or a silent refresh.

---

## 2. Visual & UI/UX Improvements

### 2.1 Color Contrast Fails WCAG AA

The muted text colors used throughout the workspace fail accessibility contrast requirements:

| Color | Background | Contrast Ratio | Required |
|-------|-----------|----------------|----------|
| `#98958c` | `#fffdfa` | ~3.0:1 | 4.5:1 (AA normal text) |
| `#8c8a83` | `#f7f6f2` | ~2.9:1 | 4.5:1 |
| `#a8a59d` | `#fffdfa` | ~2.7:1 | 4.5:1 |
| `#77746c` | `#fffdfa` | ~3.6:1 | 4.5:1 |

**Fix:** Darken muted text to at least `#6b6862` (or similar) to achieve 4.5:1 contrast while preserving the warm editorial tone.

### 2.2 No In-Browser Document Preview

Users must **download** every file to read it. This is a major friction point — especially for policies, handbooks, and quick-reference documents that people need to glance at, not save.

**Add:**
- Embedded Markdown renderer for `.md` files (use `react-markdown`).
- PDF viewer for `.pdf` files (use `react-pdf` or `<iframe>` with `blob:` URLs).
- Plain text viewer with syntax highlighting for `.txt`, `.csv`.
- For `.docx` and `.pptx`, show extracted text in a read-only panel (backend already extracts text).

### 2.3 No Dark Mode Toggle

**File:** `frontend/app/globals.css`

The CSS defines both light and dark OKLCH theme variables, but there is no user-facing toggle. The dark theme only activates via `@media (prefers-color-scheme: dark)` which many users don't set.

**Fix:** Add a light/dark/system toggle in the workspace header or settings. Store preference in `localStorage`. Apply `data-theme` attribute on `<html>`.

### 2.4 Chat Has No Conversation History

**File:** `frontend/app/workspace/chat/page.tsx`

Refreshing the page erases all messages. There is no persistence, threading, or ability to revisit past conversations.

**Fix:**
- Store conversations server-side (new `ChatSession` and `ChatMessage` models).
- Add a sidebar listing past conversations.
- Allow naming, searching, exporting (PDF/Markdown), and deleting conversations.

### 2.5 Modal Accessibility Issues

**File:** `frontend/app/workspace/documents/page.tsx` → `ShareDialog`

The share dialog is a custom overlay (`fixed inset-0 z-50`) that:
- Has no focus trap — Tab key moves focus to elements behind the modal.
- Does not capture initial focus to the first interactive element.
- Does not return focus to the trigger button on close.
- Listens to `keydown` manually instead of using an accessible dialog primitive.

**Fix:** Use `@base-ui/react`'s `Dialog` (already installed but unused) or Radix/Headless UI `Dialog`. These handle focus management, `aria-modal`, and Escape key automatically.

### 2.6 `window.confirm()` for Destructive Actions

**File:** `frontend/app/workspace/documents/page.tsx` (line ~107)

Document deletion uses `window.confirm()`, which is a native browser dialog that:
- Blocks the main thread.
- Cannot be styled to match the app's design.
- Looks jarring and unprofessional.

**Fix:** Replace with a custom confirmation modal matching the app's visual language (warm tones, soft borders, clear "Cancel" / "Delete" actions).

### 2.7 No Loading Skeletons

All workspace pages show either nothing or a simple spinner while data loads. This causes layout shifts and feels slow.

**Fix:** Add shimmer/skeleton placeholders that match the final layout (skeleton cards for documents, skeleton rows for tables, skeleton stat cards for the dashboard).

### 2.8 No Empty States with Guidance

When a new company has no documents, no members, or no audit entries, the pages show a blank area or a terse "No documents found" message.

**Fix:** Add illustrated empty states with actionable guidance:
- Documents: "Upload your first document to get started" with an upload button.
- Members: "Invite your team to collaborate" with a link to the invite form.
- Chat: Already has a good empty state — extend this pattern to other pages.

### 2.9 Mobile Table Usability

The audit and members pages use responsive table-to-card transformations, which is good. However:
- Touch targets for "Remove" buttons are too small on mobile (< 44px).
- The horizontal scroll tab strip in the workspace sidebar has no visual scroll indicator.

**Fix:** Increase touch targets to at least 44×44px. Add fade indicators on the edges of the horizontal scroll strip to hint at more tabs.

### 2.10 No Toast / Notification System

Success and error feedback is either an `alert()`, a state string at the top of a form, or nothing at all. There is no consistent notification pattern.

**Fix:** Add a toast notification system (e.g., `sonner` or `react-hot-toast`) for:
- "Document uploaded successfully"
- "Member invited"
- "Share granted"
- "Settings saved"
- Error messages from API failures

---

## 3. Frontend Code Quality & Architecture

### 3.1 Monolithic Page Files — Extract Components

Components like `UploadPanel`, `ShareDialog`, `StatCard`, `RecentUploads`, `RecentActivity`, `Bubble`, `Composer`, `ChatHeader`, and `EmptyState` are all defined inline inside their respective page files.

**Refactor to:**
```
components/
├── ui/           # Primitives (Button, Input, Dialog, Badge, Card, Table)
├── workspace/    # Workspace-specific composites
│   ├── StatCard.tsx
│   ├── UploadPanel.tsx
│   ├── ShareDialog.tsx
│   ├── ChatBubble.tsx
│   ├── ChatComposer.tsx
│   └── ConfirmDialog.tsx
└── ...
```

### 3.2 Shadcn / Base UI Installed But Unused

`@base-ui/react` and `shadcn` are in `package.json` and `components.json`, but zero primitives are actually imported. Instead, buttons and inputs are styled with repeated utility constants (`inputClass`, `focusRing`, `primaryBtn`, `ghostBtn`, `dangerBtn`) duplicated across 5+ files.

**Fix:** Generate Shadcn primitives (`npx shadcn add button input dialog select table badge`) and use them consistently. This eliminates ~200 lines of duplicated styling constants.

### 3.3 Utility Function Duplication

| Function | Defined In | Also Re-implemented In |
|----------|-----------|----------------------|
| `titleFromName` | `lib/utils.ts` | `documents/page.tsx` as `displayTitle`, `shared/page.tsx` as `displayTitle` |
| `formatDate` | `lib/utils.ts` | `documents/page.tsx` (local), `audit/page.tsx` as `formatWhen` + `formatDay` |

**Fix:** Consolidate into `lib/utils.ts` and import everywhere.

### 3.4 No Data Fetching / Cache Layer

Every workspace page independently manages `[data, setData] + [loading, setLoading] + [error, setError]` and re-fetches on every mount. Switching tabs triggers full network round-trips with no caching.

**Fix:** Adopt **TanStack Query** (React Query) or **SWR**:
- Automatic caching, deduplication, and background refresh.
- Stale-while-revalidate for instant tab switching.
- Centralized error handling.
- Optimistic updates for mutations (upload, share, delete).

### 3.5 Type Safety Gaps

- `ChatHeader` types `user` as `any` (`chat/page.tsx`, line 132).
- Settings page casts `e.target.value as any`.
- Dynamic `import()` inside a component event handler (`chat/page.tsx`, lines 158–162) instead of a top-level import.

**Fix:** Use the existing `User` type from `api.ts`. Remove all `any` casts. Import `settingsApi` at module level.

### 3.6 Legacy Storage Key

**File:** `frontend/lib/api.ts`

```typescript
const TOKEN_KEY = 'securekb_token'  // leftover from a previous project name
```

**Fix:** Rename to `openvault_token`. Add a migration snippet that reads the old key and writes it to the new key on first load.

---

## 4. Backend Code Quality & Architecture

### 4.1 No Database Transactions

**File:** `backend/core/views.py`

`upload_document` writes a file to disk, creates a `Document` row, creates a `DocumentAccess` row, and indexes chunks — all without `transaction.atomic()`. If indexing fails, the database and filesystem are left in an inconsistent state.

Similarly, `register_company` creates a `Company` and a `User` without a transaction.

**Fix:** Wrap multi-step mutations in `@transaction.atomic` or `with transaction.atomic():`.

### 4.2 Synchronous File Processing in Request Cycle

Text extraction, chunking, and embedding all run synchronously inside the HTTP upload request. A 50-page PDF can take 10–30 seconds, exceeding typical proxy timeouts.

**Fix:** Return 202 Accepted immediately, enqueue the processing job in **Celery** (with Redis or SQS as broker), and let the frontend poll a `/api/documents/<id>/status` endpoint or receive a WebSocket notification.

### 4.3 In-Memory Vector Search Won't Scale

**File:** `backend/core/rag.py` → `retrieve()`

```python
pool = list(Chunk.objects.filter(document_id__in=ids).select_related("document"))
```

This loads **every chunk** the user can see into Python memory, then runs a linear `numpy.dot` loop. With 10,000+ chunks, this will bottleneck CPU and RAM on every question.

**Fix:** Migrate to PostgreSQL + `pgvector` extension (or a dedicated vector database like Qdrant/Weaviate/Pinecone). Use approximate nearest neighbor (ANN) indexing for sub-millisecond retrieval.

### 4.4 Serial Embedding Requests (Ollama)

**File:** `backend/core/providers.py` → `OllamaProvider.embed()`

Each chunk is embedded with an individual HTTP POST in a `for` loop. For a 20-chunk document, that's 20 sequential HTTP requests.

**Fix:** Use Ollama's batch embedding endpoint or send chunks in parallel with `concurrent.futures.ThreadPoolExecutor`.

### 4.5 README Documents Non-Existent API Routes

**File:** `README.md`

The README advertises these routes that **do not exist** in `core/urls.py`:

- `POST /api/public/register`
- `POST /api/public/login`
- `GET /api/public/companies`
- `GET /api/public/categories`
- `GET /api/public/documents`
- `GET /api/favorites`
- `GET|PATCH /api/documents/<id>` (only `DELETE` is implemented)

**Fix:** Either implement these endpoints or remove them from the README. The README should match the actual codebase.

### 4.6 Missing `document_detail` GET/PATCH

`document_detail` only implements `DELETE`. There is no way to:
- Retrieve a single document's metadata by ID.
- Update a document's category, description, or access scope after upload.

**Fix:** Add `GET` and `PATCH` handlers to `document_detail`.

### 4.7 Redundant ACL Tables

`DocumentAccess` and `DocumentShare` both store `can_download` and user–document associations. When sharing, both tables are written simultaneously in `document_shares`. This creates potential state drift.

**Fix:** Consider merging into a single `DocumentGrant` model with an `is_external` or `grant_type` field, or make `DocumentShare` delegate to `DocumentAccess` as the single source of truth.

### 4.8 Audit Log Capped at 200 with No Pagination

**File:** `backend/core/views.py` → `audit_log`

```python
qs = AuditLog.objects.filter(company=request.user.company).order_by("-created_at")[:200]
```

For compliance purposes, enterprises and universities need access to the **complete** audit history.

**Fix:** Implement cursor-based or offset pagination using DRF's `PageNumberPagination`. Support date-range filtering.

---

## 5. Functional Gaps — Features to Add

### 5.1 Folder / Tag Organization

Documents are currently flat with a single `category` dropdown. There is no hierarchy.

**Add:**
- Folder tree (nested categories or a `parent_id` FK).
- Multiple tags per document (many-to-many `Tag` model).
- Drag-and-drop folder organization.

### 5.2 Document Version Control

There is no way to update a document. Uploading a new version creates a separate entry.

**Add:**
- `DocumentVersion` model linked to `Document`.
- Version history with diff view.
- "Upload new version" action that preserves the document ID, shares, and access grants.

### 5.3 Batch Operations

Users cannot perform bulk actions.

**Add:**
- Multi-select checkboxes on the documents table.
- Bulk download (zip), bulk delete, bulk share, bulk category assignment.
- Bulk upload (drag-and-drop multiple files at once).

### 5.4 Search Across Documents

There is no full-text search on the documents page. Only client-side filtering by filename.

**Add:**
- Server-side full-text search endpoint (`GET /api/documents?q=...`).
- Search within document content (not just filename).
- Highlight matching terms in results.

### 5.5 Notifications System

There is no notification mechanism.

**Add:**
- In-app notification bell with unread count.
- "Document shared with you" notifications.
- "New member joined" notifications (for admins).
- Optional email notifications (using Django's email backend).

### 5.6 User Profile Editing

Users cannot update their own name, title, or password after account creation.

**Add:**
- `PUT /api/auth/me` endpoint for self-profile updates.
- Password change form.
- Profile page in the workspace.

### 5.7 Role Editing for Members

**File:** `frontend/app/workspace/members/page.tsx` — explicitly notes:

> *"Roles are set when a member is created and can't be edited here... To move someone to a different role, remove them and add them again."*

**Fix:** Add a `PATCH /api/admin/users/<pk>` endpoint and an inline role dropdown in the members table.

### 5.8 Time-Limited Access Grants

Shares are permanent until manually revoked. There is no concept of expiring access.

**Add:**
- `expires_at` field on `DocumentShare` and `DocumentAccess`.
- Auto-revocation via a scheduled task or queryset filter.
- UI: date picker when sharing ("Access expires on...").

### 5.9 Chat Feedback Loop (Thumbs Up/Down)

There is no way for users to rate AI answers. This makes it impossible to improve the RAG pipeline.

**Add:**
- Thumbs up / thumbs down buttons on each assistant message.
- Store feedback in a `ChatFeedback` model.
- Admin dashboard showing feedback statistics.

### 5.10 Audit Log Export

The audit log cannot be exported.

**Add:**
- "Export as CSV" and "Export as PDF" buttons.
- Date range selection for the export.
- This is critical for external auditors and CPA reviews.

---

## 6. Enterprise Readiness

### 6.1 Single Sign-On (SSO)

No SSO integration exists. Enterprises require:

- **SAML 2.0** for Okta, OneLogin, PingIdentity.
- **OpenID Connect (OIDC)** for Azure AD (Microsoft Entra ID), Google Workspace, Auth0.
- **SCIM 2.0** for automated user provisioning/deprovisioning.

**Libraries:** `django-allauth` with social providers, or `python-social-auth`, or `djangosaml2`.

### 6.2 Multi-Factor Authentication (MFA / 2FA)

No MFA exists. Every enterprise security policy requires it.

**Add:** TOTP (Google Authenticator), WebAuthn (hardware keys), or SMS OTP using `django-otp` or `django-mfa2`.

### 6.3 Role Granularity

Only 3 roles exist: `admin`, `employee`, `viewer`. Enterprises need:

- **Super Admin** (platform operator, manages all tenants)
- **Tenant Admin** (manages one company)
- **Department Manager** (manages a sub-group)
- **Employee** (full access within their scope)
- **Viewer** (read-only)
- **External Auditor** (read-only access to audit logs and specific documents)
- **Custom Roles** with granular permissions (RBAC matrix)

### 6.4 Department / Team Structure

The company model is flat — no departments, teams, or organizational units.

**Add:**
- `Department` model with parent FK (supports hierarchy).
- Assign users to departments.
- Department-scoped document visibility (e.g., "HR documents visible only to HR department").
- Department-level sharing (share with all members of a department).

### 6.5 Branding & White-Labeling

Enterprises want their own logo, colors, and domain.

**Add:**
- `Company.logo`, `Company.primary_color`, `Company.accent_color` fields.
- Custom subdomain support (`acme.openvault.com`).
- White-label mode that removes OpenVault branding.

### 6.6 Data Retention Policies

No configurable retention exists. Enterprises may be required to delete data after N years.

**Add:**
- `Company.retention_days` field.
- Automated deletion of documents and audit logs past retention.
- "Legal hold" flag to exempt specific documents from deletion.

### 6.7 API Rate Limiting

No rate limiting on any endpoint. A single user or bot can overwhelm the system.

**Add:** `django-ratelimit` or `DRF throttling` on auth, upload, ask, and directory endpoints.

---

## 7. University / Educational Institution Readiness

### 7.1 Academic Organizational Hierarchy

Universities need:

```
University
├── Campus (Main, Satellite)
│   ├── Faculty / College (Engineering, Medicine, Arts)
│   │   ├── Department (Computer Science, Electrical, Civil)
│   │   │   ├── Program (BS CS, MS CS, PhD)
│   │   │   ├── Course (CS101, CS201)
│   │   │   │   └── Section (Fall 2026 - Section A)
│   │   │   └── Research Lab / Group
```

### 7.2 Academic Roles

| Role | Permissions |
|------|------------|
| Chancellor / Vice Chancellor | Full read access, analytics |
| Dean | Faculty-wide document management |
| Department Chair | Department-level admin |
| Professor / Instructor | Upload course materials, manage course documents |
| Teaching Assistant | Upload within assigned courses |
| Student | View/download course documents, ask questions |
| Researcher / PhD Scholar | Access to research group documents |
| Librarian | Manage institution-wide knowledge base |
| External Examiner / Auditor | Temporary read access to specific documents |

### 7.3 Course-Based Document Distribution

- Upload a syllabus → automatically visible to all enrolled students.
- Semester-based access expiry (documents become inaccessible after the semester ends).
- Assignment submission integration (students upload, only the instructor can read).

### 7.4 Academic Calendar Integration

- Semester start/end dates that trigger automatic access changes.
- Exam period document locks.
- Timetable-aware notifications.

### 7.5 EDU Identity Provider Support

- **Shibboleth / InCommon** — the standard SSO for `.edu` institutions.
- **EduGAIN** — inter-federation identity for international universities.
- **Google Workspace for Education** (OIDC).
- **Microsoft 365 Education** (Azure AD with `.edu` tenant).

### 7.6 Research Collaboration Features

- Multi-institution research group sharing.
- Data Management Plans (DMP) templates.
- Embargo periods for pre-publication documents.
- DOI minting integration for published research.

---

## 8. Database & Scalability

### 8.1 Migrate from SQLite to PostgreSQL

SQLite is a development convenience. For production:

- No concurrent write support (write lock blocks all readers in WAL mode).
- No row-level locking.
- Limited full-text search.
- Cannot store vector indexes.

**Migration path:**
1. Add `psycopg2-binary` to requirements.
2. Update `DATABASES` setting to read from `DATABASE_URL` env var.
3. Run `python manage.py migrate` against PostgreSQL.
4. Use `dumpdata`/`loaddata` or `pg_dump` for data migration.

### 8.2 Vector Database for Embeddings

Replace in-memory cosine similarity with:

| Option | Pros | Cons |
|--------|------|------|
| PostgreSQL + `pgvector` | Single database, easy ops, HNSW index | Requires PostgreSQL 15+ |
| Qdrant | Purpose-built, fast, filtering | Separate service to manage |
| Weaviate | GraphQL API, hybrid search | Heavier deployment |
| Pinecone | Managed, zero ops | Vendor lock-in, cost |

**Recommendation:** Start with `pgvector` (stays in PostgreSQL), then evaluate dedicated vector DBs at >100K chunks.

### 8.3 Object Storage for Documents

Files are stored on the local filesystem under `settings.DATA_DIR`. This doesn't work with:
- Multiple backend instances (no shared filesystem).
- Container deployments (ephemeral storage).
- Backup and disaster recovery.

**Fix:** Use `django-storages` with S3 (or MinIO for self-hosted). Store only the S3 key in `Document.stored_path`.

### 8.4 Connection Pooling

Django's default SQLite/PostgreSQL connection handling doesn't pool. Under load, every request opens a new connection.

**Fix:** Use `django-db-connection-pool` or `pgBouncer` for PostgreSQL.

---

## 9. RAG Pipeline Improvements

### 9.1 Multi-Turn Conversation Memory

The RAG pipeline is stateless — each question is independent. The model has no memory of the previous exchange.

**Fix:**
- Pass the last N turns as context in the prompt.
- Store conversation history server-side.
- Implement a sliding window of conversation context.

### 9.2 Hybrid Retrieval (BM25 + Dense Vectors)

The current pipeline uses either cosine similarity OR keyword search, never both.

**Fix:** Implement hybrid retrieval with **Reciprocal Rank Fusion (RRF)**:
1. Run BM25 keyword search (PostgreSQL `ts_vector` or Elasticsearch).
2. Run dense vector search (pgvector / Qdrant).
3. Merge results using RRF: `score = Σ 1/(k + rank_i)`.

### 9.3 Reranking

After retrieval, the top-K chunks may not be the most relevant.

**Fix:** Add a reranking step using:
- Cohere Rerank API
- BGE Reranker (open-source)
- Cross-encoder models from Sentence Transformers

### 9.4 OCR for Scanned Documents

Scanned PDFs and image-based slides produce empty text from `pypdf`.

**Fix:** Integrate Tesseract OCR (via `pytesseract`) or a cloud OCR service (AWS Textract, Google Document AI) as a fallback when `extract_text` returns empty/short strings.

### 9.5 Better Chunking Strategies

The current chunking splits on double-newlines with fixed 900-char windows. This can split mid-sentence or mid-paragraph.

**Fix:**
- Use semantic chunking (split at topic boundaries using embedding similarity).
- Respect document structure (headings, sections, bullet lists).
- Try recursive character text splitters (LangChain-style) with smarter boundary detection.

### 9.6 Citation Precision

Currently, sources show only the document filename. Users need to know **where** in the document the answer came from.

**Fix:**
- Include page numbers for PDFs.
- Include section headings for Markdown.
- Highlight the specific passage used in the answer.
- Link to the in-browser document preview at the relevant position.

### 9.7 Streaming Error Recovery

If the LLM stream fails mid-response, the frontend shows a partial answer with no indication of failure.

**Fix:** Send an explicit `{"type": "error"}` event if the stream is interrupted. Show a "Response was cut short — try again" indicator in the UI.

---

## 10. DevOps & Deployment

### 10.1 No Docker Configuration

There is no `Dockerfile` or `docker-compose.yml`.

**Add:**
```
docker-compose.yml          # Backend + Frontend + PostgreSQL + Redis
backend/Dockerfile          # Python + Gunicorn
frontend/Dockerfile         # Node.js + Next.js standalone
```

### 10.2 No CI/CD Pipeline

No GitHub Actions, GitLab CI, or other CI/CD configuration.

**Add:**
- Lint (ESLint + Ruff/Flake8)
- Type check (TypeScript `tsc --noEmit` + mypy)
- Unit tests (pytest + Jest/Vitest)
- Integration tests
- Automated deployment on merge to `main`

### 10.3 No Test Suite

There are zero test files in the entire project. No backend tests, no frontend tests.

**Add:**
- Backend: `pytest` + `pytest-django` for model, view, and RAG pipeline tests.
- Frontend: `vitest` + `@testing-library/react` for component and integration tests.
- E2E: Playwright for critical user flows (register → upload → ask → share).

### 10.4 No Health Check Endpoint

**Add:** `GET /api/health` returning `{"status": "ok", "db": true, "llm": true/false}` for load balancer and monitoring probes.

### 10.5 No Structured Logging

Django uses basic `print`-style output. No structured logging, no request IDs, no log levels.

**Fix:** Configure `django.utils.log` with JSON structured logging. Add correlation IDs for request tracing.

### 10.6 No Monitoring / Metrics

**Add:** Prometheus metrics via `django-prometheus` (request latency, error rates, RAG query times, document count per tenant).

---

## 11. Documentation & Cleanup

### 11.1 Remove `testing-123` Route

**File:** `frontend/app/testing-123/page.tsx` (693 lines)

This is a comprehensive internal documentation/verification page deployed under public app routes. It exposes:
- Internal data models and architecture details.
- Stack technology choices.
- ACL implementation details.
- Deployment procedures.

**Fix:** Remove from production. If needed for development, gate it behind an environment variable or move to a private admin route.

### 11.2 Update README to Match Reality

The README documents features that don't exist (public portal, favorites, consumer accounts, `GET/PATCH` on documents). Update it to accurately reflect the current codebase.

### 11.3 Add API Documentation

No API documentation exists beyond the README table.

**Add:** OpenAPI/Swagger spec using `drf-spectacular` or `drf-yasg`. Serve interactive docs at `/api/docs/`.

### 11.4 Add Contributing Guide

No `CONTRIBUTING.md`, no code style guide, no branch naming convention.

**Add:** Standard contributing guide with:
- Development setup instructions.
- Code style (Black + isort for Python, Prettier for TypeScript).
- PR template.
- Commit message convention.

---

## 12. Summary Scorecard

| Category | Current | Target | Priority |
|----------|---------|--------|----------|
| **Security** | D+ | A | 🔴 Critical |
| **Visual Design** | A- | A+ | 🟡 Medium |
| **Accessibility (a11y)** | C | A | 🟠 High |
| **Component Architecture** | C+ | A | 🟡 Medium |
| **State Management** | C | A- | 🟡 Medium |
| **TypeScript Coverage** | B+ | A | 🟢 Low |
| **Backend Architecture** | B | A | 🟡 Medium |
| **Database & Scale** | D (SQLite) | A (PostgreSQL + pgvector) | 🟠 High |
| **RAG Quality** | B- | A | 🟡 Medium |
| **Enterprise Readiness** | C | A | 🟠 High |
| **University Readiness** | D | A | 🟠 High |
| **Testing** | F (0 tests) | A (80%+ coverage) | 🔴 Critical |
| **DevOps** | D | A | 🟠 High |
| **Documentation** | C+ | A | 🟡 Medium |

---

### Recommended Implementation Order

1. **Phase 1 — Security Hardening** (Week 1–2)
   - Move JWT to HttpOnly cookies
   - Fix LLM config privilege escalation
   - Remove hardcoded credentials
   - Add file upload limits
   - Add rate limiting

2. **Phase 2 — Database & Infrastructure** (Week 2–4)
   - Migrate to PostgreSQL + pgvector
   - Add Docker configuration
   - Set up CI/CD pipeline
   - Add basic test suite

3. **Phase 3 — Core Feature Gaps** (Week 4–8)
   - Document preview
   - Chat history persistence
   - Server-side search
   - Folder/tag organization
   - Role editing
   - Audit log pagination & export

4. **Phase 4 — Enterprise Features** (Week 8–12)
   - SSO (SAML/OIDC)
   - MFA
   - Department hierarchy
   - Advanced RBAC
   - Branding/white-label

5. **Phase 5 — University Features** (Week 12–16)
   - Academic hierarchy (Faculty → Department → Course)
   - Academic roles
   - Semester-based access
   - EDU identity providers

6. **Phase 6 — RAG Excellence** (Week 16–20)
   - Hybrid retrieval
   - Reranking
   - Multi-turn conversations
   - OCR
   - Citation precision
   - Feedback loop

---

*Report generated from a complete audit of the OpenVault codebase — every `.py`, `.tsx`, `.ts`, `.css`, `.json`, `.yml`, and `.md` file was read and analyzed.*
