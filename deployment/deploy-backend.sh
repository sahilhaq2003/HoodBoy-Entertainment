#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/htdocs/api.hbe.lol}"
BACKEND_DIR="$APP_DIR/backend"
STORAGE_DIR="${STORAGE_DIR:-$HOME/storage/uploads}"

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"

cd "$APP_DIR"
git fetch --prune origin
git reset --hard origin/main

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "Missing $BACKEND_DIR/.env; create it from backend/.env.example." >&2
  exit 1
fi

mkdir -p "$STORAGE_DIR"
if [[ -e "$BACKEND_DIR/uploads" && ! -L "$BACKEND_DIR/uploads" ]]; then
  echo "$BACKEND_DIR/uploads must be a symlink to $STORAGE_DIR." >&2
  exit 1
fi
ln -sfn "$STORAGE_DIR" "$BACKEND_DIR/uploads"

cd "$BACKEND_DIR"
npm ci --omit=dev
command -v pm2 >/dev/null 2>&1 || npm install --global pm2@latest
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

for attempt in {1..15}; do
  if curl --fail --silent http://127.0.0.1:5000/api/health >/dev/null; then
    echo "Backend deployment completed successfully."
    exit 0
  fi
  if [[ "$attempt" -eq 15 ]]; then
    echo "Backend health check failed after 30 seconds." >&2
    pm2 logs hbe-backend --lines 50 --nostream >&2
    exit 1
  fi
  sleep 2
done
