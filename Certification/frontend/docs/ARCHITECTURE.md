# Architecture

## Folder structure

```
frontend/
├─ src/
│  ├─ app/                      # Next.js App Router — thin pages only
│  │  ├─ (public)/              # unauthenticated: landing, login, password reset,
│  │  │                         #   invitation accept, catalogue, legal, session-expired
│  │  ├─ (agency)/agency/**     # agency admin portal (RequireAuth: agency_admin|super_admin)
│  │  ├─ (learner)/learner/**   # learner portal (RequireAuth)
│  │  ├─ (platform)/platform/** # platform admin portal (RequireAuth: super_admin|training_manager)
│  │  ├─ layout.tsx             # html/body + Providers
│  │  ├─ providers.tsx          # QueryClient → Session → Agency → Toaster, global 401 listener
│  │  ├─ error.tsx              # recovery screen (no raw error text in prod)
│  │  └─ not-found.tsx
│  ├─ features/                 # feature-first modules
│  │  ├─ auth/                  # session/agency contexts, guards, roles, api, dashboard-for-role
│  │  ├─ agency/                # agency portal api + models (IB-2/IB-3)
│  │  └─ platform/              # platform portal api + models (IB-5)
│  ├─ components/
│  │  ├─ ui/                    # primitives (button, dialog, table, tabs, …) — Radix-based
│  │  └─ common/                # app-shell, data-table, page-header, status-badge,
│  │                            #   empty-state, error-boundary, integration-boundaries
│  ├─ lib/
│  │  ├─ api/client.ts          # single typed API client (CSRF, 401 listeners, safe errors)
│  │  ├─ api/error.ts           # ApiError + safeMessageForStatus
│  │  ├─ api/types.ts           # Paginated<T>, ListQuery
│  │  └─ query-client.ts        # retry policy (safe GETs only; mutations never retry)
│  ├─ config/                   # env.ts (public env), feature-flags.ts
│  └─ test/setup.ts             # vitest jsdom setup
├─ e2e/                         # Playwright specs (backend-gated except smoke)
├─ docs/                        # this file, ROUTE_MAP, INTEGRATION_BLOCKERS, DEPLOYMENT
├─ playwright.config.ts
├─ vitest.config.ts
└─ .env.example
```

## Core patterns

### Feature-first, pages thin
Each feature owns `api.ts` (typed calls + wire models), optionally `hooks.ts` / `schemas.ts` (Zod). Pages compose queries/mutations with `useQuery`/`useMutation` and render; they hold no transport logic.

### One API client (`src/lib/api/client.ts`)
- `credentials: "include"` always; `X-Request-Id` per request.
- CSRF token fetched lazily from `GET /api/auth/csrf`, attached to mutations, single retry with a fresh token on CSRF-style 401.
- 401 notifies listeners (providers redirect to `/session-expired?next=…`); 403 is *never* a logout.
- Errors normalized to `ApiError`: status/code/fieldErrors + a message that is always safe to render.

### Query rules
- Keys: `["area", scopeId, resource, params]`; invalidate affected prefixes on mutation success.
- Retry: safe GETs only (network/5xx, max 2) — never 401/403, never mutations.
- Lists are URL-synced (`?page=&q=`) via `DataTable` + `useListParams`, so filtered views are linkable and restore on refresh.

### Authentication & guards
`SessionProvider` restores the session with a single `GET /api/auth/me` on load. `RequireAuth` handles loading → spinner, unauthenticated → `/login?next=<safe path>`, wrong role → `/access-denied`. Guards are UX mirrors of server rules only.

### Multi-agency
`AgencyProvider` holds memberships (uuid/slug/name/role from `/api/auth/me`), persists the selection per tab in `sessionStorage`, and re-validates it against the backend on every session load. `AgencySelector` appears in portal topbars.

### Statuses
Every status renders through `StatusBadge` — an icon **and** text, never color alone (WCAG AA).

### Integration boundaries (no mock data)
- Unverified endpoints: code comment `INTEGRATION-UNVERIFIED (IB-x)` + entry in `docs/INTEGRATION_BLOCKERS.md`.
- Not-yet-existing capabilities: behind `src/config/feature-flags.ts`; disabled ⇒ `IntegrationPending` / `PublicIdBlocker` UI states. Enabling a flag requires only env config — no code change.
- Verified today: `GET /api/store/products` (public + agency catalogue).

### Public ids only in URLs
`agencyPublicId()` resolves `slug ?? uuid ?? null`; `[id]` params are regex-validated and render "Not found" otherwise. Internal numeric ids never appear in a URL (IB-1).

## Rendering & data-flow summary

```
page (client) ─ useQuery ─▶ feature api.ts ─▶ lib/api/client.ts ─▶ /api/* (cookie session)
      │                         ▲                     │
      │                         └── CSRF on mutations ┴─ 401 → providers → /session-expired
      ├─ mutation → toast (sonner) + invalidate affected keys
      └─ flags off → IntegrationPending (never fake data)
```

## Quality gates
`npm run typecheck` (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`), `npm test` (Vitest 43 tests), `npm run build`, `npm run test:e2e` (Playwright; backend-gated specs self-skip).