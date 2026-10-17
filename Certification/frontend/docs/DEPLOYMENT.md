# Deployment

## Build

```bash
cd frontend
npm ci
npm run typecheck
npm test
npm run build
npm run start            # serves .next on PORT (default 3000)
```

Node.js ≥ 20 recommended (Next 15 / React 19).

## Environment

All configuration is public — see `.env.example`. Nothing secret ever ships in this app:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Leave empty to keep `/api` same-origin (recommended). |
| `NEXT_PUBLIC_ENVIRONMENT` | Label shown in shells (`production` disables dev error details). |
| `NEXT_PUBLIC_FEATURE_*` | Feature flags; keep `false` until the matching IB is verified. |
| `BACKEND_PROXY` / `BACKEND_ORIGIN` | Dev-server `/api/:path*` rewrite. In production use the reverse proxy below instead. |

`NEXT_PUBLIC_*` values are inlined at **build time** — set them before `npm run build`.

## Wiring the API (production)

Preferred: a single origin. Put the app behind a reverse proxy that routes:

```
/            → next (node server)
/api/*       → backend (preserving cookies, stripping nothing)
```

Example (nginx):

```nginx
location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id      $request_id;  # optional; frontend also sends its own
}
location / {
    proxy_pass http://next:3000;
}
```

Why same-origin: the session and CSRF cookies stay first-party (SameSite=Lax works, no CORS preflight, no `SameSite=None` weakening). If the API *must* be on another origin, set `NEXT_PUBLIC_API_BASE_URL` and configure CORS (`credentials`, exact origin) plus `SameSite=None; Secure` cookies on the backend.

`next.config.mjs` also supports `BACKEND_PROXY=true` for local/dev proxies; prefer the reverse proxy in production.

## Security headers (recommended at the edge)

```
Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains   # HTTPS only
```

(Adjust `connect-src` if `NEXT_PUBLIC_API_BASE_URL` points elsewhere; `frame-ancestors 'none'` replaces X-Frame-Options.)

## Sessions & CSRF (backend requirements)

- Session cookie: `HttpOnly; Secure; Path=/; SameSite=Lax` (same-origin setup).
- CSRF: double-submit via `GET /api/auth/csrf` + `X-CSRF-Token` on every mutation — already implemented client-side.
- 401 = unauthenticated (client redirects to `/session-expired`), 403 = authenticated but unauthorized (client shows access-denied, does **not** log out).

## Release checklist

1. `.env.local`/CI env matches the target environment; all `NEXT_PUBLIC_FEATURE_*` still `false` unless the corresponding blocker in `docs/INTEGRATION_BLOCKERS.md` is verified.
2. `npm run typecheck && npm test && npm run build` green.
3. Smoke the public routes: `/`, `/login`, `/catalogue` (real `GET /api/store/products`).
4. With a live backend: `E2E_BASE_URL=… E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e` (backend-gated specs activate automatically).
5. Verify `/api/auth/me` returns public agency ids (IB-1) or agency screens will correctly show the integration blocker.

## Rollback

The frontend is stateless (no localStorage tokens, no DB). Redeploy the previous build; sessions live entirely in the backend's cookies.