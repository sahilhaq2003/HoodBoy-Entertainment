# HBE production deployment

Production uses two CloudPanel Node.js sites on one VPS:

- `hbe.lol` runs the built Vite frontend on port `3000` as site user `hbe`.
- `api.hbe.lol` runs the Express API on port `5000` as site user `hbe-api`.
- MongoDB remains on Atlas.
- Backend uploads persist in `/home/hbe-api/storage/uploads`.

## First-time setup

1. Point `hbe.lol`, `www.hbe.lol`, and `api.hbe.lol` to the VPS.
2. Create the two CloudPanel Node.js sites with the users and ports above.
3. Add the GitHub Actions public key to each CloudPanel site user.
4. Clone the repository into each site's CloudPanel document root.
5. Create `backend/.env` only in the backend checkout.
6. Run `deployment/deploy-frontend.sh` as `hbe` and
   `deployment/deploy-backend.sh` as `hbe-api`.
7. Issue CloudPanel Let's Encrypt certificates for both sites.
8. Add `VPS_HOST`, `FRONTEND_VPS_USER`, `FRONTEND_SSH_KEY`,
   `BACKEND_VPS_USER`, and `BACKEND_SSH_KEY` as GitHub Actions secrets.

The frontend deployment embeds `https://api.hbe.lol/api` as its public API URL.
The backend environment should allow `https://hbe.lol` and
`https://www.hbe.lol` through CORS.

`deployment/setup-server.sh` is for a plain VPS. Do not run it on CloudPanel,
because CloudPanel manages Nginx and system configuration.

Never commit `backend/.env` or any SSH private key.
