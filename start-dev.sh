#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenVault local dev launcher
#
#   ./start-dev.sh           start API + web (detached, logs in .dev-logs/)
#   ./start-dev.sh stop      stop both servers
#   ./start-dev.sh restart   stop, then start again
#   ./start-dev.sh status    show which ports are up
#
#   API  (Django)  -> http://localhost:8000   landing page, /admin/, /api/
#   Web  (Next.js) -> http://localhost:3000   public site
#
# The frontend finds the API automatically on the same host, port 8000.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOG_DIR="$ROOT/.dev-logs"
API_PORT=8000
WEB_PORT=3000

port_up() {
  ss -ltn 2>/dev/null | grep -q ":$1 "
}

stop() {
  pkill -f 'manage.py runserver' >/dev/null 2>&1
  pkill -f 'next dev' >/dev/null 2>&1
  pkill -f 'next-server' >/dev/null 2>&1
  sleep 1
  echo "stopped (API :$API_PORT, web :$WEB_PORT)"
}

status() {
  if port_up "$API_PORT"; then
    echo "  [up]   Django API  http://localhost:$API_PORT"
  else
    echo "  [down] Django API  :$API_PORT"
  fi
  if port_up "$WEB_PORT"; then
    echo "  [up]   Next.js web http://localhost:$WEB_PORT"
  else
    echo "  [down] Next.js web :$WEB_PORT"
  fi
}

start() {
  mkdir -p "$LOG_DIR"

  if [ ! -x "$BACKEND_DIR/.venv/bin/python" ]; then
    echo "ERROR: backend virtualenv not found at $BACKEND_DIR/.venv"
    echo "  python3 -m venv backend/.venv"
    echo "  backend/.venv/bin/pip install -r backend/requirements.txt"
    exit 1
  fi

  if [ ! -x "$FRONTEND_DIR/node_modules/.bin/next" ]; then
    echo "ERROR: frontend dependencies missing ($FRONTEND_DIR/node_modules/.bin/next)"
    echo "  cd frontend && pnpm install        # or: npm install"
    exit 1
  fi

  pkill -f 'manage.py runserver' >/dev/null 2>&1
  pkill -f 'next dev' >/dev/null 2>&1
  pkill -f 'next-server' >/dev/null 2>&1
  sleep 1

  echo "starting Django API on :$API_PORT ..."
  ( cd "$BACKEND_DIR" && setsid nohup ./.venv/bin/python manage.py runserver 0.0.0.0:$API_PORT \
      > "$LOG_DIR/backend.log" 2>&1 < /dev/null & )

  echo "starting Next.js web on :$WEB_PORT ..."
  ( cd "$FRONTEND_DIR" && setsid nohup npm run dev \
      > "$LOG_DIR/frontend.log" 2>&1 < /dev/null & )

  sleep 8
  echo
  status
  echo
  echo "logs: $LOG_DIR/backend.log"
  echo "      $LOG_DIR/frontend.log"
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
