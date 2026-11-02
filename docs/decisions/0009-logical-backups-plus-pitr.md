# ADR 0009 — RDS PITR plus nightly logical dumps

**Status:** accepted

## Context

A single backup mechanism is a single point of failure. RDS snapshots restore
the whole instance; a logical dump is portable and can restore one table into a
scratch database.

## Decision

* RDS automated backups/PITR: 14 days in prod, 1 day in staging.
* Nightly EventBridge → ECS `backup` task runs `scripts/backup.sh`
  (`pg_dump -Fc`) to the versioned S3 backups bucket, lifecycle to Standard-IA
  after 30 days and expiry at 90 days.
* `scripts/restore.sh` is for scratch/partial restores, not the first production
  recovery step.
* The local restore drill is recorded in `docs/runbooks/restore.md`; the RDS
  snapshot-restore RTO is measured on the first real drill.

## Consequences

* Two recovery paths with different RPOs (PITR ~5 min; logical up to 24 h).
* Backup bucket versioning + lifecycle protects against accidental deletion and
  controls cost.
* A backup task failure must be alerted; CloudWatch cannot detect “no new
  object” by itself, so add a freshness check before launch.
