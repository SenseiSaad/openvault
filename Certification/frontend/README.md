# Certification Academy LMS — Frontend

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind · TanStack Query · React Hook Form + Zod · Vitest/RTL · Playwright.

Institutional training platform frontend for U.S. government agencies: public catalogue, agency administration (members, invitations, seats, orders, billing), learner portal (learning, assessments, certificates, profile) and platform administration (agencies, catalog publishing, pricing, entitlements).

## Status: integrated and verified against the real backend (2026-10-18)

The frontend is wired to the Certification Academy API in
`/home/saad/Desktop/Certification/cpmi-backend` (Express + MySQL). All feature flags are enabled in
`.env.local`; there is **no mock data** in any screen. Verified flows:

- **Auth** — login/session restore, password reset, invitation acceptance; `/auth/me` returns the
  public agency list (uuid/slug/name/role) the agency-scoped UI needs.
- **Agency admin** — dashboard (real reports + audit feed), members, invitations (pending/revoked),
  seats/entitlements (assign/release/reassign), orders + detail, billing portal, catalogue, checkout
  (card → Stripe Checkout; invoice), team report with server-generated CSV/PDF exports.
- **Learner** — dashboard, my learning, course player with backend-delivered lesson content and
  server-side progress, assessments (start/resume, answer, submit, score + feedback), certificate
  vault with PDF download, profile.
- **Platform** — overview (revenue/completion/pass-rate), agencies, catalog versions, products and
  price updates, entitlements (revoke), audit log with server-side filtering.
- **Public** — catalogue, certificate verification page (`/verify?token=…`).

`docs/INTEGRATION_BLOCKERS.md` now records the integration and the backend additions it required.

## Quick start (frontend + backend)

```bash
# 1. Backend (separate terminal)
cd /home/saad/Desktop/Certification/cpmi-backend
cp .env.example .env        # dev defaults work with the project MySQL container
npm install && npm run db:up && npm run db:provision
npm run dev                 # API on http://localhost:4000

# 2. Frontend
cd /home/saad/Desktop/OpenVault/Certification/frontend
npm install
cp .env.example .env.local  # set BACKEND_PROXY=true, BACKEND_ORIGIN=http://localhost:4000,
                            # and the NEXT_PUBLIC_FEATURE_* flags to true
npm run dev                 # http://localhost:3000
```

`BACKEND_PROXY=true` rewrites `/api/*` to the backend so the session and CSRF cookies stay
first-party. No secrets are stored in the frontend.

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
- **401 vs 403 are distinct**: 401 → session-expired redirect (`/session-expired?next=…`); 403 → access-denied screen, never a logout. The initial anonymous `/auth/me` probe and public pages never trigger the redirect.
- **Safe errors only**: the client normalizes errors (`src/lib/api/error.ts`). Raw 5xx/database/stack messages are never rendered; 4xx `detail` is shown only for validation-style payloads, structured field errors win over generic text.
- **Agency URLs use the public UUID** supplied by `/auth/me`. Internal numeric ids appear only as opaque, server-authorized path parameters for memberships/invitations/seats/entitlements; they are never used to scope a query without the agency UUID.
- **Route guards are UX, not security**: `RequireAuth`/`AccessDenied` mirror server rules; the backend stays authoritative.
- **Request correlation**: every request carries a unique `X-Request-Id` so audit correlation only needs the backend to persist it.
- **No secrets in the repo**: only `NEXT_PUBLIC_*` values and dev-proxy settings exist, all documented in `.env.example`.

## Testing

```bash
npm run typecheck    # strict TypeScript, 0 errors
npm test             # Vitest: api client (CSRF/401/normalization), query retry policy,
                     # guards, session restore, dashboard routing, auth page RTL flows — 43 tests
npm run build        # production build, 32 routes
```

Live end-to-end verification (2026-10-18) ran against the real backend with the in-memory Stripe
gateway: learner login → lesson content + completion → assessment start/answer/submit (100%) →
certificate issued → public `/verify?token=…`; agency admin dashboard/members/seats/reports/audit;
platform overview/agencies/products/audit. Playwright specs remain available for a seeded live
environment (`E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — folder structure and patterns
- [`docs/ROUTE_MAP.md`](docs/ROUTE_MAP.md) — routes + role/permission map
- [`docs/INTEGRATION_BLOCKERS.md`](docs/INTEGRATION_BLOCKERS.md) — integration record and resolved backend contracts
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — build, env, proxy and release checklist