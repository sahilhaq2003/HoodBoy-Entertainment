# HBE production deployment

The production topology is Nginx serving `frontend/dist`, proxying `/api` and
legacy `/uploads` requests to the PM2-managed backend on `127.0.0.1:5000`.
MongoDB remains on Atlas. User uploads persist in `/var/www/hbe-storage/uploads`
and are linked to `backend/uploads`.

## First-time order

1. Point `hbe.lol` and `www.hbe.lol` to the VPS.
2. Generate a dedicated GitHub Actions SSH key on the administrator's Windows PC.
3. Log in to the VPS as root, clone the repository, and run
   `bash /var/www/hbe/deployment/setup-server.sh`.
4. Add the deployment public key to `/home/deploy/.ssh/authorized_keys`.
5. As `deploy`, create `/var/www/hbe/backend/.env` from `.env.example` and enter
   production values locally on the server.
6. As `deploy`, run `bash /var/www/hbe/deployment/deploy.sh`.
7. As root, request the certificate with
   `certbot --nginx -d hbe.lol -d www.hbe.lol --redirect` and test renewal with
   `certbot renew --dry-run`.
8. Add `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` as GitHub Actions secrets.

Never commit `backend/.env` or any SSH private key.
