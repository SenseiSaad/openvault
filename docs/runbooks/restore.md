# Runbook — Database restore

**RPO / RTO:** RDS automated backups are retained **14 days** in prod with
point-in-time recovery (PITR), so the production RPO is ~5 minutes and a
snapshot/PITR restore to a new instance typically takes **30–60 minutes**
(UNVERIFIED until measured in your account). The nightly logical `pg_dump` is a
second, independent path with a 24-hour RPO for scratch/export work.

`scripts/restore.sh` is **destructive by design**: it drops and recreates the
target database. Never point it at production unless you are deliberately
recovering in place.

## What exists

| Piece | Location | Notes |
|---|---|---|
| RDS automated backups | AWS RDS console → Maintenance & backups | 14-day retention, PITR. Preferred production recovery path. |
| Nightly logical dump | ECS task `openvault-prod-backup`, cron `30 20 * * ? *` UTC | `scripts/backup.sh` → `s3://<backups-bucket>/backups/postgres/YYYY/MM/`. |
| Restore script | `scripts/restore.sh` | S3 or local archive, drop/create, `pg_restore`, ensure `vector`. |
| Backup logs | CloudWatch `/openvault/prod/backup` | A failed task does not retry automatically; alert is in `alerts.md`. |
| Documents | S3 documents bucket, versioned | Independent of the database. |

## Verified local drill (2026-11-02)

Run against a scratch `pgvector/pgvector:pg16` container, not AWS:

* Seeded `500` rows in a table with a `vector(3)` column + HNSW index.
* `backup.sh`: **200 ms**, custom-format archive **8 KB**.
* `restore.sh` into a second database: **444 ms**.
* Post-restore: `rows=500`, `vector extension=1`, HNSW index present.
* Result: the logical dump round-trips data, pgvector values, and the index.

This proves the scripts and archive format. It is **not** an AWS RTO test;
record the first real RDS snapshot-restore duration in this section when you
run it. Re-run the local drill monthly and update the date/numbers.

## Production recovery — preferred: RDS PITR

1. **Declare the incident and freeze writes.** Scale the API and worker to zero:
   `aws ecs update-service --cluster openvault-prod-cluster --service api --desired-count 0`
   (repeat for `worker`). Leave `web` up; it will show errors.
2. In **RDS → Databases → openvault-prod-postgres → Maintenance & backups →
   Restore to point in time**, choose the last known-good timestamp and create
   a **new** instance (do not overwrite the original).
3. Wait for `Available`; note the new endpoint. Security group and parameter
   group are copied by RDS.
4. Update the SSM parameter `/openvault/prod/DATABASE_URL` to the new endpoint
   (keep `?sslmode=require`), then run the **Terraform apply** workflow so the
   task definitions pick up the new secret ARN/version, followed by the
   **Deploy** workflow for the current SHA (or a one-off `update-service`).
5. Scale `worker` and `api` back to 1; watch `/api/health` until
   `"db": true, "storage": true`, then run `scripts/smoke_test.sh` with the
   production smoke account.
6. Keep the old instance until you have verified data and completed a
   postmortem, then delete it (it bills hourly).

## Production recovery — logical dump (scratch or export)

Use this when you need one tenant/table, not a whole-instance recovery.

1. Find the newest object:
   `aws s3 ls s3://<backups-bucket>/backups/postgres/ --recursive | sort | tail`
2. Restore into a **scratch** database first. From a host with VPC access (or a
   temporary ECS task with the api image), set
   `DATABASE_URL=postgresql://.../<scratch>?sslmode=require` and run:
   `BACKUP_S3_BUCKET=<bucket> ./scripts/restore.sh backups/postgres/2026/11/<file>.dump`
3. Verify: `python manage.py check && python manage.py check_embeddings`, then
   export the rows you need and re-insert into production (respect FKs and
   `on_delete=CASCADE`).
4. Never restore directly over production without a fresh RDS snapshot first.

## Verify after any restore

* `/api/health` → 200 with `"db": true` and `"storage": true`.
* `python manage.py check_embeddings` exits 0.
* One real login, one document list, one `/api/ask` with sources.
* Record the actual RPO (last recoverable timestamp) and RTO (incident start to
  healthy) in the postmortem.

## Data-loss boundaries (be honest)

* RDS PITR: ~5-minute RPO; logical dumps: up to 24 hours.
* `AskLog` is pruned at 90 days by design; older question history is gone.
* S3 versioning protects document bytes, not database rows.
* A restore to a new RDS instance does **not** restore ElastiCache: rate-limit
  windows and Celery queues are intentionally ephemeral.
