# DistriBeats Integration and Operations Guide

**System:** HoodBoy Entertainment Record Label Management System

**Integration:** DistriBeats Tenant API

**Document version:** 1.0

**Updated:** 30 October 2026
**Audience:** Label administrators, release managers, catalog staff and technical administrators

---

## 1. Purpose

This guide explains how the HoodBoy Entertainment platform connects to DistriBeats and how authorized staff operate the complete distribution workflow—from artist synchronization and release preparation to delivery-status updates and takedowns.

The current deployment is connected to the **DistriBeats test API**. Test mode is suitable for integration validation but does not distribute releases to live digital service providers. A DistriBeats live API key is required before production delivery.

## 2. Integration overview

The platform communicates with DistriBeats through two mechanisms:

1. **REST API:** Sends and retrieves artists, releases, metadata, audio, artwork, status information and DDEX feeds.
2. **Signed webhooks:** DistriBeats sends release events to the platform automatically. The platform verifies each signature, updates the local release and notifies administrators in real time.

```text
HoodBoy platform
    │
    ├── REST API ───────► DistriBeats
    │   Artists, releases, media, status, DDEX and takedowns
    │
    ◄── Signed webhook ── DistriBeats
        Approval, rejection, delivery, store-live and takedown events
```

API credentials and webhook secrets remain on the backend server. They are not returned to the browser or stored in dashboard link fields.

## 3. Current scope

### Supported

- Test and live API key modes
- Connection-health monitoring
- Artist matching and synchronization
- Distribution draft creation
- Cover-art and master-audio uploads
- Internal content, audio and rights QC
- Release submission
- Manual and bulk status synchronization
- UPC and ISRC synchronization
- Store-delivery status tracking
- Signed webhook verification
- Duplicate webhook protection
- Persistent webhook audit history
- DDEX ERN 3.8.2 and 4.2 downloads
- Release takedown requests

### Current limitations

- The system currently supports one registered label configuration.
- DistriBeats permits one registered label name per documented workspace configuration. Multi-label operation must be confirmed with DistriBeats.
- DistriBeats royalty reports are not exposed through the current public API. Finance → Royalties remains the authoritative internal accounting ledger.
- Dashboard fields for Spotify, Apple Music and distributor URLs are shortcuts only. Adding a URL does not configure an API connection.

## 4. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Administrator | Configure and monitor the integration, synchronize artists/releases, review QC exceptions, view webhook history and supervise delivery. |
| Manager | Prepare release information and operate distribution actions allowed by platform permissions. |
| Artist | Create or review permitted distribution drafts and monitor assigned releases. |
| Finance | Maintain royalty records, statements, payments and balances in the internal ledger. |
| Technical administrator | Maintain server environment variables, public HTTPS access, persistent upload storage and webhook registration. |

## 5. Server configuration

The following values are configured in `backend/.env` on the production server:

```env
DISTRIBEATS_API_KEY=db_test_or_live_key
DISTRIBEATS_BASE_URL=https://distribeats.com/api/public/v1
DISTRIBEATS_WEBHOOK_SECRET=workspace_webhook_signing_secret
DISTRIBEATS_LABEL_NAME=Registered Label Name
PUBLIC_API_URL=https://api.hbe.lol
```

### Security requirements

- Never enter API keys or webhook secrets into the dashboard link fields.
- Never commit `backend/.env` to Git.
- Use HTTPS for the public API and webhook endpoint.
- Rotate a key immediately if it is exposed.
- Use test credentials until the complete workflow has been approved.
- Restrict production server and database access to authorized personnel.

## 6. Webhook registration

Register the following endpoint in the DistriBeats **Developer & API** area:

```text
https://api.hbe.lol/api/webhooks/distribeats
```

The URL must be publicly reachable over HTTPS. The secret configured in DistriBeats must match `DISTRIBEATS_WEBHOOK_SECRET` on the backend server.

The platform rejects invalid or stale signatures. Verified events are stored in the persistent webhook history with their event type, delivery ID, release, result and received time.

## 7. Verify the connection

1. Sign in as an administrator.
2. Open **Settings → Integrations**.
3. Review the DistriBeats connection panel.
4. Confirm:
   - Connection status is **Live · Healthy**.
   - Key mode is **TEST** during integration testing or **LIVE** for production.
   - API key is configured.
   - Webhook secret is configured.
   - Label name is correct.
   - Webhook URL uses `https://`.
5. Click **Test Connection**.

“Live · Healthy” describes the API connection health. The separate **Key mode** value determines whether the connected credential is a test or live key.

## 8. Artist synchronization

### Bulk synchronization

1. Open **Artists**.
2. Click **Sync DistriBeats**.
3. Wait for synchronization to complete.
4. Review the linked count and provider badges.

The platform compares artist names against the DistriBeats workspace. Successfully matched artists receive a DistriBeats artist ID.

### Synchronize one artist

1. Open an artist profile.
2. Locate the **DistriBeats artist** panel.
3. Click **Find in DistriBeats** or **Refresh provider link**.
4. Confirm that a provider artist ID appears.

Review names carefully before distribution. Legal names, stage names and artist-profile URLs must identify the correct performer.

## 9. Create a distribution release

1. Open **Distribution**.
2. Select **New Release**.
3. Complete the required release information:
   - Release title
   - Artist
   - Release type
   - Genre and subgenre
   - Language
   - Release date
   - Copyright and publishing information
   - Territories
   - Stores
   - Producers, writers, composers, mixing and mastering engineers
   - Spotify artist URL or new-artist information where applicable
4. Upload square JPG or PNG cover artwork.
5. Add each track and upload its WAV or FLAC master.
6. Enter existing UPC and ISRC codes if available. DistriBeats may assign missing codes after approval.
7. Confirm the age and distribution-rights attestations.
8. Click **Save Draft**.

A saved draft remains local until an authorized user explicitly submits it.

## 10. Content and quality control

Every draft enters internal QC before submission. Checks may include:

- Required metadata and contributor credits
- Artwork availability
- Audio availability and technical inspection
- Internal duplicate or fingerprint checks
- Rights and sample-clearance review
- Distribution-rights attestation

Administrators review exceptions through **Distribution → Admin QC**.

| QC state | Meaning |
|---|---|
| Pending QC | Waiting for automated or administrative review. |
| QC processing | Checks are currently running. |
| Action required | Metadata, media or supporting evidence must be corrected. |
| Manual review | An administrator must review the release. |
| QC failed | The release does not meet submission requirements. |
| Ready for distribution | QC and rights requirements have passed; submission is enabled. |

Submission is blocked until the release is **Ready for distribution**.

## 11. Submit the release

1. Open **Distribution → Catalog**.
2. Confirm that the release is **Ready for distribution**.
3. Click **Submit**, or open **Details** and click **Submit**.
4. The platform then:
   - Validates the mapped DistriBeats payload.
   - Creates or resumes the remote release.
   - Uploads artwork.
   - Uploads each audio master.
   - Submits the completed release for provider review.
   - Stores the returned provider release and track IDs.

Do not close or refresh the page while a submission or large upload is in progress.

## 12. Status synchronization and webhooks

Release updates normally arrive automatically through signed webhooks. Authorized users may also click **Sync** to request the latest provider status.

Common events include:

| Event | Platform result |
|---|---|
| `release.submitted` | Release is marked submitted for review. |
| `release.screening_passed` | Provider screening passed. |
| `release.approved` | Release is approved; the platform refreshes UPC and ISRC information. |
| `release.rejected` | Release is marked rejected for corrective action. |
| `release.delivered` | Release was delivered to stores. |
| `release.store_live` | Release is live; store status and identifiers are refreshed. |
| `release.takedown_completed` | Release removal is recorded. |

Administrators receive real-time notifications. The complete audit is available under **Distribution → Webhook History**.

## 13. Provider catalogue reconciliation

Administrators can open **Distribution → Provider Catalogue** to view releases returned directly by the DistriBeats API.

Use this page to:

- Compare remote releases with local distribution records.
- Confirm provider IDs, UPCs and statuses.
- Open the matching local release.
- Identify remote releases that are not linked locally.

## 14. DDEX feeds

After DistriBeats compiles an approved release, open the release details page and download the required feed:

- DDEX ERN 4.2
- DDEX ERN 3.8.2

DDEX files are formal delivery records. Store them with the release documentation when required by label policy.

## 15. Takedown process

1. Open the distributed release details.
2. Select the takedown action.
3. Enter a clear business reason.
4. Submit the request.
5. Monitor the release until DistriBeats sends the completed takedown event.

A takedown request is not complete merely because it was submitted. Confirm the provider and store statuses.

## 16. Royalties and financial records

The DistriBeats public API currently used by the platform does not provide royalty-report endpoints. Therefore:

- Maintain calculations, splits, deductions and recoupment in **Finance → Royalties**.
- Import or enter approved distributor statements into the internal ledger.
- Calculate and approve the royalty period.
- Generate the artist statement.
- Record payments and references.
- Reconcile the corresponding artist balance.

Do not interpret release API connectivity as royalty-report synchronization.

## 17. Test-to-live transition

Complete the following before changing from a test key to a live key:

- [ ] API test connection succeeds.
- [ ] Artist synchronization has been reviewed.
- [ ] A complete test release passes internal QC.
- [ ] Artwork and every audio master upload successfully.
- [ ] Release submission returns provider IDs.
- [ ] A signed webhook is received and recorded.
- [ ] Duplicate webhook delivery is handled safely.
- [ ] UPC and ISRC synchronization is verified.
- [ ] DDEX download is verified where available.
- [ ] Persistent server upload storage is writable and backed up.
- [ ] Public webhook URL uses HTTPS.
- [ ] DistriBeats confirms the registered production label name.
- [ ] DistriBeats provides or enables the live API key.

After approval:

1. Replace `DISTRIBEATS_API_KEY` with the live key.
2. Confirm the correct live webhook secret.
3. Restart the backend service.
4. Open **Settings → Integrations** and confirm **Key mode: LIVE**.
5. Test the connection again before submitting a production release.

## 18. Troubleshooting

### Connection is not configured

Confirm `DISTRIBEATS_API_KEY` exists on the backend server and uses the expected `db_test_` or `db_live_` prefix.

### Authentication error

The API key may be invalid, incomplete, revoked or associated with another workspace. Generate or request a valid key and restart the backend.

### Webhook does not arrive

- Confirm the registered URL is `https://api.hbe.lol/api/webhooks/distribeats`.
- Confirm the signing secrets match.
- Confirm the endpoint is publicly reachable.
- Review the DistriBeats delivery log.
- Review **Distribution → Webhook History**.

### Invalid webhook signature

Do not disable verification. Correct the configured secret and ensure proxies preserve the signature, timestamp, event and delivery-ID headers.

### Release cannot be submitted

- Review the QC status.
- Correct every missing metadata field.
- Verify artwork and audio uploads.
- Confirm contributor credits and rights attestations.
- Confirm the release date satisfies provider lead-time requirements.

### File upload fails

- Confirm the file format and size are allowed.
- Confirm persistent server upload storage is writable.
- Confirm the API Nginx vhost allows the required request size.
- Preserve the real media `Content-Type` for audio uploads.

### Release status appears outdated

Click **Sync**, check webhook history and compare the release under **Provider Catalogue**.

### Royalty information does not synchronize

This is expected with the current public API. Record distributor reports through the internal Royalty Ledger.

## 19. Operational control checklist

For every production release, confirm:

- [ ] Correct artist and provider artist ID
- [ ] Correct registered label name
- [ ] Complete release and track metadata
- [ ] Full legal contributor names
- [ ] Approved cover artwork
- [ ] Lossless final masters
- [ ] Rights and sample-clearance evidence
- [ ] Correct stores and territories
- [ ] Valid release date
- [ ] Internal QC approval
- [ ] Provider release ID recorded
- [ ] Submission status monitored
- [ ] UPC and ISRC values synchronized
- [ ] Store-live status confirmed
- [ ] Financial and royalty records scheduled

## 20. Support information

When escalating a DistriBeats integration issue, provide:

- Workspace or registered label name
- Environment: test or live
- Local release ID
- DistriBeats release ID
- Webhook delivery ID
- Event type and timestamp
- HTTP status and error code
- A concise description of the attempted action

Never include API keys or webhook secrets in support screenshots, email or tickets.

---

**End of document**
