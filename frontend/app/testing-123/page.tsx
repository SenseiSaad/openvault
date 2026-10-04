import Link from 'next/link'
import {
  ArrowRight,
  Activity,
  BrainCircuit,
  Building2,
  Check,
  Database,
  FileText,
  Layers,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
  Upload,
  Settings2,
  Eye,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

const stats = [
  { value: '7', label: 'Core data models', sub: 'Company · User · Document · Chunk · Audit · Share · LLMConfig' },
  { value: '18+', label: 'REST endpoints', sub: 'Auth · Documents · Shares · Chat · Admin' },
  { value: '3', label: 'Workspace roles', sub: 'admin · employee · viewer (tenant-scoped)' },
  { value: '4', label: 'LLM providers', sub: 'Ollama · OpenAI · Anthropic · Gemini' },
]

const stack = [
  { k: 'Frontend', v: 'Next.js 16 · React 19 · TypeScript · Tailwind CSS · App Router', detail: 'app/page.tsx (public), app/workspace/** (private), lib/api.ts, lib/auth.tsx' },
  { k: 'Backend', v: 'Django 5 · DRF · SimpleJWT · SQLite (dev) → Postgres (prod)', detail: 'config/, core/models.py, core/views.py, core/rag.py, core/providers.py' },
  { k: 'Infra / Tooling', v: 'AWS Amplify (amplify.yml) · EC2 + S3 (planned) · pnpm · Ollama', detail: 'run.sh / start-dev.sh · DATA_DIR=./backend/data · .env for secrets' },
  { k: 'File Support', v: 'PDF · DOCX · PPTX · Markdown · TXT', detail: 'Chunked → embedded (nomic-embed-text) → permission-filtered retrieval' },
]

export default function Testing123Page() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      {/* HERO */}
      <section className="relative mx-auto max-w-7xl overflow-hidden px-6 pb-10 pt-12 lg:px-10 lg:pt-20">
        <div className="pointer-events-none absolute left-0 top-0 -z-10 h-96 w-96 -translate-x-1/3 -translate-y-1/4 rounded-full bg-[#dfe7f7] opacity-60 blur-3xl mix-blend-multiply" />
        <div className="pointer-events-none absolute right-0 top-10 -z-10 h-80 w-80 translate-x-1/4 rounded-full bg-[#e7e2ff] opacity-60 blur-3xl mix-blend-multiply" />
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
          <Sparkles className="size-3.5" /> Testing 123 — Project Showcase Page
        </p>
        <h1 className="mt-4 max-w-4xl text-[clamp(2.8rem,6vw,5.2rem)] font-semibold leading-[.92] tracking-[-0.07em]">
          Testing 123 <span className="font-serif font-normal italic">— seven deep dives</span> into OpenVault.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#77746c]">
          This is a dedicated test & demo page that documents the real OpenVault prototype — its private-by-default vault,
          multi-tenant isolation, permission-aware RAG, and controlled collaboration — in 7 rich, project-grounded sections.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="#section-1"
            className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3c3b37]"
          >
            Explore the 7 sections <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-5 py-3 text-sm font-semibold transition hover:border-[#1d1d1b]"
          >
            Open workspace
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dcdad3] bg-white px-4 py-2 text-xs font-medium text-[#77746c]">
            <Check className="size-3.5" /> Saved at /testing-123
          </span>
        </div>

        {/* Stats strip */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[20px] border border-[#dcdad3] bg-[#fffdfa] p-5">
              <p className="text-3xl font-semibold tracking-[-0.05em]">{s.value}</p>
              <p className="mt-1 text-sm font-semibold">{s.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#77746c]">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 1 */}
      <section id="section-1" className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="rounded-[28px] border border-[#dcdad3] bg-[#fffdfa] p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Section 01 — Project Snapshot</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] lg:text-4xl">
                What OpenVault <span className="font-serif font-normal italic">actually is</span>
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#f0ede5] px-3 py-1.5 text-xs font-medium">
              <Building2 className="size-3.5" /> Private company knowledge system
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#77746c]">
            A private, AI-powered knowledge base for organizations. Each registered company gets an isolated document library.
            Staff ask questions in plain language and the assistant answers only from documents that person is allowed to see.
            Until a file is explicitly shared, it stays inside the owning company.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <article className="rounded-2xl bg-[#f7f6f2] p-6">
              <LockKeyhole className="size-5" />
              <h3 className="mt-4 text-sm font-semibold">Private by default</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                No public browse, no publisher directory, no free-user area. Every row carries <code className="rounded bg-white px-1 py-0.5">company_id</code>{' '}
                and queries filter on it first — one company can never see another&apos;s data.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[#77746c]">
                <li>Tenant isolation at DB + API + RAG layers</li>
                <li>Access code (5-char) for partner lookup only</li>
                <li>Viewer / employee / admin roles per company</li>
              </ul>
            </article>
            <article className="rounded-2xl bg-[#f7f6f2] p-6">
              <BrainCircuit className="size-5" />
              <h3 className="mt-4 text-sm font-semibold">Ask in plain language</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                Upload policies, contracts, reports, manuals. The system chunks, embeds, and retrieves — then generates a
                source-cited answer from the top passages.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[#77746c]">
                <li>Streaming answer + source document names</li>
                <li>Keyword fallback when embeddings unavailable</li>
                <li>Supports PDF, DOCX, PPTX, MD, TXT</li>
              </ul>
            </article>
            <article className="rounded-2xl bg-[#f7f6f2] p-6">
              <Network className="size-5" />
              <h3 className="mt-4 text-sm font-semibold">Controlled collaboration</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                Find a registered partner by its company code, pick one employee (CEO, HR, CTO…), and grant exactly one
                document — nothing else in your library opens.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[#77746c]">
                <li>DocumentShare = one file → one person</li>
                <li>Per-person can_download flag</li>
                <li>Revoke anytime; audited</li>
              </ul>
            </article>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-[#dcdad3] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8c8a83]">Repository layout</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-[#1d1d1b] p-4 text-xs leading-relaxed text-[#e8e6df]">
{`OpenVault/
\u251c\u2500\u2500 frontend/          Next.js 16 (public + /workspace)
\u2502   \u251c\u2500\u2500 app/page.tsx, app/about, help, policy
\u2502   \u251c\u2500\u2500 app/workspace/{documents,chat,members,shared,audit,settings}
\u2502   \u2514\u2500\u2500 lib/api.ts, lib/auth.tsx
\u251c\u2500\u2500 backend/           Django 5 + DRF + SimpleJWT
\u2502   \u251c\u2500\u2500 config/  settings, urls, views (landing)
\u2502   \u251c\u2500\u2500 core/    models, views, serializers, rag, providers
\u2502   \u2514\u2500\u2500 data/    uploaded & seeded files (per-company folders)
\u251c\u2500\u2500 amplify.yml  ·  run.sh  ·  start-dev.sh  ·  OpenVault.pptx`}
            </pre>
          </div>
        </div>
      </section>

      {/* SECTION 2 */}
      <section id="section-2" className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <div className="rounded-[28px] bg-[#20211f] p-8 text-white lg:p-10">
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">Section 02 — Architecture & Stack</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.05em] lg:text-4xl">
            Two apps, one isolation rule: <span className="font-serif font-normal italic text-white/70">company == your world.</span>
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {stack.map((s) => (
              <div key={s.k} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                  <Layers className="size-3.5" /> {s.k}
                </p>
                <p className="mt-3 text-sm font-medium leading-relaxed">{s.v}</p>
                <p className="mt-2 text-xs leading-relaxed text-white/55">{s.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-2xl bg-white p-6 text-[#1d1d1b]">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4" /> Frontend routes (real)
              </h3>
              <ul className="mt-4 grid gap-2 text-xs leading-relaxed text-[#5d5b55]">
                <li>
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/</code> public home ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/about</code> ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/help</code> ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/policy</code> ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/enterprise</code>
                </li>
                <li>
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/workspace</code> overview ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/workspace/documents</code> ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/workspace/chat</code>
                </li>
                <li>
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/workspace/members</code> ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/workspace/shared</code> ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/workspace/audit</code> ·{' '}
                  <code className="rounded bg-[#f7f6f2] px-1.5 py-0.5">/workspace/settings</code>
                </li>
                <li className="pt-2 text-[#77746c]">
                  Auth via <code className="rounded bg-[#f7f6f2] px-1 py-0.5">lib/auth.tsx</code> (JWT in localStorage) +{' '}
                  <code className="rounded bg-[#f7f6f2] px-1 py-0.5">lib/api.ts</code> auto host detection (<code>same-host:8000</code>).
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="size-4" /> API base & env
              </h3>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-black/30 p-4 text-xs leading-relaxed text-white/80">
{`# backend/.env
SECRET_KEY=change-me
DEBUG=true
DATA_DIR=./data
LLM_PROVIDER=ollama
LLM_URL=http://localhost:11434
LLM_MODEL=llama3.2:3b
EMBED_PROVIDER=ollama
EMBED_MODEL=nomic-embed-text

# frontend/.env.local (optional)
NEXT_PUBLIC_API_URL=http://localhost:8000`}
              </pre>
              <p className="mt-3 text-xs leading-relaxed text-white/50">
                Do not ship with <code className="rounded bg-white/10 px-1 py-0.5">DEBUG=true</code> or{' '}
                <code className="rounded bg-white/10 px-1 py-0.5">CORS_ALLOW_ALL_ORIGINS=True</code> — tighten for prod.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 */}
      <section id="section-3" className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <div className="rounded-[28px] border border-[#dcdad3] bg-[#fffdfa] p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Section 03 — Data Models & Tenant Isolation</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] lg:text-4xl">
            Every tenant row hangs off <span className="font-serif font-normal italic">Company.</span>
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#77746c]">
            From <code className="rounded bg-[#f7f6f2] px-1 py-0.5">backend/core/models.py</code>: Company is the tenant root. Users,
            Documents, Chunks, AuditLogs and Shares all carry <code className="rounded bg-[#f7f6f2] px-1 py-0.5">company</code> (or are
            reachable through it). The API enforces <code className="rounded bg-[#f7f6f2] px-1 py-0.5">company == request.user.company</code>{' '}
            on every query. Five-character <code className="rounded bg-[#f7f6f2] px-1 py-0.5">access_code</code> is the safe, shareable company
            handle.
          </p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-[#e6e3dc]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f6f2] text-[#8c8a83]">
                  <tr>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.1em]">Model</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.1em]">Key fields</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-[0.1em]">Tenant rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eae7df] text-[#3a3935]">
                  <tr>
                    <td className="px-4 py-3 font-medium">Company</td>
                    <td className="px-4 py-3">name, slug, access_code (5-char), website, contact_email, phone, max_employees</td>
                    <td className="px-4 py-3">Tenant root — everything else FKs here</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">User</td>
                    <td className="px-4 py-3">email (unique), full_name, title (CEO/CFO/CTO/HR…), role: admin/employee/viewer, company FK</td>
                    <td className="px-4 py-3">One company per user; JWT scoped to it</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Document</td>
                    <td className="px-4 py-3">filename, content_type, size, category, description, access_scope (company|restricted)</td>
                    <td className="px-4 py-3">Visible only to owning company + explicit grants</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Chunk</td>
                    <td className="px-4 py-3">ord, text, embedding (binary float32)</td>
                    <td className="px-4 py-3">Carries company FK — retrieval filters without a join</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">DocumentShare / Access</td>
                    <td className="px-4 py-3">document → shared_with_user, shared_by, can_download</td>
                    <td className="px-4 py-3">One file → one person exception to isolation</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">AuditLog / LLMConfig</td>
                    <td className="px-4 py-3">action, detail, ip, created_at · provider, chat_model, temperature, max_tokens</td>
                    <td className="px-4 py-3">Audit is per-company; LLMConfig is global (pk=1)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-[#f7f6f2] p-5">
              <Database className="size-4" />
              <p className="mt-3 text-sm font-semibold">Seed & data dirs</p>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                <code className="rounded bg-white px-1 py-0.5">backend/data/</code> has per-company folders (agritech, company-a/b/c,
                devcore, medarchive… ). Management commands: <code className="rounded bg-white px-1 py-0.5">seed_demo</code>,{' '}
                <code className="rounded bg-white px-1 py-0.5">reindex_embeddings</code>.
              </p>
            </div>
            <div className="rounded-2xl bg-[#f7f6f2] p-5">
              <ShieldCheck className="size-4" />
              <p className="mt-3 text-sm font-semibold">Least privilege</p>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                <code className="rounded bg-white px-1 py-0.5">company</code> scope = readable by active members.{' '}
                <code className="rounded bg-white px-1 py-0.5">restricted</code> scope requires a named grant in DocumentAccess/Share.
              </p>
            </div>
            <div className="rounded-2xl bg-[#f7f6f2] p-5">
              <Eye className="size-4" />
              <p className="mt-3 text-sm font-semibold">Migrations</p>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                8 migrations to date (0008_alter_user_role). Roles tightened, sharing models added, public-library models removed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 */}
      <section id="section-4" className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <div className="rounded-[28px] border border-[#dcdad3] bg-[#fffdfa] p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Section 04 — Document Lifecycle</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] lg:text-4xl">
            Upload once, <span className="font-serif font-normal italic">answer everywhere</span> — if you&apos;re allowed.
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            <div className="relative rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-6 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-white shadow-sm">
                <Upload className="size-4" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">1. Upload</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                Admin/employee POSTs to <code className="rounded bg-white px-1 py-0.5">/api/documents/upload</code> with file +{' '}
                <code className="rounded bg-white px-1 py-0.5">access_scope</code> + optional category/description. Stored under{' '}
                <code className="rounded bg-white px-1 py-0.5">DATA_DIR/<company>/</code>.
              </p>
            </div>
            <div className="relative rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-6 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-white shadow-sm">
                <FileText className="size-4" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">2. Classify</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                Choose <em>company</em> (everyone in your org) or <em>restricted</em> (selected people only). Restricted files are
                invisible — even to a same-company CTO — until granted.
              </p>
            </div>
            <div className="relative rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-6 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-white shadow-sm">
                <Layers className="size-4" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">3. Chunk & Embed</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                <code className="rounded bg-white px-1 py-0.5">core/rag.py</code> splits text, creates Chunk rows with{' '}
                <code className="rounded bg-white px-1 py-0.5">ord</code> + <code className="rounded bg-white px-1 py-0.5">embedding</code>{' '}
                (float32 bytes). Company FK kept on Chunk for fast tenant-filtered search.
              </p>
            </div>
            <div className="relative rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-6 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-white shadow-sm">
                <Check className="size-4" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">4. Retrieve</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                At ask-time, only chunks from docs the caller can read are searched. Top passages + source filenames flow to the LLM.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#1d1d1b] p-6 text-white">
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">Sample seeded corpora</p>
              <ul className="mt-4 space-y-2 text-xs leading-relaxed text-white/80">
                <li>
                  <span className="font-semibold text-white">company-a/b/c:</span> Leave Policy · Expense & Reimbursement · Remote Work
                  · HR Quick Facts · Code of Conduct
                </li>
                <li>
                  <span className="font-semibold text-white">medarchive:</span> CRISPR Ethics · mRNA Vaccines · Cell Biology · Evidence-Based
                  Medicine
                </li>
                <li>
                  <span className="font-semibold text-white">techpress:</span> Transformer Networks · Zero Trust · Systems Design · LLMs Intro
                </li>
                <li>
                  <span className="font-semibold text-white">openscience:</span> Quantum Mechanics · Exoplanets · Thermodynamics · Reproducible
                  Research
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8c8a83]">Document API (real)</p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-xs leading-relaxed text-[#3a3935]">
{`GET  /api/documents
POST /api/documents/upload
GET  /api/documents/<id>
GET  /api/documents/<id>/download
GET|POST /api/documents/<id>/shares
DELETE   /api/documents/<id>/shares/<user_id>
GET  /api/shared-with-me`}
              </pre>
              <p className="mt-3 text-xs leading-relaxed text-[#77746c]">
                Every handler calls <code className="rounded bg-white px-1 py-0.5">visible_documents(user)</code> first — no bypass via direct ID.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 */}
      <section id="section-5" className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <div className="rounded-[28px] bg-[#f0ede5] p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Section 05 — RAG & Permission-Aware AI</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] lg:text-4xl">
            Answers grounded <span className="font-serif font-normal italic">only</span> in what you can see.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#5d5b55]">
            The chat at <code className="rounded bg-white px-1 py-0.5">POST /api/ask</code> is streaming RAG. Retrieval respects the same ACL as
            downloads — a user cannot trick the AI into reading a restricted file they lack access to.
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-2xl bg-white p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <BrainCircuit className="size-4" /> How an answer is built (6 steps)
              </h3>
              <ol className="mt-4 space-y-3 text-xs leading-relaxed text-[#5d5b55]">
                <li>
                  <span className="font-semibold text-[#1d1d1b]">1. Scope:</span> resolve caller&apos;s company + explicit grants → allowed
                  document IDs.
                </li>
                <li>
                  <span className="font-semibold text-[#1d1d1b]">2. Search:</span> embedding cosine similarity over Chunk.embedding (fallback:
                  keyword overlap if no embeddings).
                </li>
                <li>
                  <span className="font-semibold text-[#1d1d1b]">3. Context:</span> top-k passages + any &quot;always-included&quot; notes are
                  assembled.
                </li>
                <li>
                  <span className="font-semibold text-[#1d1d1b]">4. Prompt:</span> system instruction: answer only from context; say when answer
                  is not present; cite sources.
                </li>
                <li>
                  <span className="font-semibold text-[#1d1d1b]">5. Generate:</span> via <code className="rounded bg-[#f7f6f2] px-1 py-0.5">core/providers.py</code>{' '}
                  adapter (Ollama/OpenAI/Anthropic/Gemini).
                </li>
                <li>
                  <span className="font-semibold text-[#1d1d1b]">6. Stream:</span> tokens streamed back with source document names; audited.
                </li>
              </ol>
              <div className="mt-5 rounded-xl bg-[#f7f6f2] p-4">
                <p className="text-xs font-semibold">LLM config lives in one row (pk=1)</p>
                <p className="mt-1 text-xs leading-relaxed text-[#77746c]">
                  <code className="rounded bg-white px-1 py-0.5">LLMConfig</code> fields: provider, chat_model, api_key, base_url, temperature,
                  max_tokens. When blank, <code className="rounded bg-white px-1 py-0.5">.env</code> values are used. Manage at{' '}
                  <code className="rounded bg-white px-1 py-0.5">GET|PUT /api/admin/llm-config</code>, test with{' '}
                  <code className="rounded bg-white px-1 py-0.5">POST /api/admin/llm-test</code> (sends &quot;ping&quot; → expects &quot;pong&quot;).
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#dcdad3] bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8c8a83]">Providers (real)</p>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#5d5b55]">
                  <li>
                    <span className="font-semibold text-[#1d1d1b]">Ollama</span> — local, default (e.g. llama3.2:3b + nomic-embed-text)
                  </li>
                  <li>
                    <span className="font-semibold text-[#1d1d1b]">OpenAI</span> · <span className="font-semibold text-[#1d1d1b]">Anthropic</span>{' '}
                    · <span className="font-semibold text-[#1d1d1b]">Gemini</span> — via api_key + base_url
                  </li>
                  <li className="pt-2 text-[#77746c]">Configured in Settings page; global — retrieval, not the model, enforces isolation.</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-[#1d1d1b] p-6 text-white">
                <p className="text-xs uppercase tracking-[0.14em] text-white/50">Try it (logged-in)</p>
                <p className="mt-2 text-sm font-medium">Ask: &quot;What does our Leave Policy say about sick days?&quot;</p>
                <p className="mt-2 text-xs leading-relaxed text-white/60">
                  You&apos;ll get a grounded answer + cited filenames. Try a question outside your allowed docs — the model will say the answer is
                  not in the available context.
                </p>
                <Link
                  href="/workspace/chat"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1b]"
                >
                  Open Chat <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 */}
      <section id="section-6" className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <div className="rounded-[28px] border border-[#dcdad3] bg-[#fffdfa] p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Section 06 — Sharing & Access Control</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] lg:text-4xl">
            Exact delegation, <span className="font-serif font-normal italic">not blanket access.</span>
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {["1. Secure Upload", "2. Zero-Trust Defaults", "3. Exact Grant", "4. Cross-Company"].map((t, i) => (
              <div key={t} className="rounded-2xl bg-[#f7f6f2] p-6">
                <p className="font-mono text-xs text-[#8c8a83]">0{i + 1}</p>
                <h3 className="mt-3 text-sm font-semibold">{t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                  {i === 0 && "CEO uploads a confidential file and marks it 'Selected people' only."}
                  {i === 1 && "Even a CTO/CFO in the same company cannot view it until named."}
                  {i === 2 && "Only explicitly added people (e.g. HR Director) get read + optional download."}
                  {i === 3 && "Find partner by 5-char code → pick one person → grant one file. Revocable."}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-6">
              <h3 className="text-sm font-semibold">How sharing works (UI + API)</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-[#5d5b55]">
                <li>
                  Admin opens document → <em>Share</em> → enters partner&apos;s <code className="rounded bg-white px-1 py-0.5">access_code</code>.
                </li>
                <li>
                  App calls <code className="rounded bg-white px-1 py-0.5">GET /api/companies/search</code> (code lookup) then{' '}
                  <code className="rounded bg-white px-1 py-0.5">GET /api/companies/<code>/members</code> to list target members.
                </li>
                <li>
                  Select one person → POST <code className="rounded bg-white px-1 py-0.5">/api/documents/<id>/shares</code> with{' '}
                  <code className="rounded bg-white px-1 py-0.5">access_code + user_id</code> (or legacy email).
                </li>
                <li>
                  Backend creates <code className="rounded bg-white px-1 py-0.5">DocumentShare</code> +{' '}
                  <code className="rounded bg-white px-1 py-0.5">DocumentAccess</code> with{' '}
                  <code className="rounded bg-white px-1 py-0.5">can_download</code>. Audited.
                </li>
                <li>
                  Recipient sees it under <code className="rounded bg-white px-1 py-0.5">GET /api/shared-with-me</code> and{' '}
                  <code className="rounded bg-white px-1 py-0.5">/workspace/shared</code>.
                </li>
                <li>
                  Revoke via <code className="rounded bg-white px-1 py-0.5">DELETE /api/documents/<id>/shares/<user_id></code>.
                </li>
              </ol>
            </div>
            <div className="rounded-2xl bg-[#1d1d1b] p-6 text-white">
              <h3 className="text-sm font-semibold">Access Scope field</h3>
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl bg-white p-4 text-[#1d1d1b]">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em]">company</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#5d5b55]">
                    Readable by every active member of the owning company. No extra grants needed.
                  </p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/80">restricted</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/60">
                    Hidden by default. Only users with a DocumentAccess/Share row can read or download. Great for HR, finance, legal packets.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/50">
                Frontend enforces this in <code className="rounded bg-white/10 px-1 py-0.5">visible_documents()</code>:{' '}
                <code className="rounded bg-white/10 px-1 py-0.5">Q(access_scope=&quot;company&quot;) | Q(access_grants__user=user)</code>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 */}
      <section id="section-7" className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <div className="rounded-[28px] border border-[#dcdad3] bg-[#fffdfa] p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Section 07 — Audit, Operations & Roadmap</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] lg:text-4xl">
            Accountability <span className="font-serif font-normal italic">by default.</span>
          </h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#f7f6f2] p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="size-4" /> Audit trail (per company)
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#77746c]">
                Every sensitive action writes an <code className="rounded bg-white px-1 py-0.5">AuditLog</code> row scoped to the actor&apos;s
                company: IP + timestamp + detail. View at <code className="rounded bg-white px-1 py-0.5">GET /api/admin/audit</code> /{' '}
                <code className="rounded bg-white px-1 py-0.5">/workspace/audit</code>.
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-xs leading-relaxed text-[#5d5b55]">
                <li className="rounded-xl bg-white p-3">login / register</li>
                <li className="rounded-xl bg-white p-3">upload / download</li>
                <li className="rounded-xl bg-white p-3">member add / edit / remove</li>
                <li className="rounded-xl bg-white p-3">share / unshare</li>
                <li className="rounded-xl bg-white p-3">ask (question logged)</li>
                <li className="rounded-xl bg-white p-3">llm_config change</li>
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-[#98958c]">
                Tip for CPA/compliance: export this history as evidence that the right person saw the right file at the right time.
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e6e3dc] bg-white p-6">
                <h3 className="text-sm font-semibold">Roles — what each can do</h3>
                <table className="mt-4 w-full text-left text-xs">
                  <thead className="text-[#8c8a83]">
                    <tr>
                      <th className="pb-2 font-semibold">Role</th>
                      <th className="pb-2 font-semibold">Can do</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eae7df] text-[#5d5b55]">
                    <tr>
                      <td className="py-2 font-medium text-[#1d1d1b]">admin</td>
                      <td className="py-2">Upload, share/revoke, members, audit, LLM settings, downloads</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-[#1d1d1b]">employee</td>
                      <td className="py-2">Upload, ask, read allowed docs (same ACL)</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-[#1d1d1b]">viewer</td>
                      <td className="py-2">Read / download only what is explicitly allowed</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-[#77746c]">
                  Enforced by <code className="rounded bg-[#f7f6f2] px-1 py-0.5">core/permissions.py</code>: IsAdmin / IsEditor.
                </p>
              </div>
              <div className="rounded-2xl bg-[#dfe7f7] p-6">
                <h3 className="text-sm font-semibold text-[#2a3452]">Run locally / deploy</h3>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-4 text-xs leading-relaxed text-[#2a3452]">
{`# start both servers
./run.sh          # or ./start-dev.sh start
# frontend → http://localhost:3000
# backend  → http://localhost:8000

# seed demo tenants + docs
python backend/manage.py seed_demo
python backend/manage.py reindex_embeddings`}
                </pre>
                <p className="mt-3 text-xs leading-relaxed text-[#536070]">
                  Production plan: Frontend on AWS Amplify (<code className="rounded bg-white px-1 py-0.5">amplify.yml</code>), API + files on EC2 with
                  Postgres + S3. Docker planned; not yet in repo.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-2xl border border-dashed border-[#dcdad3] bg-[#f7f6f2] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8c8a83]">What this Testing 123 page proves</p>
            <div className="mt-4 grid gap-3 text-xs leading-relaxed text-[#5d5b55] sm:grid-cols-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
                <Check className="size-3.5" /> File saved & routed
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
                <Check className="size-3.5" /> 7 sections with real project data
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
                <Check className="size-3.5" /> Styled to match OpenVault design system
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm font-medium text-white"
              >
                Back to home <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/workspace/documents"
                className="inline-flex items-center gap-2 rounded-full border border-[#dcdad3] bg-white px-5 py-2.5 text-sm font-medium"
              >
                View documents
              </Link>
              <Link
                href="/help"
                className="inline-flex items-center gap-2 rounded-full border border-[#dcdad3] bg-white px-5 py-2.5 text-sm font-medium"
              >
                How it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
