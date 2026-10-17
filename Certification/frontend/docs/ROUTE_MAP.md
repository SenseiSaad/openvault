# Route map

Access column shows which roles the *frontend* gates for UX. The backend is always authoritative; anonymous visitors are bounced to `/login?next=<path>` from any protected route, and an authenticated user without the required role lands on `/access-denied`.

Role shorthand: **SA** super_admin · **TM** training_manager · **AA** agency_admin · **LR** learner.

## Public (no session required)

| Route | Purpose | Notes |
| --- | --- | --- |
| `/` | Landing | links to catalogue + sign-in |
| `/login` | Sign-in (RHF+Zod) | generic 401 message, `?next=` safe redirect, `?expired=true` banner |
| `/forgot-password` | Reset request | neutral confirmation — never discloses account existence |
| `/reset-password` | Reset confirm | requires `?token=`; password policy 12+/upper/lower/digit |
| `/accept-invitation` | Invitation acceptance | requires `?token=`; new account → auto session → dashboard |
| `/catalogue` | Public product catalogue | **verified** `GET /api/store/products` |
| `/privacy`, `/terms`, `/accessibility` | Legal / a11y statements | static |
| `/session-expired?next=` | Session expiry landing | reached from the global 401 listener |
| `/access-denied` | Unauthorized landing | `AccessDenied` screen |
| `not-found` / `error` | 404 / recovery | root level |

## Agency portal — `(agency)` — `RequireAuth(AA, SA)`

Nav: Agency overview · Members · Invitations · Seats & entitlements · Training catalogue · Orders · Billing

| Route | Purpose | Integration |
| --- | --- | --- |
| `/agency` | Overview stat cards | IB-2 `GET /api/agencies/{id}/overview` |
| `/agency/members` | Member table, role change, suspend/reactivate | IB-2 |
| `/agency/invitations` | Invite, pending/revoked tabs, revoke, bulk CSV (flag `bulkInvitations`) | IB-2/IB-3 |
| `/agency/seats` | Entitlements, release/reassign seats | IB-2 |
| `/agency/catalogue` | Products list | **verified** store endpoint; purchase CTA gated by `storeCheckout` |
| `/agency/orders` · `/agency/orders/[id]` | Orders list/detail (`[id]` = public uuid) | IB-2 |
| `/agency/billing` | Billing portal link or honest pending state | IB-2 |
| `/agency/checkout/[productId]` | Seat purchase form (`[productId]` = uuid/slug) | IB-3 — page exists, renders integration boundary while `storeCheckout=false` |

The agency shell shows `PublicIdBlocker` when `/api/auth/me` exposes no public agency id (IB-1).

## Learner portal — `(learner)` — `RequireAuth` (any authenticated role)

Nav: Dashboard · My learning · Certificates · Assessments · Profile

| Route | Purpose | Integration |
| --- | --- | --- |
| `/learner` | Dashboard (flagged enrollment cards + static help) | IB-4 |
| `/learner/learning` | Enrollment list | flag `learnerLearning` |
| `/learner/learning/[courseId]` | Course overview (`[courseId]` = public id) | flag `learnerLearning` |
| `/learner/learning/[courseId]/player` | Lesson player, optimistic mark-complete | flag `learnerLearning` |
| `/learner/assessments` | Quizzes/attempts | flag `learnerAssessments` |
| `/learner/certificates` | Certificates | flag `learnerCertificates` |
| `/learner/profile` | `GET/PATCH /api/me/profile` | IB-4 (profile endpoints unverified) |

## Platform portal — `(platform)` — `RequireAuth(SA, TM)`

Nav: Overview · Agencies · Courses & versions · Products & pricing · Entitlements · Audit & operations

| Route | Purpose | Integration |
| --- | --- | --- |
| `/platform` | Fleet-wide stat cards | IB-5 |
| `/platform/agencies` · `/platform/agencies/[id]` | Agency directory, suspend/reactivate (`[id]` = public uuid) | IB-5 |
| `/platform/catalog` | Courses, draft versions, publish workflow | IB-5 |
| `/platform/products` | Products & per-seat pricing editor | IB-5 |
| `/platform/entitlements` | Cross-agency seat grants, adjust/revoke | IB-5 |
| `/platform/audit` | Audit & operations | flag `platformAuditLog`; default = explicit pending state |

## Post-login landings (`dashboardForRole`)

| Roles | Landing |
| --- | --- |
| SA, TM | `/platform` |
| AA | `/agency` |
| LR (default) | `/learner` |

## URL identifier rules

- `agency`, `order`, `course`, `product`, `entitlement` route params are **public uuid/slug only**, regex-validated (`Not found` otherwise) — never internal numeric ids (IB-1).
- List state lives in `?page=&q=` (shareable, restores on refresh).