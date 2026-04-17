#!/usr/bin/env bash
#
# Starts Cloudflare quick tunnels for the DACS demo and updates .env.local
# files with the generated public URLs. Safe and reversible.
#
# Usage:
#   ./scripts/tunnel-up.sh
#
# After running: restart the backend and rebuild the frontend:
#   (backend)  cd backend  && npm run dev
#   (frontend) cd frontend && npm run build && npm run start
#
# To stop tunnels and restore the original env files:
#   ./scripts/tunnel-down.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/.tunnel-runtime"
FRONTEND_ENV="$REPO_ROOT/frontend/.env.local"
BACKEND_ENV="$REPO_ROOT/backend/.env.local"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "ERROR: cloudflared is not installed." >&2
  echo "Install with: brew install cloudflared" >&2
  exit 1
fi

if [ ! -f "$FRONTEND_ENV" ] || [ ! -f "$BACKEND_ENV" ]; then
  echo "ERROR: missing .env.local files. Expected:" >&2
  echo "  $FRONTEND_ENV" >&2
  echo "  $BACKEND_ENV" >&2
  exit 1
fi

mkdir -p "$RUNTIME_DIR"

stop_if_running() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

stop_if_running frontend
stop_if_running backend

FRONTEND_LOG="$RUNTIME_DIR/frontend.log"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
: > "$FRONTEND_LOG"
: > "$BACKEND_LOG"

echo "Starting frontend tunnel -> http://localhost:3000"
nohup cloudflared tunnel --no-autoupdate --url http://localhost:3000 \
  >"$FRONTEND_LOG" 2>&1 &
echo $! > "$RUNTIME_DIR/frontend.pid"

echo "Starting backend tunnel  -> http://localhost:4000"
nohup cloudflared tunnel --no-autoupdate --url http://localhost:4000 \
  >"$BACKEND_LOG" 2>&1 &
echo $! > "$RUNTIME_DIR/backend.pid"

parse_url() {
  grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$1" 2>/dev/null | head -n 1 || true
}

FRONTEND_URL=""
BACKEND_URL=""
for _ in $(seq 1 60); do
  [ -z "$FRONTEND_URL" ] && FRONTEND_URL=$(parse_url "$FRONTEND_LOG")
  [ -z "$BACKEND_URL" ]  && BACKEND_URL=$(parse_url "$BACKEND_LOG")
  if [ -n "$FRONTEND_URL" ] && [ -n "$BACKEND_URL" ]; then
    break
  fi
  sleep 0.5
done

if [ -z "$FRONTEND_URL" ] || [ -z "$BACKEND_URL" ]; then
  echo "ERROR: could not extract tunnel URLs within 30s." >&2
  echo "Check logs:" >&2
  echo "  $FRONTEND_LOG" >&2
  echo "  $BACKEND_LOG" >&2
  stop_if_running frontend
  stop_if_running backend
  exit 1
fi

echo ""
echo "Frontend tunnel: $FRONTEND_URL"
echo "Backend tunnel:  $BACKEND_URL"
echo ""

TS=$(date +%Y%m%d-%H%M%S)
cp "$FRONTEND_ENV" "${FRONTEND_ENV}.bak.$TS"
cp "$BACKEND_ENV"  "${BACKEND_ENV}.bak.$TS"
# "pre-tunnel" snapshot captures the true original state. Never overwrite if
# it already exists, otherwise a second tunnel-up run would clobber the real
# original with an already-tunneled version.
[ -f "${FRONTEND_ENV}.pre-tunnel" ] || cp "$FRONTEND_ENV" "${FRONTEND_ENV}.pre-tunnel"
[ -f "${BACKEND_ENV}.pre-tunnel" ]  || cp "$BACKEND_ENV"  "${BACKEND_ENV}.pre-tunnel"

update_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file"; then
    local tmp="${file}.tmp.$$"
    awk -v key="$key" -v value="$value" '
      BEGIN { done = 0 }
      {
        if (!done && index($0, key "=") == 1) {
          print key "=" value
          done = 1
        } else {
          print $0
        }
      }
    ' "$file" > "$tmp"
    mv "$tmp" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

update_env_var "$FRONTEND_ENV" "NEXT_PUBLIC_APP_URL"     "$FRONTEND_URL"
update_env_var "$FRONTEND_ENV" "NEXT_PUBLIC_BACKEND_URL" "$BACKEND_URL"
update_env_var "$BACKEND_ENV"  "FRONTEND_ORIGIN"         "$FRONTEND_URL"

echo "Env files updated. Backups:"
echo "  ${FRONTEND_ENV}.bak.$TS"
echo "  ${BACKEND_ENV}.bak.$TS"
echo ""
echo "Next steps:"
echo "  1. Restart backend so CORS picks up FRONTEND_ORIGIN"
echo "     cd backend && npm run dev"
echo "  2. Rebuild frontend so NEXT_PUBLIC_* are baked in"
echo "     cd frontend && npm run build && npm run start"
echo "  3. Open $FRONTEND_URL/verify on your phone and scan a QR"
echo ""
echo "To tear down: ./scripts/tunnel-down.sh"
