#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run this first-time setup script as root." >&2
  exit 1
fi

REPO_URL="https://github.com/sahilhaq2003/HoodBoy-Entertainment.git"
APP_DIR="/var/www/hbe"
STORAGE_DIR="/var/www/hbe-storage/uploads"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y git nginx curl ca-certificates rsync ufw certbot python3-certbot-nginx

if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  rm -f /tmp/nodesource_setup.sh
  apt-get install -y nodejs
fi
npm install --global pm2

if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

install -d -m 755 -o deploy -g deploy "$APP_DIR"
install -d -m 750 -o deploy -g deploy "$STORAGE_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u deploy git clone "$REPO_URL" "$APP_DIR"
fi
chown -R deploy:deploy "$APP_DIR" /var/www/hbe-storage

UPLOAD_PATH="$APP_DIR/backend/uploads"
if [[ -d "$UPLOAD_PATH" && ! -L "$UPLOAD_PATH" ]]; then
  if find "$UPLOAD_PATH" -mindepth 1 -print -quit | grep -q .; then
    echo "Existing uploads found at $UPLOAD_PATH. Migrate them to $STORAGE_DIR before replacing the directory with a symlink." >&2
    exit 1
  fi
  rmdir "$UPLOAD_PATH"
fi
sudo -u deploy ln -sfn "$STORAGE_DIR" "$UPLOAD_PATH"

if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
fi
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  swapon /swapfile
fi
if ! grep -qE '^/swapfile\s' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cp "$APP_DIR/deployment/nginx/hbe.lol.conf" /etc/nginx/sites-available/hbe.lol
ln -sfn /etc/nginx/sites-available/hbe.lol /etc/nginx/sites-enabled/hbe.lol
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

env PATH="$PATH" pm2 startup systemd -u deploy --hp /home/deploy

echo "Prerequisites are ready. Add the deployment public key and backend/.env, then run deployment/deploy.sh as deploy."
