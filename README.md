# HoodBoy Entertainment — Label Management Platform

The current client guide is [docs/HBE_Client_User_Manual.html](docs/HBE_Client_User_Manual.html) (version 1.2, updated 15 September 2026).

## Local start

1. Copy `backend/.env.example` to `backend/.env` and configure MongoDB/JWT values.
2. Run `npm install` and `npm run dev` in `backend`.
3. Run `npm install` and `npm run dev` in `frontend`.

Use `node scripts/seedDemo.js` from `backend` to rebuild the tracked demo dataset with functional local fixtures. For an existing demo database, `npm run demo:repair` repairs only records listed in `_demomarkers` and creates the missing PDF, JPEG, WAV, and CSV files.

Production password recovery requires `FRONTEND_URL` and `PASSWORD_RESET_WEBHOOK_URL`; see `backend/.env.example` and Appendix B of the manual.
