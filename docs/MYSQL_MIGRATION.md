# HBE MongoDB to MySQL 8 migration

## Architecture and inventory

The Express 5 API now uses Sequelize 6 with `mysql2`. `backend/lib/mysql-orm.js` is the compatibility repository used by the existing controllers; it translates the existing model/query contract to parameterized Sequelize operations so API routes and response `_id` values remain stable. MongoDB is not used by the running API. The standalone transfer command is the only code that opens a MongoDB connection.

The audit found 27 Mongoose models plus the raw `_demomarkers` collection. All are represented by MySQL tables: `activities`, `artists`, `artistbalances`, `artistdevelopments`, `budgets`, `campaigns`, `contacts`, `contracts`, `contracttemplates`, `distributionreleases`, `files`, `fileversions`, `finances`, `folders`, `lnkups`, `notifications`, `ownerships`, `personganalytics`, `projects`, `releases`, `royaltyledgers`, `songs`, `songmetadatas`, `tasks`, `taxcalendars`, `users`, `weeklyreports`, and `_demomarkers`.

MongoDB ObjectIds are retained as `CHAR(24)` primary and foreign keys. This preserves URLs, JWT subjects, frontend routing, ToneGrid retry identifiers, and all existing references. Top-level model references receive foreign keys with `CASCADE` updates and either `RESTRICT` or `SET NULL` deletes. Referenced arrays also receive ordered junction tables (`ownerId`, `targetId`, `position`). Truly embedded data uses MySQL JSON. Monetary columns use `DECIMAL(19,4)`. Tables use InnoDB and `utf8mb4_0900_ai_ci`.

The highest-risk query areas found in the audit were `analyticsController.js` (66 aggregation pipelines), `dashboardController.js` (15), and finance/reporting controllers. Population and aggregation compatibility is centralized in the SQL repository. Authentication remains JWT/bcrypt based; password hashes and 2FA/reset fields are not transformed by the data transfer.

## Local setup

MySQL 8 must already contain an empty `hbedb` database and a least-privilege application user. Copy `.env.example` to `.env`, then set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`.

```powershell
cd backend
npm ci
npm run db:status
npm run db:migrate
npm test
npm start
```

`db:migrate` only applies pending migrations. It never drops or resets a database. A local rollback is locked behind `ALLOW_LOCAL_MIGRATION_ROLLBACK=true`; rollback is refused when `NODE_ENV=production`.

## Data transfer and verification

Keep the source database read-only or impose a write freeze for the final run. Take recoverable MongoDB and MySQL backups first. Set `MONGODB_URI` only in the migration shell/environment, then run:

```powershell
npm run db:migrate
npm run db:migrate:data
```

The transfer reads each collection with a batched cursor (default 250), performs idempotent upserts, preserves ObjectIds/dates/password hashes, records per-record failures, synchronizes ordered junction tables, and writes `backend/migration-report.json`. Override with `DATA_MIGRATION_BATCH_SIZE` and `DATA_MIGRATION_REPORT`.

Review every collection in the report. `verification: verified` means the run had no rejected rows and the MySQL table count is at least the source count. Also test login/RBAC, CRUD, search/pagination, reporting, file metadata, ToneGrid, notifications, and scheduled processes before cutover. Do not delete or modify the source database.

## Production preparation (`api.hbe.lol`)

The API and MySQL are on the same host, so use `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=hbedb`, and the actual control-panel-created MySQL user. The CloudPanel site user `hbe-api` and VPS address `66.29.149.220` are not database credentials. Keep MySQL private; do not enable remote root.

Before production changes:

1. Verify restorable source and destination backups.
2. Verify the `hbe-api` process can authenticate to MySQL with least privilege.
3. Deploy without switching traffic and run `npm run db:status`.
4. Apply `npm run db:migrate` to the empty destination.
5. Enter a write freeze, run the transfer, and review its report and smoke tests.
6. Switch the API only after explicit approval. Retain MongoDB for the recovery window.

Expected downtime is the final write-freeze, transfer, verification, and service restart. Measure it with a rehearsal.

## Rollback

If cutover fails, stop the MySQL-backed API, restore the previous code/environment, point it at the unchanged MongoDB source, and restart. Reconcile writes made after cutover before retrying. Do not run schema `down` in production; restore the MySQL backup or provision a clean destination.

## Current verification limits

Database integration tests skip when required `DB_*` values are absent. This workstation has MySQL 8 running, but `.env` has no MySQL credentials and passwordless root is denied, so no local schema or data migration is claimed as executed.
