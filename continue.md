# OpenVault — Continue From Here

> Status snapshot after the "go-live" build (Phase 1 + Phase 2 backend + start of frontend).
> Written so any session can pick up exactly where this left off.

---

## What is DONE (backend — complete and smoke-tested)

### Security / Phase 1
- **HttpOnly cookie sessions** (`backend/core/auth.py`): JWT access+refresh in HttpOnly, SameSite=Lax cookies; `Authorization` header still accepted. `ROTATE_REFRESH_TOKENS` on. `POST /api/auth/refresh`, `POST /api/auth/logout` added.
- **Email verification** (`OneTimeToken` model, hashed tokens): `POST /api/auth/request-verification`, `POST /api/auth/verify`. Optional login gate via `REQUIRE_EMAIL_VERIFICATION` env (off locally).
- **Password reset**: `POST /api/auth/forgot-password` (never reveals account existence) + `POST /api/auth/reset-password` (30-min token; also marks email verified). Frontend routes: `/auth/forgot`, `/auth/reset`, `/auth/verify` (pages created).
- **Rate limiting** (`backend/core/ratelimit.py`, cache-based sliding window): login 8/min per IP+email, register/forgot 5/10min per IP, company code lookup + member directory 20/min, verify/reset endpoints limited.
- **Hardcoded stuff removed**: `gfoot4@gmail.com` backdoor gone from views/permissions/rag; deleted `add_admin.py`, `hash.py`, `backend/create_admin.py` (contained `bawagusa123`).
- **Root admin, not hardcoded**: `User.is_platform_admin` DB flag + `python manage.py create_platform_admin <email> [--password ...] [--promote]` with complete cross-tenant authority (all companies switcher + detach, platform LLM default, plan assignment). Permission classes in `core/permissions.py`.
- `SECRET_KEY` required at boot; `DEBUG` defaults false; `ALLOWED_HOSTS` no longer includes `*`; CORS is an explicit origin list with `CORS_ALLOW_CREDENTIALS`.

### Plans / billing (PKR)
- `Plan` model + `python manage.py seed_plans` (idempotent, auto-seeded already in dev DB):
  - **Free** — PKR 0/mo: 5 members, 50 docs, 512 MB, 100 asks/mo
  - **Starter** — PKR 2,500/mo: 15 members, 500 docs, 5 GB, 2,000 asks/mo, versioning
  - **SME** — PKR 6,000/mo: 50 members, 5,000 docs, 25 GB, 10,000 asks/mo, departments + BYO LLM key
  - **Enterprise** — custom quote: unlimited, everything on
- Server-side enforcement: seats on member create, doc count + storage on upload, monthly asks on `/api/ask` (HTTP 402 with upgrade message), plan gates for departments/versions/custom LLM.
- `GET /api/plans` (public catalogue), `POST /api/admin/companies/<id>/plan` (platform admin changes a tenant plan — actual payment gateway is deferred).
- New companies auto-attach the Free plan (`Plan.default()` auto-provisions it even without seeding).

### Company self-service
- `GET/PATCH /api/admin/company` — name, website, contact, phone, seat cap (fixes "increase it in company settings" dead end).
- `PATCH /api/auth/update-me` — own profile, password change (requires current password), **language preference**.

### Per-tenant AI (BYO key)
- `LLMConfig` now has a nullable `company` FK: platform default row + optional company override. Resolution: company → platform → `.env`.
- `GET/PUT/DELETE /api/admin/llm-config` — company admins edit their own override (plan-gated `allow_custom_llm`); platform admins edit the platform default. `llm-test`/`llm-status` are company-aware.

### Phase 2 features (backend)
- **Chat history**: `ChatConversation`/`ChatMessage`; `/api/ask` takes `conversation_id` (creates thread otherwise), sends last 6 turns to the model, persists both sides, streams `{"type":"conversation"}` then `{"type":"saved","message_id":N}`. `GET/POST /api/conversations`, `GET/PATCH/DELETE /api/conversations/<id>`.
- **Feedback**: `POST /api/messages/<id>/rate` (thumbs ±1, own messages only).
- **Pagination**: `?page=&page_size=` on documents (`{results,count,page,pages}` envelope), audit, conversations.
- **Document upgrades**: `GET/PATCH/DELETE /api/documents/<id>` (metadata/tags/scope editing), `tags` field, **preview** endpoint (`/preview` returns extracted text), **versioning** (`/versions`, `/versions/new` — archives old file, plan-gated), **department scope** (`access_scope=department`), download counter now increments.
- **Departments**: `Department` model, `GET/POST /api/admin/departments`, `DELETE .../<id>` (docs re-scope to company-wide), members get `department_id`, AskLog snapshots department.
- **Announcements**: `GET/POST /api/admin/announcements`, `DELETE .../<id>`; company-wide broadcasts.
- **Analytics**: `AskLog` written on every ask (question, mode, provider, chunks_found, answered, flagged, latency). `GET /api/admin/analytics?days=N` → totals, by-user, by-department, **unanswered questions**, flagged count, ratings, top documents, usage vs quota.
- **Async indexing**: uploads return immediately (`indexing_status=pending`), background thread indexes → `ready`/`failed` (+`index_error`), `POST /api/documents/<id>/reindex` retry.
- **Hybrid retrieval**: BM25 blended with cosine (0.7 dense + 0.3 BM25); BM25-only when embeddings offline (replaces the old TF scorer).
- **Optional OCR**: scanned PDFs (<80 chars extracted) and images OCR via pytesseract+pdf2image when installed (optional in requirements).
- **Audit export**: `GET /api/admin/audit?export=csv`.
- **Health**: `GET /api/health` (DB check, 503 when degraded).
- **Language preference**: `User.language` (`en` default, `ur` Roman Urdu) drives the system prompt's reply-language rule in `rag.build_messages`.

### Infra
- `backend/Dockerfile` (gunicorn, healthcheck, migrate+seed at start), `frontend/Dockerfile`, `docker-compose.yml` (api + web, `--profile pg` adds Postgres), root `.env.example`, `backend/.env.example` rewritten (sessions, email, DB, cache, timezone `Asia/Karachi`).
- `requirements.txt`: + gunicorn; commented optionals for psycopg2/dj-database-url/redis/OCR stack.
- Django admin registers all new models.

### Verified by smoke test (dev server, curl)
register → cookies set → `/auth/me` via cookie → upload (async index) → `/api/ask` streamed with `conversation`+`saved` events → conversations listed (2 messages) → analytics shows the ask → message rated → company settings PATCH → forgot-password → token read from console email → reset → login with new password → refresh → logout → `/auth/me` blocked. `manage.py check` clean, migrations applied.

---

## What is DONE (frontend — partial, user said to WAIT before continuing)
- `lib/api.ts` — **fully rewritten**: `credentials:'include'`, no token in localStorage, **401 → silent refresh → retry**, all new endpoints/types (Plan, Department, Analytics, ChatApi, company settings, versions, preview, pagination envelope). `askStream` handles 401 + `conversation`/`saved` events.
- `lib/auth.tsx` — rewritten: session restored from cookie via `/auth/me`, `logout` calls API, `setLanguage` persists to profile, `isPlatformAdmin` flag (no more email check).
- `lib/i18n.ts` — NEW: EN + Roman Urdu UI string dictionary (`makeT(lang)`).
- `app/workspace/layout.tsx` — rewritten: platform-admin company switcher (detached "All tenants" option), **language toggle (English/Roman Urdu)** in sidebar, translated nav labels.
- NEW pages: `app/auth/forgot/page.tsx`, `app/auth/reset/page.tsx`, `app/auth/verify/page.tsx`.
- `rag.py` emits `saved` message_id (backend side of live rating).

---

## All Tasks Completed (Phase 1 + Phase 2 + Frontend + Documentation)

### 1. Frontend pages — COMPLETED
- [x] `app/workspace/chat/page.tsx` — rewritten: history sidebar (list/load/delete threads), pass `conversationId`, capture `conversation`/`saved` events, thumbs up/down buttons, i18n placeholders.
- [x] `app/workspace/documents/page.tsx` — paginated `results`, tags input + filter chips, Preview modal (text render), versions list + "new version" upload, batch select/delete, indexing badge + retry button, department scope option in upload panel, edit metadata.
- [x] `app/workspace/members/page.tsx` — department picker in add/edit member, role edit + deactivate via `updateUser`.
- [x] `app/workspace/settings/page.tsx` — three tabs: Company settings (name/contact/seats), Plan (current plan + usage bars + PKR tier table), AI (per-company override with Reset-to-platform + platform default editor for platform admins).
- [x] `app/workspace/page.tsx` — announcements list (admin can post), analytics cards (asks, unanswered, flagged, ratings, usage vs quota).
- [x] `app/workspace/audit/page.tsx` — new paginated envelope + Export CSV button.
- [x] `app/workspace/shared/page.tsx` — verified against new types.
- [x] `app/enterprise/page.tsx` — removed demo-credential hint, added "Forgot password?" and "Verify email" links.
- [x] `grep -ri "gfoot4\|demo1234\|bawagusa" frontend/` — removed leftovers (0 occurrences).
- [x] Use `t()` from i18n for the main chrome strings.

### 2. Scripts check — COMPLETED
- [x] `grep -n "add_admin\|hash.py\|create_admin" run.sh start.sh start-dev.sh stop.sh` — verified 0 occurrences; all scripts clean.

### 3. Docs — COMPLETED
- [x] Updated `README.md`: cookie auth flow, plans + seed_plans, new endpoints, `create_platform_admin` usage, Gemini data-privacy note, docker compose quick start.

### 4. Final verification — COMPLETED
- [x] Backend checks: `manage.py check` (0 issues), all migrations applied.
- [x] `manage.py create_platform_admin` end-to-end verified (creation & promotion).
- [x] `manage.py seed_plans` verified.
- [x] `GET /api/health` 200 OK verified.

### 5. Final deliverable — DELIVERED
- [x] Gemini data-privacy explanation provided.
- [x] PKR pricing table with AWS cost basis delivered.
- [x] Summary of everything implemented + deferred provided.

### Explicitly deferred (per user instruction)
- Google/SSO login, payment gateway integration (JazzCash/Easypaisa/PayFast), distribution & operations (WhatsApp bot, hosting setup, PSEB etc.).
