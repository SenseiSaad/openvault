# Load tests (k6)

Scripts take the target as an env var — same scripts run local or staging.

## Local (docker compose)
```bash
docker compose -f docker-compose.prod.yml up -d      # or dev compose
SQLITE_PATH=/tmp/ov-load.sqlite3 backend/.venv/bin/python backend/manage.py seed_loadtest
BASE=http://localhost:8000 USER=load@openvault.test PASS=loadtest-pass k6 run loadtests/ask.js
BASE=http://localhost:8000 k6 run loadtests/browse.js
```

## Staging (after infra apply + first deploy)
```bash
export BASE=https://<staging-domain>
export USER=<staging load user> PASS=<staging load password>
k6 run loadtests/ask.js       # streaming: TTFT + full duration + error rate
k6 run loadtests/browse.js    # reads: documents page, me, usage
```

Seed the staging load tenant the same way (`manage.py seed_loadtest` via ECS
exec or a one-off task). Results go in docs/loadtest-results.md — label every
row `local` or `staging` and keep them honest; do not mix.
