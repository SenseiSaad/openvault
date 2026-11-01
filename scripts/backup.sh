#!/usr/bin/env bash
# OpenVault database backup: pg_dump -> compressed archive -> S3 (optional).
#
#   ./scripts/backup.sh                          # uses DATABASE_URL from env
#   DATABASE_URL=postgres://... ./scripts/backup.sh
#
# With AWS cli + credentials configured it uploads to
#   s3://$BACKUP_S3_BUCKET/backups/postgres/<YYYY>/<MM>/<name>
# and prunes archives older than $RETENTION_DAYS (default 30) from the bucket.
# Without AWS it leaves the archive in $BACKUP_DIR (default ./backups) — same
# code path a cron job on the app server would use.
#
# Cron (nightly 03:30 server time):
#   30 3 * * * DATABASE_URL=... BACKUP_S3_BUCKET=... /opt/openvault/scripts/backup.sh >> /var/log/openvault-backup.log 2>&1
set -euo pipefail

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"

: "${DATABASE_URL:?DATABASE_URL is required (the postgres connection string)}"

mkdir -p "$BACKUP_DIR"
ARCHIVE="$BACKUP_DIR/openvault-db-$STAMP.dump"

echo "[backup] dumping database to $ARCHIVE"
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$ARCHIVE"

SIZE=$(du -h "$ARCHIVE" | cut -f1)
echo "[backup] done ($SIZE): $ARCHIVE"

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  S3_KEY="backups/postgres/$(date -u +%Y)/$(date -u +%m)/$(basename "$ARCHIVE")"
  echo "[backup] uploading to s3://$BACKUP_S3_BUCKET/$S3_KEY"
  aws s3 cp "$ARCHIVE" "s3://$BACKUP_S3_BUCKET/$S3_KEY"

  echo "[backup] pruning archives older than $RETENTION_DAYS days"
  CUTOFF=$(date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%d) || CUTOFF=""
  if [[ -n "$CUTOFF" ]]; then
    aws s3 ls "s3://$BACKUP_S3_BUCKET/backups/postgres/" --recursive \
      | awk -v cutoff="$CUTOFF" '{ d=$1; if (d < cutoff) print $4 }' \
      | while read -r key; do
          [[ -n "$key" ]] && echo "[backup] removing $key" && \
            aws s3 rm "s3://$BACKUP_S3_BUCKET/$key"
        done
  fi
fi

echo "[backup] complete: $ARCHIVE"
