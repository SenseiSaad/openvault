# Integration blockers

No backend exists on this machine — the frontend was built against the documented contracts only. Every route below is marked `INTEGRATION-UNVERIFIED` at its call site. **Verification steps**: confirm path, method, payload and response shape; fix the typed model in the matching `features/*/api.ts`; run `npm run typecheck && npm test`; then remove the marker.

Verified today: **auth contracts** (`GET /api/auth/csrf|me`, `POST /api/auth/login|logout`, password reset, `POST /api/invitations/accept`) and **`GET /api/store/products`**. Everything else is a blocker.

## IB-1 — Public agency identifiers in `/api/auth/me`

**Need** — per membership (in `GET /api/auth/me` or `GET /api/me/agencies`):

```json
{ "agencies": [ { "uuid": "…", "slug": "…", "name": "…", "role": "agency_admin" } ] }
```

**Why**: agency-scoped URLs must never be built from internal numeric ids. Until `slug`/`uuid` arrive, `agencyPublicId()` returns `null`, agency pages render `PublicIdBlocker`, and the selector hides those memberships.

**Frontend**: `src/features/auth/types.ts` (contract comment), `agency-context.tsx`, `agency-selector.tsx`.

## IB-2 — Agency administration endpoints

Expected (all scoped by the **public** agency id, all under cookie session + CSRF):

| Method | Route | Used by |
| --- | --- | --- |
| GET | `/api/agencies/{id}/overview` | `/agency` |
| GET/PATCH | `/api/agencies/{id}/members` · `/members/{memberUuid}` | members page (role change, suspend/reactivate) |
| GET/POST | `/api/agencies/{id}/invitations` · `…/{invUuid}/revoke` | invitations page |
| GET | `/api/agencies/{id}/entitlements` | seats page |
| GET | `/api/agencies/{id}/seats`, POST `/api/seats/{uuid}/release|assign` | seats page |
| GET | `/api/agencies/{id}/orders`, GET `/api/orders/{orderUuid}` | orders |
| GET | `/api/agencies/{id}/billing` | billing page (or a hosted portal URL) |

**Verify**: pagination envelope matches `Paginated<T>` (`items/total/page/page_size/pages`) or adapt `src/lib/api/types.ts`.

## IB-3 — Bulk invitations & checkout

- `POST` bulk CSV invitations (flag `NEXT_PUBLIC_FEATURE_BULK_INVITATIONS`).
- `GET /api/store/products/{productId}` (single product) and `POST /api/orders` with `{ product_uuid, quantity }` — checkout page exists at `/agency/checkout/[productId]` but renders the integration boundary while `NEXT_PUBLIC_FEATURE_STORE_CHECKOUT=false`.
- Confirm order → entitlement/seat fulfilment semantics before enabling the flag.

## IB-4 — Learner LMS endpoints

Flag `NEXT_PUBLIC_FEATURE_LEARNER_LEARNING` (also gates player):

- `GET /api/me/enrollments` — dashboard & my-learning lists
- `GET /api/courses/{id}` + `GET /api/courses/{id}/lessons/{id}` — overview/player
- `POST …/progress` — mark lesson complete (UI: optimistic update + rollback, already built)
- Assessments (`NEXT_PUBLIC_FEATURE_LEARNER_ASSESSMENTS`): `GET /api/me/assessments`, attempt submit endpoints
- Certificates (`NEXT_PUBLIC_FEATURE_LEARNER_CERTIFICATES`): `GET /api/me/certificates` (+ download link)
- Profile: `GET/PATCH /api/me/profile` (profile page calls it today — returns honest error state until it exists)

## IB-5 — Platform administration endpoints

All under `/api/platform/*` (`src/features/platform/api.ts`), super_admin/TM only:

- `GET /platform/stats` — overview cards
- `GET /platform/agencies`, `GET /platform/agencies/{uuid}`, `PATCH …/{uuid}` (suspend/reactivate)
- `GET /platform/courses`, `GET …/{uuid}/versions`, `POST …/{uuid}/versions`, `POST /platform/course-versions/{uuid}/publish`
- `GET /platform/products`, `PATCH /platform/products/{uuid}` (price/status)
- `GET /platform/entitlements`, `PATCH /platform/entitlements/{uuid}`
- `GET /platform/audit-log` (flag `NEXT_PUBLIC_FEATURE_PLATFORM_AUDIT_LOG`) — server-side pagination/filtering; persist the `X-Request-Id` the frontend already sends on every mutation for audit correlation

## Rules while blockers stand

1. **No mock data** — flagged screens show `IntegrationPending`/`PublicIdBlocker`; unflagged screens show real API errors/empty states.
2. **Public ids only** in any URL or path parameter.
3. Flags default `false`; enabling one is an env change (`NEXT_PUBLIC_FEATURE_*=true`), never a code edit.
4. Every fix lands with a test (`npm test`) and `npm run typecheck` clean.