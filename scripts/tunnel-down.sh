#!/usr/bin/env bash
#
# Stops the Cloudflare tunnels started by tunnel-up.sh and restores the
# original .env.local files.
#
# Usage:
#   ./scripts/tunnel-down.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/.tunnel-runtime"
FRONTEND_ENV="$REPO_ROOT/frontend/.env.local"
BACKEND_ENV="$REPO_ROOT/backend/.env.local"

stop_if_running() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "Stopped $name tunnel (pid $pid)"
    fi
    rm -f "$pid_file"
  else
    echo "No $name tunnel PID file found."
  fi
}

stop_if_running frontend
stop_if_running backend

restore_env() {
  local target="$1"
  local snapshot="${target}.pre-tunnel"
  if [ -f "$snapshot" ]; then
    cp "$snapshot" "$target"
    rm -f "$snapshot"
    echo "Restored $target"
  else
    echo "No pre-tunnel snapshot for $target; leaving file unchanged."
  fi
}

restore_env "$FRONTEND_ENV"
restore_env "$BACKEND_ENV"

echo ""
echo "Done. Remember to rebuild the frontend so NEXT_PUBLIC_* reverts:"
echo "  cd frontend && npm run build && npm run start"
