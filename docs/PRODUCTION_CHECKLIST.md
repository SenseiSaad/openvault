# Production checklist

Single canonical deployment: **AWS EC2 (ap-south-1) + `docker-compose.prod.yml`**
(Caddy TLS · gunicorn api · Celery worker · PostgreSQL · Redis), documents in
S3. Copy `.env.production.example` → `.env.production`, fill EVERY value below,
then run `sudo ./deploy/deploy.sh`. No secret values belong in this file or in
git.

## 1. Required secrets (no defaults — generate before first deploy)

| Variable | What it is | How to generate |
|---|---|---|
| `DOMAIN` | Public hostname Caddy serves TLS for | your DNS A record |
| `SECRET_KEY` | Django signing key (JWT cookies, admin sessions) | `python -c "import secrets; print(secrets.token_urlsafe(50))"` — **back it up**; rotation invalidates sessions |
| `LLM_KEY_ENCRYPTION_KEY` | Fernet key for tenant LLM API keys at rest | same generator — **back it up separately**; losing it loses stored BYO keys |
| `POSTGRES_PASSWORD` | Database password | same generator |
| `BOOTSTRAP_PLATFORM_ADMIN_EMAIL` / `_PASSWORD` | First root admin (no company, all-tenant) | strong password; **enroll TOTP on first login — the API forces it** |
| `BEDROCK_API_KEY` (or none) | Bedrock bearer token — omit entirely on EC2 and let the IAM instance role authenticate (preferred) | IAM role, not a key |

## 2. AI provider

| Variable | Notes |
|---|---|
| `LLM_PROVIDER` | `bedrock` (default, India inference profile) or `gemini` for lower cost on Free/Starter. `fake` is refused at production boot. |
| `BEDROCK_REGION` / `BEDROCK_MODEL` / `BEDROCK_EMBED_MODEL` | `ap-south-1` / `in.anthropic.claude-haiku-4-5-…` / `amazon.titan-embed-text-v2:0` |
| `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | only if that provider is the platform default or tenants BYO via UI (encrypted at rest) |
| `EMBED_PROVIDER`, `EMBED_DIM` | must match the chat provider's embedder; **changing either requires `manage.py reindex_embeddings`** |

## 3. Database / cache / queue

| Variable | Notes |
|---|---|
| `POSTGRES_DB/USER/PASSWORD/HOST` | compose defaults to the `db` service; for RDS set `DATABASE_URL` instead |
| `CACHE_URL` | `redis://redis:6379/1` (rate limits + counters) |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` (indexing + beat jobs) — the `worker` service must be running |

## 4. Email (SES via SMTP)

| Variable | Notes |
|---|---|
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` |
| `EMAIL_HOST` / `EMAIL_PORT` | `email-smtp.ap-south-1.amazonaws.com` / `587` |
| `EMAIL_USE_TLS` or `EMAIL_USE_SSL` | TLS for 587, SSL for 465 — exactly one true |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SES SMTP credentials (IAM, not root keys) |
| `DEFAULT_FROM_EMAIL` | an identity VERIFIED in SES (`no-reply@yourdomain`) |
| `REQUIRE_EMAIL_VERIFICATION` | `true` once SMTP works |

SES setup: verify the domain (SPF/DKIM records), request **production access**
(sandbox blocks real recipients), monitor bounce/complaint rates.

## 5. Storage (S3)

| Variable | Notes |
|---|---|
| `AWS_STORAGE_BUCKET_NAME` | enables S3 document storage + presigned uploads |
| `AWS_S3_REGION_NAME` | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | only needed OFF AWS; on EC2 prefer the instance role (leave blank) |
| Bucket settings | Block Public Access ON, default encryption SSE-S3, versioning ON (deletion recovery), lifecycle: expire `forms/` after 90d |

## 6. Networking / headers

| Variable | Notes |
|---|---|
| `TRUSTED_PROXY_COUNT` | `1` (Caddy on this host). Set to the real proxy count — wrong value breaks rate-limit identity and audit IPs |
| `ALLOWED_HOSTS` | explicit hostnames only; production boot refuses `*` |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | exact frontend origin(s), https |
| `PUBLIC_BASE_URL` | used in emailed links and QR targets — must be the real https origin |
| `COOKIE_SECURE` | `true`; boot refuses insecure cookies with `ENVIRONMENT=production` unless `ALLOW_INSECURE_HTTP=true` (dev only) |

## 7. Observability / operations

| Variable | Notes |
|---|---|
| `SENTRY_DSN` | Sentry project DSN (errors + perf traces) |
| `LOG_FORMAT=json`, `LOG_LEVEL=INFO` | structured logs with request IDs |
| Backup cron | `30 3 * * *` → `scripts/backup.sh` with `DATABASE_URL` + `BACKUP_S3_BUCKET`; alert on failure (`docs/runbooks/alerts.md` rule 2) |
| `check_embeddings` cron | nightly; non-zero exit = embedding degradation |
| Budgets | AWS Budgets alarms at $20/$35/$50 |

## 8. First-deploy order

1. DNS A record → EC2 public IP; security group: 80/443 in, SSH from your IP.
2. `cp .env.production.example .env.production`; fill sections 1–7.
3. `sudo ./deploy/deploy.sh` (build → migrate one-shot → up → health verify).
4. `docker compose -f docker-compose.prod.yml exec api python manage.py
   create_platform_admin "$BOOTSTRAP_PLATFORM_ADMIN_EMAIL"` (or rely on the
   bootstrap in the migrate step), log in, **complete TOTP enrollment**.
5. Verify: `/api/health` `{"status":"ok","db":true,"storage":true}`; register a
   test company; upload a PDF; ask one question; check Sentry receives a test
   event; confirm tonight's backup cron will fire.
6. Monthly: restore drill per `docs/runbooks/restore.md` (update the table
   there with the date + duration).
