# Alert rules

The minimum alert set for launch. Where the check lives: uptime monitors
(Better Stack / UptimeRobot free tier), Sentry (email on new issue), and the
app host's cron + logs. Each rule names the runbook to open.

| # | Alert | Trigger | Severity | Action / runbook |
|---|---|---|---|---|
| 1 | **Site down** | `GET https://<host>/api/health` fails (non-200) from an external monitor, 2 checks in a row (1 min) | Critical | `database-down.md` if `"db": false`; `disk-full.md` if `"storage": false`; `bad-deploy-rollback.md` right after a deploy |
| 2 | **Backup failed** | `scripts/backup.sh` cron exit ≠ 0, or no new object in `s3://…/backups/postgres/` in the last 26h | Critical | Do NOT wait — an untested/missing backup means every later incident is unrecoverable. Check pg_dump stderr, disk, AWS credentials. See `restore.md` |
| 3 | **Error spike** | Sentry: new issue in production release, or 5xx rate >1% over 5 min (count `ERROR` level JSON logs) | High | If it started with a deploy → `bad-deploy-rollback.md`; otherwise triage the Sentry stack trace |
| 4 | **Slow answers** | Ask time-to-first-token p95 > 5s for 15 min (measure from AskLog `latency_ms` or Sentry performance) | High | `ai-provider-down.md`; check provider status page and recent corpus growth |
| 5 | **Stuck documents** | `indexing_status='pending'` with `updated_at` older than 30 min (Celery beat `requeue_stuck_documents` requeues them and logs a warning; alert on the log line or on requeue count > 0 sustained 2 runs) | Medium | Worker down → `docker compose ps worker` + restart; then `manage.py requeue_stuck_documents` |
| 6 | **Disk > 80%** | `df` on the app host (cron one-liner emailing at the threshold) | Medium | `disk-full.md` before it becomes #1 |
| 7 | **Embeddings degrading** | `manage.py check_embeddings` exits non-zero (cron nightly) | High | `ai-provider-down.md` §3 (silent keyword-only mode) |
| 8 | **Budget alarm** | AWS Budgets at $20/$35/$50, or provider billing alert | Medium | Check for runaway ask volume (a leaked key or F-05-style abuse); Bedrock/Gemini consoles show per-model spend |

## Wiring notes

* The monitor must hit `/api/health` from OUTSIDE the network (that is the
  whole point) — status `degraded` returns 503, which is the signal.
* Sentry: set an alert rule "New issue in production" → email; that is rule 3.
* AskLog-based checks (4, 5) are one SQL query each; a small cron script on
  the app host is enough at this scale — Prometheus is not justified yet.
* Test every alert by firing it on purpose after wiring (kill the db container
  for a minute, remove the backup env var once, etc.). An alert you have never
  seen fire is a rumor, not a rule.
