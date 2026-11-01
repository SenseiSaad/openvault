# Runbook — Bad deploy rollback

**Symptom:** error rate spike after a deploy, migrations that fail, or a
feature regression reported within minutes of a release.

## 1. Decide rollback vs forward-fix

Rollback if users are blocked and the fix is not a one-liner. Forward-fix if
the damage is cosmetic and a corrected image is <30 minutes away.

## 2. Roll back the image (the part that usually fixes it)

The compose stack tags every built image. On the app host:

```bash
docker image ls | grep openvault          # find the previous image id
# pin the previous image in docker-compose.prod.yml (image: <id>) or:
git checkout <previous-release-tag>
docker compose -f docker-compose.prod.yml build api worker web
docker compose -f docker-compose.prod.yml up -d
```

The 2×4 gunicorn api comes back in seconds; the worker resumes indexing.

## 3. Roll back the database schema (the careful part)

Migrations run as a separate deploy step (`docker compose run --rm api python
manage.py migrate`), NOT at container start — so a rolled-back image may be
NEWER than the schema (fine) or the schema may be newer than the image
(needs a reverse migration).

```bash
docker compose -f docker-compose.prod.yml run --rm api python manage.py showmigrations core | tail
# only if the last migration has a real reverse:
docker compose -f docker-compose.prod.yml run --rm api python manage.py migrate core <previous_migration_name>
```

Never hand-reverse a data migration. If the schema change is destructive and
unreversible, restore last night's DB instead (`restore.md`) and accept the
RPO.

## 4. Verify

* `/api/health` 200; Sentry error rate back to baseline within 10 minutes.
* One real login + upload + ask.

## 5. Prevention habits

* Every deploy: `manage.py check` + test suite in CI (already enforced).
* Migrations always forward-compatible for one release (add columns, don't
  rename in place).
* Keep the previous release tag handy — this runbook assumes you can name it.
