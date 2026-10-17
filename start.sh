#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenVault launcher — starts the backend and frontend together.
#
#   ./start.sh
#
#   Backend  (Django)  -> http://localhost:8000   /admin/, /api/
#   Frontend (Next.js) -> http://localhost:3000   public site
#
# The frontend always starts on :3000, independently of the backend — it
# finds the API in the browser at <host>:8000 at runtime, so it renders even
# if the backend is down. Logs are written to .dev-logs/, PIDs to .dev-logs/.
# Stop everything with ./stop.sh
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Make common Node version managers available (nvm / volta / fnm).
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export VOLTA_HOME="$HOME/.volta"
[ -d "$VOLTA_HOME/bin" ] && export PATH="$VOLTA_HOME/bin:$PATH"
if [ -s "$HOME/.local/share/fnm/fnm" ]; then
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$($HOME/.local/share/fnm/fnm env)"
fi

BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOG_DIR="$ROOT/.dev-logs"
API_PORT=8000
WEB_PORT=3000

mkdir -p "$LOG_DIR"

port_up() { ss -ltn 2>/dev/null | grep -q ":$1 "; }

# --- Backend (optional) ----------------------------------------------------
if [ -x "$BACKEND_DIR/.venv/bin/python" ]; then
  echo "starting Django API on :$API_PORT ..."
  ( cd "$BACKEND_DIR" && setsid nohup ./.venv/bin/python manage.py runserver 0.0.0.0:$API_PORT \
      > "$LOG_DIR/backend.log" 2>&1 < /dev/null & echo $! > "$LOG_DIR/backend.pid" )
else
  echo "WARNING: backend virtualenv not found at $BACKEND_DIR/.venv — skipping API."
  echo "  python3 -m venv backend/.venv"
  echo "  backend/.venv/bin/pip install -r backend/requirements.txt"
  echo "  (frontend will still start on :$WEB_PORT)"
fi

# --- Frontend (always, independent of backend) -----------------------------
if [ -x "$FRONTEND_DIR/node_modules/.bin/next" ]; then
  echo "starting Next.js web on :$WEB_PORT ..."
  ( cd "$FRONTEND_DIR" && setsid nohup npm run dev -- --port $WEB_PORT \
      > "$LOG_DIR/frontend.log" 2>&1 < /dev/null & echo $! > "$LOG_DIR/frontend.pid" )
else
  echo "ERROR: frontend dependencies missing ($FRONTEND_DIR/node_modules/.bin/next)"
  echo "  cd frontend && pnpm install        # or: npm install"
fi

sleep 8
echo
if port_up "$API_PORT"; then
  echo "  [up]   Django API  http://localhost:$API_PORT"
else
  echo "  [down] Django API  :$API_PORT"
fi
if port_up "$WEB_PORT"; then
  echo "  [up]   Next.js web http://localhost:$WEB_PORT"
else
  echo "  [down] Next.js web :$WEB_PORT  (see $LOG_DIR/frontend.log)"
fi
echo
echo "logs: $LOG_DIR/backend.log"
echo "      $LOG_DIR/frontend.log"
echo "stop: ./stop.sh"
