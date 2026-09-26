# LabelGrid integration

## Architecture

The browser calls the existing HBE API only. `backend/services/labelgrid` owns Bearer authentication, HTTP requests, retry/rate-limit behavior, request mapping, status normalization, uploads, safe errors, logging, and webhook verification. Local MongoDB records remain the source of HBE workflow state and retain LabelGrid IDs for idempotent synchronization.

The implementation follows the public LabelGrid OpenAPI reference at `https://api.labelgrid.com/docs/api` and uses the documented `/api/public` endpoints. It does not fall back to mock provider data.

## Required environment variables

Set these only on the backend:

- `LABELGRID_API_TOKEN`: LabelGrid Bearer token.
- `LABELGRID_BASE_URL`: `https://api.labelgrid.com/api/public`, or the documented sandbox base URL.
- `LABELGRID_LABEL_ID`: numeric LabelGrid label that owns newly created releases.
- `LABELGRID_WEBHOOK_SECRET`: secret returned when the LabelGrid webhook is created.

No LabelGrid secret belongs in `frontend/.env`, a `VITE_*` variable, local storage, or source control. LabelGrid uses a long-lived Bearer token; the documented API has no refresh-token exchange.

## Implemented features

- Connection test through `GET /me`, with connected, not configured, authentication error, and API unavailable states.
- Create/update artist profiles without duplicate creation once `labelgridArtistId` is stored.
- Create a release and retain its LabelGrid ID.
- Create tracks and retain each LabelGrid track ID.
- Artwork upload using LabelGrid's multipart cover endpoint.
- Audio upload using the documented presigned URL, SHA-256 confirmation, and queued upload state.
- LabelGrid validation followed by distribution only when validation returns `OK`.
- Delivery and per-outlet status refresh with local status normalization.
- Dynamic genres, languages, territories, and distro outlets.
- LabelGrid royalty breakdown and analytics proxy endpoints. The existing local royalty ledger remains intact and is clearly identified as local data.
- HMAC-SHA256 webhook verification over raw bytes, constant-time comparison, five-minute signed-body freshness check, and local duplicate-event protection.
- Admin connection summary and bulk artist/release synchronization.

## Backend routes

- `GET /api/labelgrid/connection-status` (admin)
- `POST /api/labelgrid/sync/artists` (admin)
- `POST /api/labelgrid/sync/releases` (admin)
- `POST /api/labelgrid/artists/:id/sync` (admin)
- `POST /api/webhooks/labelgrid` (public receiver; signature required)
- `GET /api/distribution/connection`
- `GET /api/distribution/reference-data`
- `GET /api/distribution/labelgrid/royalties`
- `GET /api/distribution/labelgrid/analytics`
- Existing distribution create/update/submit/sync routes now use LabelGrid.

## Database changes

No destructive migration or reset is required because Mongoose adds optional fields lazily. Artist records gain LabelGrid ID/sync fields. Distribution releases gain LabelGrid release ID, raw status, sync state/error, catalog and AI-use metadata, DSP selection, validation result, artwork upload state, and webhook keys. Embedded tracks gain LabelGrid track ID, upload attempt/state, disc/track numbers, composition type, sample status, and AI-use declarations.

## Webhook setup

In LabelGrid, create an HTTPS webhook pointing to:

`https://YOUR_DOMAIN/api/webhooks/labelgrid`

Store its generated secret as `LABELGRID_WEBHOOK_SECRET`. Select the release review, delivery, takedown, transcode, and outlet-status events required by the deployment. The receiver rejects unsigned, invalid, or stale requests. LabelGrid must be configured to send the webhook; setting the environment variable alone does not register it.

## Operating workflow

1. Configure the sandbox URL/token, label ID, outbound IP allowlist, and webhook secret.
2. Sign in as an admin and open **Settings → Integrations → LabelGrid**.
3. Test the connection, then synchronize artists.
4. Create a local distribution draft with cover/audio, a LabelGrid genre, copyright, and complete track metadata.
5. Submit once. The button is disabled while processing. HBE creates missing remote entities, uploads assets, validates, and distributes.
6. Use **Sync status** or webhooks to refresh review/delivery states.

If an attempt fails after a remote ID was created, retry uses the stored ID rather than creating another release or track.

## Errors and logging

Authentication, validation, rate-limit, availability, upload, and duplicate-submission failures are translated into user-facing messages. Detailed provider responses remain server-side/in the release integration record. Logs contain local/LabelGrid record IDs and event names, never tokens or webhook secrets.

## Capabilities not automatically mapped

LabelGrid exposes writers, contributors, publishers, licenses, statements, transactions, takedowns, quality reports, and webhook-registration APIs. HBE's current forms store contributor names rather than LabelGrid writer/contributor IDs and role objects, so those credits are not guessed or silently fabricated. LabelGrid validation remains authoritative and will stop distribution when the account requires additional credits. Add an explicit writer/contributor matching UI before automating those fields.

Likewise, the current HBE screen does not expose takedown, licenses, publisher management, statement downloads, or quality-review notes. Their LabelGrid endpoints exist, but they were not attached to unrelated UI controls. Existing local finance/royalty modules are not overwritten by remote figures.

## Deployment and testing

- Use the LabelGrid sandbox first and have LabelGrid allowlist the server's outbound IP.
- Ensure Node.js provides native `fetch`, `FormData`, `Blob`, and `AbortSignal.timeout` (Node 20+ recommended).
- Persist `backend/uploads/distribution` until LabelGrid confirms uploads.
- Run `npm test` in `backend` and `npm run build` in `frontend`.
- A live authentication/upload/distribution test requires valid account credentials and may affect the configured LabelGrid environment; it is intentionally not run without them.
