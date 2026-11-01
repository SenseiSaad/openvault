# Runbook — Database down

**Symptom:** `/api/health` returns 503 with `"db": false`; Sentry shows
`OperationalError`/`psycopg2.OperationalError`; users see 500s on every page.

## 1. Triage (2 minutes)

```bash
docker compose -f docker-compose.prod.yml ps db          # is the container up?
docker compose -f docker-compose.prod.yml logs db --tail 50
docker compose -f docker-compose.prod.yml exec db pg_isready -U openvault
```

* Container restarting → look for OOM (`docker inspect` → `OOMKilled`) or a
  corrupt volume; skip to step 3.
* Container up but refusing connections → Postgres may be in recovery; watch
  the logs for "database system is ready to accept connections".

## 2. Most common causes, in order

| Cause | Giveaway | Fix |
|---|---|---|
| Disk full on the DB volume | "No space left on device" in logs | See `disk-full.md`, then restart db |
| Bad migration half-applied | migrate errors in api logs, "relation does not exist" | `python manage.py migrate` from api after fixing; never hand-edit |
| Connection exhaustion | "too many clients already" | Restart api (clears pools) or raise `max_connections`; check for a leaked worker loop |
| Volume/container gone | `docker ps -a` empty | Recreate compose stack; **data lives on the named volume `ov_pgdata` — do not run `docker compose down -v`** |

## 3. Recovery

```bash
docker compose -f docker-compose.prod.yml restart db
# or, if the container is unrecoverable, restore from last night's backup:
#   see docs/runbooks/restore.md  (stop api+worker first)
```

## 4. Verify

* `/api/health` → 200 with `"db": true`.
* Log in with a real account, run one `/api/ask`.

## 5. Escalation

If RDS/managed Postgres is used instead of the container, the same symptoms
map to the provider console: check events, failover, and storage metrics
before touching the app.
