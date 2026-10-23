#!/usr/bin/env bash
# Create a local archive of the configured database and uploaded/generated files.
# For Render production, prefer the provider's managed Postgres backups and disk
# snapshots; this helper is intended for operator-run exports/migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
SQLITE_PATH="${SQLITE_PATH:-$ROOT/backend/db.sqlite3}"
DATA_DIR="${DATA_DIR:-$ROOT/backend/data}"
MEDIA_ROOT="${MEDIA_ROOT:-$ROOT/backend/media}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$BACKUP_DIR" "$STAGE/files"

if [[ -n "${DATABASE_URL:-}" ]]; then
  command -v pg_dump >/dev/null || { echo 'pg_dump is required when DATABASE_URL is set' >&2; exit 1; }
  PGDATABASE="$DATABASE_URL" pg_dump --format=custom --no-owner --no-acl --file="$STAGE/database.dump"
elif [[ -f "$SQLITE_PATH" ]]; then
  cp "$SQLITE_PATH" "$STAGE/database.sqlite3"
else
  echo "No database found (set DATABASE_URL or SQLITE_PATH)." >&2
  exit 1
fi

[[ ! -d "$DATA_DIR" ]] || cp -a "$DATA_DIR" "$STAGE/files/data"
[[ ! -d "$MEDIA_ROOT" ]] || cp -a "$MEDIA_ROOT" "$STAGE/files/media"

ARCHIVE="$BACKUP_DIR/openvault-$STAMP.tar.gz"
tar -C "$STAGE" -czf "$ARCHIVE" .
echo "Created backup archive: $ARCHIVE"
