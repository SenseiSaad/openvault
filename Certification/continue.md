# Certification Academy LMS — Frontend Build Progress

**Project root:** `/home/saad/Desktop/Certification/frontend` (Next.js 15 App Router, React 19, TypeScript strict, Tailwind, Radix-based primitives, TanStack Query, RHF+Zod, Vitest/RTL, Playwright)

**Important context:** No backend exists anywhere on this machine (`/home/saad/Desktop/Certification` was empty; no LMS backend found elsewhere). Per requirements, the frontend is built against the documented API contracts (auth + `/api/store/products` + "agency, member, invitation, order, entitlement, seat, billing and catalog endpoints under /api"), with every unverified route marked `INTEGRATION-UNVERIFIED` and tracked in `docs/INTEGRATION_BLOCKERS.md`. No mock data anywhere; unimplemented backend capabilities are behind feature flags (`src/config/feature-flags.ts`) rendering explicit "integration pending" boundaries.

## COMPLETED

### Scaffolding & config
- `package.json` (all deps installed, npm install exit 0), `tsconfig.json` (strict, `noUncheckedIndexedAccess`), `tailwind.config.ts`, `postcss.config.mjs`, `next.config.mjs` (optional `/api` proxy to backend via `BACKEND_PROXY=true` + `BACKEND_ORIGIN`)

### Core lib (`src/lib`, `src/config`)
- `lib/api/client.ts` — single typed API client: `credentials:"include"`, CSRF token lazily fetched from `GET /api/auth/csrf`, `X-CSRF-Token` on all mutations (single retry with fresh token on CSRF-style 401), `X-Request-Id` per request, 401 → notifies listeners (session-expired redirect), 403 ≠ logout, safe error normalization (never renders raw 5xx/backend internals), abort-signal support
- `lib/api/error.ts` (`ApiError`, status/code/fieldErrors, `safeMessageForStatus`), `lib/api/types.ts` (`Paginated<T>`, `ListQuery`), `lib/query-client.ts` (retry only safe queries, mutations never retried)
- `config/env.ts` (public env only), `config/feature-flags.ts` (learnerLearning, learnerAssessments, learnerCertificates, storeCheckout, platformAuditLog, bulkInvitations — all default false), `lib/utils.ts` (cn, formatters, humanizeEnum)

### UI system (`src/components/ui`, `src/components/common`)
- Primitives: button, input, label, card, badge, table, dialog, dropdown-menu, select, skeleton, spinner, textarea, form-message, confirm-dialog, tabs, alert
- Common: `error-boundary`, `empty-state`, `page-header`, `data-table` (URL-synced `?page=&q=` pagination/search), `status-badge` (icon + color, never color alone), `app-shell` (sidebar+mobile nav, prominent role display, skip link), `integration-boundaries` (`IntegrationPending`, `PublicIdBlocker`)
- `app/globals.css` — design tokens (institutional navy palette, WCAG AA), visible focus, reduced-motion support, skip-link utility

### Auth feature (`src/features/auth`)
- `roles.ts`, `types.ts` (AgencyMembership with uuid/slug/name/role; **IB-1: never URLs from numeric agency ids**; `agencyPublicId()` helper), `api.ts` (csrf/me/login/logout/password-reset request+confirm/invitations accept), `dashboard-for-role.ts`
- `session-context.tsx` (GET /api/auth/me on start, refresh, signOut), `agency-context.tsx` (multi-agency selection, sessionStorage persistence re-validated against backend-reported agencies), `agency-selector.tsx`, `guards.tsx` (`RequireAuth` w/ roles + redirect w/ safe `?next=`, `AccessDenied`)

### App shell & providers
- `app/layout.tsx`, `app/providers.tsx` (QueryClient → SessionProvider → AgencyProvider → Toaster; global 401 listener → `/session-expired?next=`)

### Public area (`src/app/(public)`)
- Landing page, public layout, **login** (RHF+Zod, generic 401 message, role-based redirect, already-signed-in handling, expired-session banner), **forgot-password** (never discloses account existence), **reset-password** (token required, password rules), **accept-invitation** (new-account → auto session + dashboard; existing-account → backend response shown + sign-in; expired/revoked/used → calm non-disclosing error), **session-expired**, **access-denied**, **catalogue** (real `GET /api/store/products`), privacy/terms/accessibility pages
- Root `not-found.tsx`, `error.tsx` (recovery screen)

### Agency admin portal (`src/app/(agency)/layout.tsx` + `agency/**`, `src/features/agency/api.ts`)
- Layout: RequireAuth(agency_admin|super_admin), AgencySelector in topbar, PublicIdBlocker when backend gives no public agency id
- Pages: overview (stat cards), **members** (DataTable, role change dialog, suspend/reactivate ConfirmDialog), **invitations** (pending/revoked tabs, invite dialog, revoke ConfirmDialog, bulk-CSV behind flag), **seats** (entitlements cards, release/reassign with confirmation), **catalogue** (verified store endpoint, purchase CTA gated by storeCheckout flag), **orders** + **orders/[id]** (public uuid only, format-validated), **billing** (portal URL link or honest pending state)
- All endpoint calls marked INTEGRATION-UNVERIFIED (IB-2)

### Learner portal (`src/app/(learner)/layout.tsx` + `learner/**`)
- Layout: RequireAuth, learner nav
- Dashboard (enrollment cards gated by flags + static help copy), **my learning** (gated, real fetch when enabled), course overview `[courseId]` (public id validated), **course player** (lesson nav, optimistic mark-complete with rollback, fully behind flag), assessments (flagged), certificates (flagged), **profile** (GET/PATCH /api/me/profile, real form)

## IN PROGRESS
- (none — platform admin portal completed: `src/app/(platform)/layout.tsx` + all pages under `src/app/(platform)/platform/` (overview, agencies + [id], catalog, products, entitlements, audit) and `src/features/platform/api.ts` with INTEGRATION-UNVERIFIED models (IB-5))

## COMPLETED SINCE LAST UPDATE
- **Premium Enterprise Redesign**:
  - Installed and configured `framer-motion`, `recharts`, `cmdk`, `canvas-confetti`, `@radix-ui/react-tooltip`, `@radix-ui/react-avatar`, `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `@radix-ui/react-accordion`, `@radix-ui/react-switch`.
  - **Design System**: Slate-50 low-fatigue canvas (`#F8FAFC`), pure white cards (`#FFFFFF`) with Slate-200 hairline borders (`#E2E8F0`), electric sapphire/indigo primary (`#4F46E5`), Google Fonts `Inter` + `Plus_Jakarta_Sans`, layered shadows (`shadow-card`, `shadow-card-hover`, `shadow-glow`), and custom thin scrollbars.
  - **Motion Utilities** (`src/components/motion`): `FadeIn`, `StaggerContainer`, `StaggerItem`, `CountUp` (animated tabular numbers), celebration confetti (`canvas-confetti`).
  - **New UI & Layout Components**: `CommandMenu` (global `⌘K` palette), `Breadcrumbs` (route-aware), `Avatar`, `Tooltip`, `Progress`, `ScrollArea`, `Separator`, `Accordion`, `Switch`, `Command`.
  - **Dashboard Modules** (`src/components/dashboard`): `StatCard` (with CountUp and trend badges), `WelcomeBanner`, `QuickActions`, `ActivityTimeline`, and responsive Recharts (`SeatUtilizationChart`, `ComplianceRateChart`).
  - **Course & Learning Components** (`src/components/learning`): `CourseCard`, `CertificateCard`, `fireCelebration`.
  - **Full Page Redesigns**:
    - **Public Landing Page**: Frosted glass sticky navbar, hero mesh background, animated metrics strip, bento capabilities cards, call-to-action banner.
    - **Login**: Split-screen enterprise layout (branding showcase with accreditation highlights + elevated sign-in card).
    - **App Shell**: Collapsible desktop sidebar, user initials avatar, `⌘K` command search bar, breadcrumbs, drawer mobile nav.
    - **Agency Admin Dashboard**: Welcome banner, CountUp stat cards, area chart (seat utilization), bar chart (compliance rates), quick operations, live audit timeline.
    - **Learner Dashboard**: Progress milestone hero, course cards, certificate vault link, collapsible accordion training guide.
    - **Course Player**: Curriculum outline sidebar, progress bar, interactive viewer shell, confetti celebration on lesson completion.
    - **Data Tables**: Rounded-xl shadow-card container, row hover transitions, search input with clear trigger, refined pagination bar.
    - **Catalogue**: Rich certified product cards with gradient banners, seat rate pills, and pagination.
    - **Platform Overview**: Fleet metrics, Recharts charts, and administrative module actions.
  - **Verification**: `npx tsc --noEmit` -> 0 errors, Vitest **43/43 tests passing across all 9 test suites**, `next build` -> all 32 routes prerendered green.

## REMAINING
1. Backend integration & flag enablement per `docs/INTEGRATION_BLOCKERS.md` (IB-1 … IB-5) — no backend exists on this machine
2. Playwright e2e against a live backend (`E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`); `e2e/smoke.spec.ts` runs standalone

## Conventions to preserve
- Feature-first: `features/<x>/{api,hooks,schemas}.ts`; pages thin
- All agency/course scoping uses **public slug/uuid only** (`agencyPublicId()`; validate `[id]` params with regex, else "Not found")
- Toasts via sonner; safe `ApiError.message` only; submit buttons disabled while `isPending`
- Mutations: no retry, invalidate affected keys on success
- Statuses always via `StatusBadge` (icon + text)
