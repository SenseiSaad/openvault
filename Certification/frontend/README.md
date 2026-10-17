# Certification Academy LMS — Frontend

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind · TanStack Query · React Hook Form + Zod · Vitest/RTL · Playwright.

Institutional training platform frontend for U.S. government agencies: public catalogue, agency administration (members, invitations, seats, orders, billing), learner portal (learning, assessments, certificates, profile) and platform administration (agencies, catalog publishing, pricing, entitlements).

## Status: frontend complete, backend integration pending

There is **no backend on this machine**. The app is built against the documented API contracts and every unverified route is:

- marked `INTEGRATION-UNVERIFIED` in code, and
- tracked in [`docs/INTEGRATION_BLOCKERS.md`](docs/INTEGRATION_BLOCKERS.md) (IB-1 … IB-5).

There is **no mock data anywhere**. Capabilities whose endpoints do not exist yet sit behind feature flags (`src/config/feature-flags.ts`, all default `false`) and render an explicit *"integration pending"* boundary instead of pretending to work. The one verified endpoint, `GET /api/store/products`, is used for real on the catalogue pages.

## Quick start

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

To proxy `/api/*` to a backend when one exists:

```bash
BACKEND_PROXY=true BACKEND_ORIGIN=http://localhost:8000 npm run dev
```

Copy `.env.example` to `.env.local` to change flags/URLs — it contains no secrets (the frontend never holds any).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest unit + RTL suite |
| `npm run test:e2e` | Playwright e2e (see below) |

## Security model

- **Sessions** are opaque `HttpOnly` cookies owned by the backend. The frontend never reads, stores or transmits tokens from web storage; every request sends `credentials: "include"`.
- **CSRF**: `src/lib/api/client.ts` lazily fetches `GET /api/auth/csrf` and attaches `X-CSRF-Token` to every mutating request, with a *single* retry using a fresh token on a CSRF-style 401.
- **401 vs 403 are distinct**: 401 → session-expired redirect (`/session-expired?next=…`); 403 → access-denied screen, never a logout.
- **Safe errors only**: the client normalizes errors (`src/lib/api/error.ts`). Raw 5xx/database/stack messages are never rendered; 4xx `detail` is shown only for validation-style payloads, structured field errors win over generic text.
- **Public identifiers in URLs only**: agency/course/order/product routes use UUIDs/slugs (`agencyPublicId()`). Internal numeric ids are *never* placed in a URL (IB-1).
- **Route guards are UX, not security**: `RequireAuth`/`AccessDenied` mirror server rules; the backend stays authoritative.
- **Request correlation**: every request carries a unique `X-Request-Id` so audit correlation only needs the backend to persist it.
- **No secrets in the repo**: only `NEXT_PUBLIC_*` values and dev-proxy settings exist, all documented in `.env.example`.

## Testing

```bash
npm test             # Vitest: api client (CSRF/401/normalization), query retry policy,
                     # guards, session restore, dashboard routing, auth page RTL flows
npm run test:e2e     # Playwright. e2e/smoke.spec.ts runs without a backend;
                     # all other specs self-skip unless a live backend answers on
                     # E2E_BASE_URL and E2E_EMAIL/E2E_PASSWORD are provided.
```

E2E environment variables are documented in `.env.example` and `docs/DEPLOYMENT.md`.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — folder structure and patterns
- [`docs/ROUTE_MAP.md`](docs/ROUTE_MAP.md) — routes + role/permission map
- [`docs/INTEGRATION_BLOCKERS.md`](docs/INTEGRATION_BLOCKERS.md) — IB-1 … IB-5, what the backend must provide
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — build, env, proxy and release checklist