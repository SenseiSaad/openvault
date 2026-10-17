#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenVault local launcher
#
#   ./run.sh            start API + web, then open them in the browser
#   ./run.sh stop       stop both servers
#   ./run.sh restart    stop, then start again
#   ./run.sh status     show which ports are up
#
#   API  (Django)  -> http://localhost:8000   landing page, /admin/, /api/
#   Web  (Next.js) -> http://localhost:3000   product app
#
# The frontend finds the API automatically on the same host, port 8000.
#
# Fix included: on Linux, `next dev` can crash with
#   Error [TurbopackInternalError]: Too many open files (os error 24)
# because the per-user inotify instance cap (fs.inotify.max_user_instances,
# default 128) is already full from editors/terminals. This script detects
# that and silently falls back to webpack + polling file-watching, which needs
# no inotify handles at all.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export VOLTA_HOME="$HOME/.volta"
[ -s "$VOLTA_HOME/bin" ] && export PATH="$VOLTA_HOME/bin:$PATH"
if [ -s "$HOME/.local/share/fnm/fnm" ]; then
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$($HOME/.local/share/fnm/fnm env)"
fi

BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOG_DIR="$ROOT/.dev-logs"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

PY="$BACKEND_DIR/.venv/bin/python"
if [ ! -x "$PY" ] && command -v python3 >/dev/null 2>&1; then
  PY="python3"
fi
NEXT="$FRONTEND_DIR/node_modules/.bin/next"

# Open the backend landing page in a second tab too (set OPEN_BACKEND=0 to skip).
OPEN_BACKEND="${OPEN_BACKEND:-1}"

API_URL="http://localhost:$API_PORT"
WEB_URL="http://localhost:$WEB_PORT"

# ── helpers ────────────────────────────────────────────────────────────────
port_up() {
  ss -ltn 2>/dev/null | grep -q ":$1 "
}

# Can we create a native fs.watch (inotify) handle right now? If not, Next.js
# dev watchers will die with EMFILE, so we must switch to polling.
native_watch_ok() {
  command -v node >/dev/null 2>&1 || return 1
  node -e "try{require('fs').watch(process.cwd(),function(){}).close();process.exit(0)}catch(e){process.exit(1)}" >/dev/null 2>&1
}

# Best-effort: tell the user how to permanently raise the inotify cap.
inotify_hint() {
  local cap used
  cap="$(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || echo '')"
  [ -n "$cap" ] || return 0
  used="$(find /proc/*/fd -lname 'anon_inode:inotify' 2>/dev/null | wc -l)"
  echo "  inotify instances in use: ${used:-?} / ${cap}"
  if [ "${used:-0}" -ge "${cap:-128}" ] 2>/dev/null; then
    echo "  tip: raise the cap permanently with"
    echo "       echo 'fs.inotify.max_user_instances=1024' | sudo tee /etc/sysctl.d/99-inotify.conf && sudo sysctl --system"
  fi
}

open_url() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    (xdg-open "$url" >/dev/null 2>&1 &)
  elif command -v open >/dev/null 2>&1; then
    (open "$url" >/dev/null 2>&1 &)
  elif command -v gio >/dev/null 2>&1; then
    (gio open "$url" >/dev/null 2>&1 &)
  else
    echo "open this in your browser: $url"
  fi
}

# Wait until a TCP port is accepting connections.
wait_port() {
  local port="$1" tries="${2:-60}"
  for ((i = 0; i < tries; i++)); do
    if port_up "$port"; then return 0; fi
    sleep 1
  done
  return 1
}

# Warm the frontend cache so the first browser hit is fast (not a hard fail).
warm_up() {
  curl -s -o /dev/null --max-time 90 "$WEB_URL/" >/dev/null 2>&1 || true
}

# ── subcommands ────────────────────────────────────────────────────────────
stop() {
  pkill -f 'manage.py runserver' >/dev/null 2>&1
  pkill -f 'next dev' >/dev/null 2>&1
  pkill -f 'next-server' >/dev/null 2>&1
  sleep 1
  echo "stopped (API :$API_PORT, web :$WEB_PORT)"
}

status() {
  if port_up "$API_PORT"; then
    echo "  [up]   Django API  $API_URL"
  else
    echo "  [down] Django API  :$API_PORT"
  fi
  if port_up "$WEB_PORT"; then
    echo "  [up]   Next.js web $WEB_URL"
  else
    echo "  [down] Next.js web :$WEB_PORT"
  fi
}

start() {
  mkdir -p "$LOG_DIR"

  # Lift the open-file limit as far as the hard limit allows (harmless).
  ulimit -n "$(ulimit -Hn)" 2>/dev/null || true

  if [ ! -x "$PY" ]; then
    echo "ERROR: backend virtualenv not found at $BACKEND_DIR/.venv"
    echo "  python3 -m venv backend/.venv"
    echo "  backend/.venv/bin/pip install -r backend/requirements.txt"
    exit 1
  fi

  if [ ! -x "$NEXT" ]; then
    echo "ERROR: frontend dependencies missing ($NEXT)"
    echo "  cd frontend && pnpm install        # or: npm install"
    exit 1
  fi

  # Pick a working bundler/watcher combination for the frontend.
  local next_args=(-p "$WEB_PORT" -H 0.0.0.0)
  local watch_env=()
  if native_watch_ok; then
    echo "file watching: native (inotify) — using Turbopack"
  else
    echo "file watching: inotify unavailable (EMFILE) — using webpack + polling"
    echo "               (this prevents the 'Too many open files' crash)"
    next_args+=(--webpack)
    watch_env=(WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=true)
  fi

  # Free the ports if a previous run is still holding them.
  pkill -f 'manage.py runserver' >/dev/null 2>&1
  pkill -f 'next dev' >/dev/null 2>&1
  pkill -f 'next-server' >/dev/null 2>&1
  sleep 1

  echo "starting Django API on :$API_PORT ..."
  ( cd "$BACKEND_DIR" && setsid nohup "$PY" manage.py runserver "0.0.0.0:$API_PORT" \
      > "$LOG_DIR/backend.log" 2>&1 < /dev/null & )

  echo "starting Next.js web on :$WEB_PORT ..."
  ( cd "$FRONTEND_DIR" && setsid nohup env "${watch_env[@]}" "$NEXT" dev "${next_args[@]}" \
      > "$LOG_DIR/frontend.log" 2>&1 < /dev/null & )

  # Wait for both to be reachable before opening the browser.
  local ok_api=1 ok_web=1
  wait_port "$API_PORT" 60 || ok_api=0
  wait_port "$WEB_PORT" 60 || ok_web=0

  echo
  status
  echo

  if [ "$ok_web" = 1 ]; then
    warm_up
    echo "opening $WEB_URL ..."
    open_url "$WEB_URL"
    if [ "$OPEN_BACKEND" = 1 ] && [ "$ok_api" = 1 ]; then
      open_url "$API_URL"
    fi
  else
    echo "frontend did not come up — see $LOG_DIR/frontend.log"
  fi
  if [ "$ok_api" = 0 ]; then
    echo "backend did not come up — see $LOG_DIR/backend.log"
  fi
  inotify_hint
  echo
  echo "logs: $LOG_DIR/backend.log"
  echo "      $LOG_DIR/frontend.log"
  echo "stop: ./run.sh stop"
}

case "${1:-start}" in
  start | "") start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *)
    echo "usage: $0 [start|stop|restart|status]" >&2
    exit 2
    ;;
esac
