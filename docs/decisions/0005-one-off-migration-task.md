# ADR 0005 — Migrations run as a one-off ECS task

**Status:** accepted

## Context

Running `migrate` at container start races multiple API tasks and can leave a
new image serving against a half-migrated schema. The deploy must stop before
updating services if the migration fails.

## Decision

`scripts/deploy_ecs.sh`:

1. registers new task-definition revisions (api/worker/web/migrate/backup);
2. runs a **separate** `migrate` task using the API image and the API service
   network configuration;
3. waits for it to stop and fails the deploy on a nonzero exit;
4. only then updates `api`, `worker`, and `web`.

Serving containers never run migrations. Rollback (`SKIP_MIGRATE=1`) does not
run migrations, because the schema is forward-only in practice.

## Consequences

* A bad migration leaves the old services untouched.
* The migration log is `/openvault/<env>/migrate`.
* Rollback images must be compatible with the current schema; additive
  migrations are required for one-release rollback safety.
* A migration that takes longer than the deploy timeout is an operational
  problem; run it manually with a one-off task if needed.
