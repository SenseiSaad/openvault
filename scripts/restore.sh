#!/usr/bin/env bash
# OpenVault database restore: load a pg_dump archive into a (re)created DB.
#
#   ./scripts/restore.sh backups/openvault-db-20261101T000000Z.dump
#   BACKUP_S3_BUCKET=... ./scripts/restore.sh backups/postgres/2026/11/openvault-db-....dump
#       # fetches the object from S3 first (needs aws cli + credentials)
#
# DATABASE_URL must point at the TARGET database. The database is dropped and
# recreated, so this is destructive by design — see docs/runbooks/restore.md
# before running anything against production.
set -euo pipefail

ARCHIVE="${1:?usage: restore.sh <archive.dump|s3-key>  (DATABASE_URL must be set)}"
: "${DATABASE_URL:?DATABASE_URL is required (target database connection string)}"

START=$(date +%s)

# s3:// or a bare key: download first.
if [[ "$ARCHIVE" == s3://* || ( -n "${BACKUP_S3_BUCKET:-}" && ! -f "$ARCHIVE" ) ]]; then
  S3_URL="$ARCHIVE"
  case "$ARCHIVE" in
    s3://*) ;;
    *) S3_URL="s3://$BACKUP_S3_BUCKET/$ARCHIVE" ;;
  esac
  mkdir -p "$(pwd)/backups"
  ARCHIVE="$(pwd)/backups/restore-$(date +%s).dump"
  echo "[restore] fetching $S3_URL -> $ARCHIVE"
  aws s3 cp "$S3_URL" "$ARCHIVE"
fi

[[ -f "$ARCHIVE" ]] || { echo "[restore] archive not found: $ARCHIVE" >&2; exit 1; }

# Target DB name is the path component of DATABASE_URL.
DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
[[ -n "$DB_NAME" ]] || { echo "[restore] could not read a database name from DATABASE_URL" >&2; exit 1; }

ADMIN_URL="${DATABASE_URL%/*}/postgres"

# Drop/create must run while connected to a DIFFERENT database.
echo "[restore] dropping and recreating database '$DB_NAME'"
psql --dbname="$ADMIN_URL" -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" \
  -c "CREATE DATABASE \"$DB_NAME\";"

echo "[restore] loading $ARCHIVE"
pg_restore --dbname="$DATABASE_URL" --no-owner --no-acl --exit-on-error "$ARCHIVE"

echo "[restore] ensuring pgvector extension (vector columns restore from the dump)"
psql --dbname="$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" \
  || echo "[restore] WARNING: could not create vector extension — check pgvector is installed"

END=$(date +%s)
echo "[restore] complete in $((END - START))s"
echo "[restore] verify: python manage.py check && python manage.py check_embeddings"
