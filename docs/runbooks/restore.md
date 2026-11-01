# Runbook — Database restore (RTO 4h / RPO 24h)

**Destructive by design.** `scripts/restore.sh` drops and recreates the target
database. Read this whole page before running anything against production.

## What exists

| Piece | Location | Notes |
|---|---|---|
| Backup script | `scripts/backup.sh` | `pg_dump -Fc` → local dir, and to S3 when `BACKUP_S3_BUCKET` is set; prunes >`RETENTION_DAYS` (30). |
| Restore script | `scripts/restore.sh` | Fetches from S3 or a local file, drop+create, `pg_restore`, reinstalls the vector extension. |
| Nightly schedule | cron `30 3 * * *` on the app host (see script header) | Wire the alert on failure per `alerts.md`. |

## Verified restore drill (2026-11-01)

* Source: the `pgvector/pg16` container seeded by `scripts/verify_pgvector.py`.
* Command: `DATABASE_URL=...openvault_restore ./scripts/restore.sh drill.dump`
* Result: restore completed in **1 second** (104 KB archive, 6 tables).
* Verification: row counts identical on every table, including
  `chunks_with_vec = 3` — the pgvector column contents round-trip inside the
  pg_dump archive.

Re-run the drill monthly against a scratch database and update this table
with the new date, size and duration.

## Production restore procedure

1. **Freeze writes**: stop the api + worker services
   (`docker compose -f docker-compose.prod.yml stop api worker`) — the web
   frontend stays up; the site will show errors, say so in your status notice.
2. Pick the newest intact archive:
   `aws s3 ls s3://$BACKUP_S3_BUCKET/backups/postgres/ --recursive | sort`
3. Point `DATABASE_URL` at the target (or a scratch DB first, recommended),
   then:
   `DATABASE_URL=... BACKUP_S3_BUCKET=... ./scripts/restore.sh backups/postgres/2026/11/openvault-db-<stamp>.dump`
4. Run `python manage.py check && python manage.py check_embeddings` against
   the restored database.
5. Bring services back (`start api worker`), watch `/api/health` until it
   reports `ok`, then verify a real login + one `/api/ask`.
6. Write a short postmortem: when the loss started, which archive covered it
   (that is your real RPO), and how long the restore took (your real RTO).

## If the primary host is dead entirely

1. Provision a fresh EC2 from the Terraform/AMI, or point DNS at the standby.
2. Restore the database per above onto the new RDS/instance.
3. Documents/files live in S3 (`s3://<bucket>/<company-slug>/…`) — nothing to
   restore if the bucket is intact; if it is not, restore from S3 versioning
   or cross-region replication (enable both — see PRODUCTION_CHECKLIST.md).

## Data-loss boundaries (be honest about them)

* RPO with nightly dumps = up to 24h of AskLog rows and document metadata.
* Document FILES in S3 have independent durability — the DB is the thing to
  restore.
* `AskLog` is pruned at 90 days by design; older question history is gone
  regardless of backups.
