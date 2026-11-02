# ADR 0003 — RDS PostgreSQL 16 + pgvector, ElastiCache Redis

**Status:** accepted

## Context

OpenVault needs vector retrieval, relational tenant data, a cache, rate-limit
counters, and a Celery broker. The live site runs Postgres/Redis in containers.

## Decision

* **RDS PostgreSQL 16** with pgvector, encryption at rest, forced SSL, automated
  backups, deletion protection in prod. The master password is managed by RDS
  in Secrets Manager; the app receives a `DATABASE_URL` from SSM.
* **ElastiCache Redis 7** single node in a private subnet for cache, Redis-backed
  per-user/plan rate limits, and Celery. At-rest encryption and snapshots on.

## Consequences

* Managed backups/failover primitives exist; no database container to patch.
* Single-AZ RDS and single-node Redis are intentional launch cost choices;
  Multi-AZ is the first resilience upgrade when revenue justifies it.
* Data is in `ap-south-1`, not in a local Render disk.
* Logical restores are still tested (`docs/runbooks/restore.md`); RDS PITR is
  the preferred production recovery path.
