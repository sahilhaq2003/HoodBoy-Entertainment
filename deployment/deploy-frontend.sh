#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/htdocs/hbe.lol}"
FRONTEND_DIR="$APP_DIR/frontend"

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
. "$NVM_DIR/nvm.sh"

cd "$APP_DIR"
git fetch --prune origin
git reset --hard origin/main

cd "$FRONTEND_DIR"
npm ci
VITE_API_URL="https://api.hbe.lol/api" npm run build
command -v pm2 >/dev/null 2>&1 || npm install --global pm2@latest
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

for attempt in {1..15}; do
  if curl --fail --silent http://127.0.0.1:3000 >/dev/null; then
    echo "Frontend deployment completed successfully."
    exit 0
  fi
  if [[ "$attempt" -eq 15 ]]; then
    echo "Frontend health check failed after 30 seconds." >&2
    pm2 logs hbe-frontend --lines 50 --nostream >&2
    exit 1
  fi
  sleep 2
done
