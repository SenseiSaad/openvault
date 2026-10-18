# Integration record

**Status: resolved (2026-10-18).** The frontend runs against the real Certification Academy API in
`/home/saad/Desktop/Certification/cpmi-backend`. Feature flags are enabled in `.env.local`; there is
no mock data. This document records what was verified and the backend additions the UI required.

## Verified end to end

| Area | Routes used | Result |
| --- | --- | --- |
| Auth | `GET /api/auth/csrf|me`, `POST /api/auth/login|logout`, password reset, `POST /api/invitations/accept` | Login/restore, role redirect, generic errors |
| Request shape | `/api/auth/me` and login include `agencies: [{uuid, slug, name, role}]` | Agency selector + scoped URLs work |
| Agency admin | `overview`, `members` (+ status/role), `invitations` (status filter, revoke), `entitlements`, `seats`, `seats/:id/release|reassign`, `orders` (+ detail), `billing-portal`, `store/products` (+ detail), `reports/learners(.csv|.pdf)`, `audit-log` | Real dashboard/members/invitations/seats/orders/reports |
| Checkout | `POST /api/agencies/:id/orders` (price × quantity, `card`/`invoice`) | Card → Stripe Checkout URL; invoice → order recorded |
| Learner | `GET /api/me/enrollments` (+ detail, lessons), `POST /api/me/progress`, assessments start/answers/submit, `GET /api/me/certificates`, `GET/PATCH /api/me/profile` | Lesson content, server-side progress, 100% grading, certificate + PDF, profile |
| Platform | `/api/platform/stats`, `agencies`, `courses` (+ versions/create/publish), `products` (price update), `entitlements` (revoke), `reports/*`, `audit-log`, `observability` | Overview, directories, publishing, pricing, audit |
| Public | `GET /api/store/products` (+ detail), `GET /api/public/certificates/verify?token=` | Anonymous catalogue and certificate verification |

## Backend additions made for the UI

- `/api/auth/me` + login now return the public agency list and role codes.
- `GET|PATCH /api/me/profile` (new `users.job_title`, migration `0010`).
- Public storefront (`GET /api/store/products` and `/:publicId` no longer require a session).
- `GET /api/agencies/:id/overview`, `GET /api/agencies/:id/seats`, `GET /api/agencies/:id/audit-log`.
- `GET /api/platform/stats|agencies|courses|products|entitlements` plus the supported mutations.
- `GET /api/platform/reports/*` and `GET /api/platform/observability` (already built for slices 9–10).

## Deliberate UI/API conventions

- Agency URLs use the **public UUID** from `/auth/me`. Memberships, invitations, seats and
  entitlements are addressed by their backend ids as opaque path segments; every call is
  server-authorized and agency-scoped, and internal ids are never used to scope a query.
- Entitlement seat counts are immutable by schema design; the platform UI shows them read-only and
  offers revocation. Additional seats are purchased as a new order.
- Score policy is recorded per assessment version; reports show the highest graded score and a pass
  is any graded passing attempt (see the backend `AGENTS.md`).
- The HTTP cache is disabled for API calls (`cache: "no-store"`) so an authenticated `304` can never
  be mistaken for an error; the anonymous `/auth/me` probe never triggers the session-expired redirect.

## Remaining non-blocking gaps

- The Playwright suite still requires a seeded live environment; the manual/scripted browser run above
  covered the main role flows.
- Card checkout ends at the Stripe-hosted page; completing payment requires real/test Stripe keys and
  the signed webhook. The backend suite exercises fulfilment with an in-memory gateway.
- Email delivery requires Gmail SMTP credentials (or another `Mailer`); the UI only depends on the
  notification being queued.
