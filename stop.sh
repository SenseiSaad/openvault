#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenVault stopper — stops the backend and frontend started by ./start.sh
#
#   ./stop.sh
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/.dev-logs"
API_PORT=8000
WEB_PORT=3000

# Kill a process group recorded in a PID file, then remove the file.
kill_pidfile() {
  local pidfile="$1"
  [ -f "$pidfile" ] || return 0
  local pid
  pid="$(cat "$pidfile" 2>/dev/null)"
  if [ -n "${pid:-}" ]; then
    # Negative PID targets the whole process group created by setsid.
    kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  fi
  rm -f "$pidfile"
}

kill_pidfile "$LOG_DIR/backend.pid"
kill_pidfile "$LOG_DIR/frontend.pid"

# Fallback: catch any strays not tracked by PID files.
pkill -f 'manage.py runserver' >/dev/null 2>&1
pkill -f 'next dev'            >/dev/null 2>&1
pkill -f 'next-server'        >/dev/null 2>&1

sleep 1
echo "stopped (API :$API_PORT, web :$WEB_PORT)"
