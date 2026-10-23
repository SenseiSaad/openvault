# OpenVault deployment: Amplify + Render + Cloudflare

## Chosen launch topology

| Component | Host | Public address |
| --- | --- | --- |
| Next.js frontend | AWS Amplify Hosting, static export | `https://openvault.saadops.site` |
| Django API | Render Web Service | `https://api.saadops.site` |
| PostgreSQL | Render Postgres, private connection | Render internal database URL |
| Uploaded files/generated forms | Render persistent disk, Oregon (US West) | Not directly public |
| AI chat + embeddings | Google Gemini API | Called by Django only; `GEMINI_API_KEY` stays in Render |
| DNS | Cloudflare | DNS-only CNAME records initially |

**Billing boundary:** AWS Activate credits can cover eligible AWS Amplify
charges. They do **not** cover the Render API, database, persistent disk, or
Gemini API charges. Amazon Bedrock/ECS/ECR remain future AWS deployment options;
the AWS roadmap elsewhere in the project is retained as future architecture.

## Why Amplify uses a static export

This repo uses Next.js 16.3.3. AWS's current Amplify managed Next.js SSR support
lists versions through Next.js 15. The current app has no Next API routes,
Server Actions, request-time cookies, or other server-only page dependencies;
its routes already prerender at build time. `next.config.mjs` therefore declares
`output: 'export'` explicitly by default, which lets Amplify detect the app as
Next.js SSG. The optional Docker/Compose frontend sets `DOCKER_STANDALONE=true`
to emit a standalone Next server instead.

Static export means **no Next.js server-side rendering at Amplify**. Any feature
that later requires request-time server rendering must either be redesigned for
the static app, use a Next version supported by Amplify SSR, or move the Next
server to a compatible host.

## Amplify setup

1. Push the repository to GitHub/GitLab/Bitbucket and create an Amplify Hosting
   app connected to the repository and deployment branch.
2. Enable **My app is a monorepo** and set the app root to `frontend`.
   `amplify.yml` already uses the monorepo `applications` schema and exports
   `frontend/out`.
3. If the console does not set it automatically, add this Amplify environment
   variable:

   ```text
   AMPLIFY_MONOREPO_APP_ROOT=frontend
   ```

4. The public API origin is in `amplify.yml`:

   ```text
   NEXT_PUBLIC_API_URL=https://api.saadops.site
   ```

   This is a public URL, not a secret. It is compiled into the frontend at
   build time. If the API host changes, update the value and redeploy Amplify.
5. Build command: `pnpm run build` (the build spec installs pinned
   `pnpm@12.3.4`). Build artifact directory: `out`.
6. Deploy once before adding the custom domain and check the Amplify-generated
   `amplifyapp.com` URL. Test deep links such as `/pricing/` and
   `/infrastructure/` by directly refreshing them.

### If Amplify fails after a successful build

A build that ends with:

```text
CustomerError: Can't find required-server-files.json in build output directory
```

means the Amplify app/branch is still registered as **Next.js SSR**
(`WEB_COMPUTE`). The build itself produced the static `out/` directory, but
Amplify tried to deploy it as an SSR app. Existing apps must be converted to
SSG once; newly created apps should detect SSG automatically because
`frontend/next.config.mjs` now declares `output: 'export'`.

From AWS CloudShell (or any shell with AWS credentials for the account), run:

```bash
aws amplify update-app \
  --app-id YOUR_AMPLIFY_APP_ID \
  --platform WEB \
  --region YOUR_AWS_REGION

aws amplify update-branch \
  --app-id YOUR_AMPLIFY_APP_ID \
  --branch-name main \
  --framework 'Next.js - SSG' \
  --region YOUR_AWS_REGION
```

Then open **Hosting → Rewrites and redirects** in the Amplify console and
delete any SSR rewrite rule left from the failed SSR setup. Trigger a new
deployment. If the app has no data worth preserving, deleting and recreating it
after the static-export commit is an alternative that lets Amplify detect SSG
from the start.

The same repository is connected to both hosts: Amplify uses `frontend/` as
its monorepo app root; Render uses the repository root as its Docker context
and `backend/Dockerfile` as its Dockerfile. Do not create separate Git repos or
move the backend into the Amplify build.

## Render setup

1. Open the existing PostgreSQL instance in the Render Dashboard. For this
   launch the database is `openvault` and the database user is
   `openvault_user`. Copy the **Internal Database URL** from the database's
   **Connections** section. Do not create a second database from the Blueprint.
2. In Render, create a **Blueprint** from this repository and select the root
   `render.yaml`. It defines the Django Docker service, Oregon (US West) region, and a
   10 GB persistent disk for the app's filesystem-backed uploads. It builds
   `backend/Dockerfile` with the repository root as its Docker context; do not
   set Render's root directory to `backend/`.
3. When Render prompts for `DATABASE_URL`, paste the internal database URL.
   If the web service already exists, open it, go to **Environment**, and set
   `DATABASE_URL` there as a secret. The service and database must be in the
   same Render region for the internal URL to resolve; if they are in different
   regions, use the external URL with SSL and add the connection to the
   database's IP allowlist.
4. The service starts at a Render-generated URL, usually shaped like
   `https://openvault-api.onrender.com`; use the exact hostname shown in the
   Render Dashboard. The preferred final URL is `https://api.saadops.site`.
5. The service stores uploads at `/var/data/documents` and generated files at
   `/var/data/media`. Migrations and plan seeding run when the container starts.
6. Set `GEMINI_API_KEY` as a **secret** environment variable in Render. The
   Blueprint marks it `sync: false`; no provider key is committed.
7. Configure SES SMTP credentials if SES is ready for production sending.
   Email verification is enabled, so configure and test email before public
   registration. For the present launch, `LLM_PROVIDER=gemini`,
   `GEMINI_MODEL=gemini-2.5-flash`, and Gemini embeddings are selected by the
   Blueprint. Bedrock remains available as a later AWS option, not required for
   the Render launch.

### Render environment values

The Blueprint supplies non-secret production settings. Render generates
`SECRET_KEY` and `LLM_KEY_ENCRYPTION_KEY`. `DATABASE_URL` is not generated; it
must contain the existing Render Postgres connection string. Enter these
secrets in Render's environment screen:

| Key | Value / handling |
| --- | --- |
| `DATABASE_URL` | Internal connection string for the existing Render Postgres database. Store it as a secret; never commit it. |
| `GEMINI_API_KEY` | Secret from Google AI Studio / Google AI API credentials. Required for chat and Gemini embeddings. |
| `EMAIL_HOST_USER` | SES SMTP username for `ap-south-1`, if sending verification/reset emails through SES. |
| `EMAIL_HOST_PASSWORD` | Matching SES SMTP password; store as a Render secret. |

The database password appears in the connection string, so do not paste that
URL into `render.yaml`, GitHub, issue trackers, screenshots, or chat. Rotate the
database password if it has already been shared outside the Render dashboard.
Keep `GEMINI_API_KEY` off Amplify—anything named `NEXT_PUBLIC_*` is
browser-visible. The `LLM_PROVIDER`, `GEMINI_MODEL`, `GEMINI_EMBED_MODEL`, and
`EMBED_PROVIDER` values in `render.yaml` select Gemini for the initial
server-side provider. A `LLMConfig` row saved later from workspace settings can
override environment defaults.

If testing before custom domains are ready, temporarily add the exact Amplify
branch hostname to `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` in Render.
Remove that temporary origin once `openvault.saadops.site` is verified.

### Creating the web service manually

If you use Render's **New Web Service** screen instead of the Blueprint, use
these values:

| Field | Value |
| --- | --- |
| Language / runtime | **Docker** |
| Branch | `main` |
| Region | Same region as the database (Oregon / US West for this launch) |
| Root Directory | Leave blank (repository root) |
| Dockerfile Path | `./backend/Dockerfile` |
| Compute | `1c-2g` recommended; `0.5c-512mb` is the minimum |
| Health Check Path | `/api/health` |
| Docker Command | Leave blank (the image entrypoint starts gunicorn) |
| Persistent Disk | Name `openvault-files`, mount `/var/data`, 10 GB |

Do not set Root Directory to `backend/`. The Dockerfile copies from
`backend/` relative to the repository root, so the build context must remain
the repository root.

### Render disk limitation

The document/media disk is attached to one Render service instance. It prevents
horizontal scaling and zero-downtime deploys. For a small first launch this is a
simple persistent option; before adding replicas or requiring higher
availability, migrate files to shared object storage and test the migration and
restore path. The database is PostgreSQL, not the checked-in local SQLite file.
The first Render deployment creates an empty database; moving any existing local
users/documents requires a deliberate export/import and reindex.

Create the single platform administrator after the first successful deploy
using Render's service shell. Use the production admin email; the command
prompts for a password without echoing it, or generates a random one if you
submit a blank password:

```text
python manage.py create_platform_admin YOUR_ADMIN_EMAIL
```

Do not put the admin email or password in `render.yaml`, GitHub, or Amplify
environment variables. If the account already exists, use the command's
`--promote` option instead of creating a second user. OpenVault is intended to
operate with one platform administrator; create tenant users through the normal
invite/registration flow rather than adding more platform admins.

> Use a unique, strong password for the production admin even if the local
> development database uses a simpler one. The local SQLite database is ignored
> by Git; it is never shipped to Amplify or Render.

## Cloudflare DNS setup

### Frontend: `openvault.saadops.site`

1. In Amplify, open **Hosting → Custom domains**, add `saadops.site`, and map the
   production branch to the subdomain label `openvault`.
2. Amplify will show the required certificate-validation and traffic CNAME
   records. Add those exact values in Cloudflare DNS. Do not guess the target.
3. Set the records to **DNS only** (grey cloud) during validation and leave
   them DNS-only for the simplest certificate and cache behavior.

### Backend: `api.saadops.site`

1. In the Render service, open **Settings → Custom Domains** and add
   `api.saadops.site`.
2. Render will show the exact CNAME target (usually the service's
   `onrender.com` hostname) and any verification record. Copy those values to
   Cloudflare DNS, use **DNS only**, and remove conflicting A/AAAA records for
   `api` if present.
3. Wait for Render's domain verification and TLS certificate status to become
   ready. Then confirm that `https://api.saadops.site/api/health` returns an OK
   response.

Do not create an A record using a guessed Render IP. Render's exact target comes
from the service dashboard. Keep the AWS-provided Amplify CNAME and Render's API
CNAME as separate records.

## Cross-origin auth and security settings

The API uses HttpOnly cookies and the frontend sends requests with
`credentials: 'include'`. The Render Blueprint sets:

```text
CORS_ALLOWED_ORIGINS=https://openvault.saadops.site
CSRF_TRUSTED_ORIGINS=https://openvault.saadops.site,https://api.saadops.site
COOKIE_SECURE=true
DEBUG=false
```

The frontend and API use different origins but share the same registrable
domain (`saadops.site`), allowing the secure `SameSite=Lax` API cookie to be
sent on credentialed requests. Do not set `CORS_ALLOW_ALL_ORIGINS=true`.

## Email before public onboarding

The Render Blueprint expects SMTP using Amazon SES in `ap-south-1`. Before
inviting users:

1. Verify `saadops.site` as an SES identity and enable DKIM in SES.
2. Publish the exact SES verification/DKIM records in Cloudflare DNS.
3. Request SES production sending access (new SES accounts may start in the
   sandbox).
4. Create SES SMTP credentials for `ap-south-1` and enter them in Render's
   secret environment variables.
5. Test verification and password-reset messages before opening registration.

If SMTP isn't ready, do not treat the service as public-launch ready: the
console email backend does not deliver user email. If you must open registration
temporarily before SES is configured, set `REQUIRE_EMAIL_VERIFICATION=false` in
Render, test the account flow, then restore it to `true` as soon as email works.

## Smoke-test checklist

- [ ] Amplify deployment uses the `frontend` monorepo root and publishes `out/`.
- [ ] `openvault.saadops.site` opens over HTTPS and deep links survive refresh.
- [ ] `api.saadops.site/api/health` responds successfully over HTTPS.
- [ ] Login/refresh/logout work cross-origin with cookies; browser CORS errors
      are absent.
- [ ] File uploads and generated files survive a Render redeploy (test this
      before real customer data).
- [ ] Postgres backup/restore and Render disk snapshot/restore are understood.
- [ ] Gemini test connectivity succeeds, then run one cited-answer test.
- [ ] SES verification and reset mail arrive before inviting real users.
- [ ] AWS Budget alerts are set for Amplify. Render and Gemini spending are
      monitored separately in Render.
