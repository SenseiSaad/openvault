# OpenVault

A private, AI-powered knowledge base for organizations.

Each organization gets an isolated document library. Staff ask questions in
plain language, and the assistant answers using only the documents that person
is allowed to see. Organizations can also publish selected documents to a
public library.

This repository is a working local prototype: a Next.js public site plus
enterprise workspace, and a Django REST API with retrieval-augmented
generation (RAG).

---

## What it does

- **Private knowledge base.** Upload policies, manuals, reports, and notes.
  Documents stay inside the owning organization by default.
- **Ask in plain language.** The assistant retrieves the most relevant
  passages, then writes an answer from those passages and shows the source
  document names.
- **Flexible AI.** Run a local model with [Ollama](https://ollama.com), or
  point the settings page at OpenAI, Anthropic, or Google Gemini.
- **Roles.** Admin, employee, and viewer inside an organization. Public
  consumer accounts can browse published documents and save favorites.
- **Controlled sharing.** Grant one named person from another organization
  access to one specific document, and revoke it later.
- **Public library.** An organization can deliberately publish a document.
  Until then it stays private.

---

## Repository layout

```
OpenVault/
├── frontend/          Next.js 16 app (public site + enterprise workspace)
├── backend/           Django 5 API, RAG pipeline, SQLite database
├── OpenVault.pptx     Project presentation
├── amplify.yml        AWS Amplify build spec for the frontend
├── start-dev.sh       Start / stop / restart both local servers
└── README.md
```

### Frontend (`frontend/`)

Next.js App Router, React 19, TypeScript, Tailwind CSS.

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Public home |
| `app/discover` | Browse and search published documents |
| `app/publishers` | Public publisher / organization pages |
| `app/favorites` | Saved documents (signed-in consumers) |
| `app/auth` | Public and enterprise sign-in / register |
| `app/enterprise` | Enterprise landing / onboarding |
| `app/workspace` | Private workspace (overview, documents, chat, members, shares, audit, AI settings) |
| `app/about`, `app/help`, `app/policy` | Static pages |
| `lib/api.ts` | API client |
| `lib/auth.tsx` | JWT session and role helpers |
| `components/` | Shared UI (header, footer, document cards) |

The frontend talks to the Django API on port `8000`. It auto-detects
`http://<same-host>:8000` unless `NEXT_PUBLIC_API_URL` is set.

### Backend (`backend/`)

Django + Django REST Framework + SimpleJWT.

| Path | Purpose |
| --- | --- |
| `config/` | Project settings, root URLs, landing page |
| `core/models.py` | Companies, users, documents, chunks, shares, audit, LLM config |
| `core/views.py` | REST endpoints |
| `core/rag.py` | Chunking, embeddings, keyword fallback, answer generation |
| `core/providers.py` | Ollama / OpenAI / Anthropic / Gemini adapters |
| `core/management/commands/seed_demo.py` | Demo tenants and documents |
| `data/` | Uploaded and seeded document files (created at runtime) |
| `db.sqlite3` | Development database |

Every tenant-owned row is scoped by `company`. Queries filter on that foreign
key before listing, searching, or answering.

---

## Requirements

- **Python** 3.11+ (3.12 is fine)
- **Node.js** 20+
- **pnpm** 9+ (or npm)
- **Ollama** (optional, for local answers and embeddings)

---

## Quick start

From the repository root:

```bash
# 1. Backend
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
backend/.venv/bin/python backend/manage.py migrate
backend/.venv/bin/python backend/manage.py seed_demo

# 2. Frontend
cd frontend
pnpm install          # or: npm install
cp .env.example .env.local
cd ..

# 3. Run both
./start-dev.sh
```

Then open:

| Service | URL |
| --- | --- |
| Public site + workspace | http://localhost:3000 |
| Django API + landing | http://localhost:8000 |
| Django admin | http://localhost:8000/admin/ |

Useful launcher commands:

```bash
./start-dev.sh          # start both (logs in .dev-logs/)
./start-dev.sh status
./start-dev.sh stop
./start-dev.sh restart
```

To run the servers yourself instead of the script:

```bash
# terminal 1
cd backend
.venv/bin/python manage.py runserver 0.0.0.0:8000

# terminal 2
cd frontend
pnpm dev                # or: npm run dev
```

---

## Demo accounts

`seed_demo` creates publishers, private tenants, documents, and one
cross-company share.

| Account | Password | What it is |
| --- | --- | --- |
| `admin@openscience.com` | `demo1234` | Public publisher admin |
| `staff@openscience.com` | `demo1234` | Publisher employee |
| `admin@company-a.com` | `demo1234` | Private tenant admin |
| `hr@company-a.com` | `demo1234` | Private employee (receives a shared document from Company C) |
| `viewer@company-a.com` | `demo1234` | Read-only viewer |
| `admin@company-b.com` / `admin@company-c.com` | `demo1234` | Other isolated tenants |
| `root@securekb.local` | `admin1234` | Django `/admin/` superuser |

Company C shares `Vendor Security Requirements.md` with `hr@company-a.com`
only. Use that to demonstrate one-document, one-person sharing.

To rebuild the demo from scratch:

```bash
rm backend/db.sqlite3
backend/.venv/bin/python backend/manage.py migrate
backend/.venv/bin/python backend/manage.py seed_demo
```

---

## AI setup

The default is a **local Ollama** model. Nothing is sent to an external
provider unless you change the settings.

```bash
# install from https://ollama.com, then:
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

`backend/.env` (copied from `.env.example`) controls the fallback provider:

```
LLM_PROVIDER=ollama
LLM_URL=http://localhost:11434
LLM_MODEL=llama3.2:3b
EMBED_PROVIDER=ollama
EMBED_MODEL=nomic-embed-text
```

You can also switch providers from **Workspace → Settings** without editing
the file. Supported providers:

- **Ollama** — local, data stays on the machine
- **OpenAI** (or any OpenAI-compatible endpoint)
- **Anthropic**
- **Google Gemini**

Chat and embeddings are configured separately, so changing the answer model
does not invalidate stored vectors.

If embeddings are unavailable, search falls back to keyword matching so
questions still work.

---

## How answering works

1. A user asks a question in the workspace chat.
2. The API keeps only documents the user may see: their company's files, plus
   any document shared specifically with them.
3. Those documents are searched (embedding similarity, or keyword fallback).
4. The top passages, plus any notes marked as always-included, are sent to
   the language model.
5. The model is instructed to answer only from that context and to say when
   the answer is not present.
6. The reply is streamed back with the names of the source documents.

Supported upload types include PDF, DOCX, PPTX, Markdown, and plain text.

---

## API overview

All application routes live under `/api/`.

**Auth**

- `POST /api/auth/register` — create an organization and its first admin
- `POST /api/auth/login` — enterprise login (email + password)
- `GET /api/auth/me` — current user
- `POST /api/public/register` — consumer account
- `POST /api/public/login` — consumer login (username + password)

**Private workspace** (JWT required)

- `GET /api/documents` · `POST /api/documents/upload`
- `GET|PATCH|DELETE /api/documents/<id>`
- `GET /api/documents/<id>/download`
- `GET|POST /api/documents/<id>/shares`
- `DELETE /api/documents/<id>/shares/<user_id>`
- `GET /api/shared-with-me`
- `POST /api/ask` — streamed RAG answer
- `GET /api/llm-status`
- `GET|POST /api/admin/users` · `PATCH|DELETE /api/admin/users/<id>`
- `GET /api/admin/audit`
- `GET|PUT /api/admin/llm-config` · `POST /api/admin/llm-test`

**Public portal** (no login)

- `GET /api/public/companies`
- `GET /api/public/categories`
- `GET /api/public/documents` · `GET /api/public/documents/<id>`
- `GET /api/public/documents/<id>/download`

**Favorites** (signed-in consumer)

- `GET|POST /api/favorites` · `DELETE /api/favorites/<id>`

---

## Roles

| Role | Typical use | Can do |
| --- | --- | --- |
| `admin` | Organization manager | Upload, publish, members, AI settings, sharing, audit |
| `employee` | Staff | Ask questions, work with documents they can access |
| `viewer` | Read-only colleague | View / download allowed documents |
| `public` | Consumer on the open library | Browse published documents and save favorites |

An enterprise user belongs to exactly one organization.

---

## Environment files

Copy the examples. Do not commit real secrets.

**`backend/.env`**

```
SECRET_KEY=change-me
DEBUG=true
DATA_DIR=./data
LLM_PROVIDER=ollama
LLM_URL=http://localhost:11434
LLM_MODEL=llama3.2:3b
EMBED_PROVIDER=ollama
EMBED_MODEL=nomic-embed-text
```

**`frontend/.env.local`** (optional)

```
# only if the API is not on the same host, port 8000
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Deployment notes

This is a local prototype. Intended production direction:

- **Frontend:** AWS Amplify using `amplify.yml` (`appRoot: frontend`, Node 20, pnpm)
- **API + files:** a single server (planned Amazon EC2) with PostgreSQL and
  object storage (planned Amazon S3)
- **Packaging:** Docker is planned; it is not in this tree yet

Do not treat `DEBUG=true`, `ALLOWED_HOSTS=["*"]`, or
`CORS_ALLOW_ALL_ORIGINS = True` as production-ready. Change the secret key,
restrict hosts, and tighten CORS before exposing the API.

---

## Presentation

`OpenVault.pptx` is the project presentation for the current prototype.

---

## Team

Saad Waseem, M Akmal, M Talha

University of South Asia — Final Year Project


