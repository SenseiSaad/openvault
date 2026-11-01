# Runbook — Disk full

**Symptom:** `/api/health` 503 with `"storage": false`; uploads fail with
"Storage quota for your plan is full" for every tenant; Postgres logs show
"No space left on device"; backups fail.

## 1. Find what filled it

```bash
df -h                                    # which mount
docker system df -v                      # images/containers/volumes
docker compose -f docker-compose.prod.yml exec api sh -c 'du -sh /app/data /app/media/* 2>/dev/null | sort -h'
docker compose -f docker-compose.prod.yml logs db 2>&1 | grep -c "No space left"
```

The usual suspects, in order: Docker build cache and old images, Postgres WAL
accumulation (a long-idle replica or a stuck backup), `/app/media/forms`
(leave-form .docx files accumulate forever), `/app/data` (uploaded documents).

## 2. Safe space to reclaim, roughly in this order

```bash
docker image prune -af                                   # build cache, old images
docker builder prune -af
docker compose -f docker-compose.prod.yml exec api \
  sh -c 'find /app/media/forms -mtime +90 -delete'       # generated forms >90d
docker compose -f docker-compose.prod.yml restart db     # recycles WAL after space is free
```

Do NOT delete anything under `/app/data` by hand — that is tenant content.
Document storage is per-tenant S3 prefixes in the AWS layout; there the fix
is lifecycle rules, not manual deletion.

## 3. Growth cap (do this the same day)

* Move document storage to S3 (the code already supports it:
  `AWS_STORAGE_BUCKET_NAME`), so `/app/data` shrinks to nothing.
* Add a lifecycle rule on the S3 forms prefix (expire after 90 days).
* Size the disk at ≥3× current DB size; alert at 80% (see `alerts.md`).

## 4. Verify

* `/api/health` → 200 with `"storage": true`.
* Upload one test document as a tenant admin; delete it; confirm the audit
  rows and no error page.

## 5. If Postgres data was corrupted by the full disk

Stop the db container, snapshot the volume for forensics, restore from last
night's backup per `restore.md`.
