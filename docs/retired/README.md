# Retired deployment configs (archived 2026-11-01)

The project previously carried FOUR parallel deployment targets. That made
"what is actually running?" unanswerable and split LLM/environment defaults
between stacks. One path is now canonical:

> **AWS: single EC2 (ap-south-1) running `docker-compose.prod.yml`
> (Caddy TLS + gunicorn api + Celery worker + Postgres + Redis),
> documents in S3, frontend served by the compose `web` container.**
> PostgreSQL and S3 are env-swappable to RDS later (DATABASE_URL /
> AWS_STORAGE_BUCKET_NAME) with zero code change.

Everything here is kept for reference, NOT wired to CI. Do not deploy from
these files without re-validating them against current settings.

| Archived file | Was | Why retired |
|---|---|---|
| `render.yaml` | Render blueprint (Django + disk) | Replaced by the EC2 compose stack; Render's 1-worker sizing was a production availability risk. |
| `amplify.yml` | Amplify static-frontend build | Frontend now ships as the standalone Next.js container from the same compose stack. |
| `backend-vercel.json`, `backend-vercelignore.txt`, `backend-api-vercel/index.py` | Vercel serverless Django entry | WSGI-on-serverless forced SYNC_INDEXING and a second storage backend; the EC2 path removes both. |
| `frontend-vercel.json` | Vercel frontend config | Same. |
| `env.vercel.example` | Vercel env template | Superseded by `.env.production.example`. |
