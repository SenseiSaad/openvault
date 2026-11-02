# ADR 0002 — Serve web and API from one origin

**Status:** accepted

## Context

OpenVault authenticates with HttpOnly cookies. Splitting the frontend and API
across `www.` and `api.` requires CORS credentials, cookie `Domain` settings,
and a CSRF strategy that survives third-party-cookie restrictions. It also
makes local/prod behavior differ.

## Decision

One ALB, one hostname, path routing:

* `/api/*`, `/admin/*`, `/static/*` → API target group
* everything else → Next.js target group

`NEXT_PUBLIC_API_URL` is empty in the Docker build, so the browser uses
`window.location` as the API origin.

## Consequences

* Cookies are first-party; no CORS credentials or wildcard origins.
* One certificate, one DNS record, one smoke-test base URL.
* The Next.js container must be able to render pages without knowing a
  separate API hostname; relative `/api` calls work in the browser.
* A future split to `api.` is a deliberate migration, not a config tweak.
