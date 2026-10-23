#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
MEDIA_ROOT="${MEDIA_ROOT:-/app/media}"
mkdir -p "$DATA_DIR" "$MEDIA_ROOT/forms"

# A mounted Render disk may hide the image-layer ownership. Make only the app
# data paths writable, then run migrations and the web process unprivileged.
chown app:app "$DATA_DIR" "$MEDIA_ROOT" "$MEDIA_ROOT/forms" 2>/dev/null || true
exec gosu app "$@"
