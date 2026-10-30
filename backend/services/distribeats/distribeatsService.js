const fs = require('fs/promises');
const path = require('path');
const { DistribeatsClient, DistribeatsError, DEFAULT_BASE_URL } = require('./distribeatsClient');
const { mapRelease, normalizeStatus, displayName } = require('./distribeatsMapper');
const policy = require('./distribeatsPolicy');
const { validateRelease, validateMappedPayload } = require('./distribeatsValidation');
const { planParts, MAX_PART } = require('../../lib/mediaValidation');
const { ISO_TERRITORIES } = require('../../lib/isoTerritories');

const client = new DistribeatsClient();
const cache = new Map();
const cached = (key, ttl, loader) => {
  const hit = cache.get(key);
  if (hit?.expiresAt > Date.now()) return hit.value;
  const value = Promise.resolve().then(loader);
  cache.set(key, { expiresAt: Date.now() + ttl, value });
  value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  return value;
};
const localFile = url => path.join(__dirname, '..', '..', String(url || '').replace(/^\/?uploads\//, 'uploads/'));
const mimeType = filename => ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav', '.flac': 'audio/flac' })[path.extname(String(filename || '')).toLowerCase()] || 'application/octet-stream';
const log = (event, details = {}) => console.info(JSON.stringify({ service: 'distribeats', event, at: new Date().toISOString(), ...details }));

// The catalogue is public and rarely changes. Serve the last good copy if a refresh fails so validation stays available.
let lastGoodCatalogue = null;
const fetchCatalogue = async () => {
  const fresh = await client.get('/catalogue', undefined, { requireAuth: false });
  lastGoodCatalogue = fresh;
  return fresh;
};
const getCatalogue = () => cached('catalogue', 15 * 60_000, () => fetchCatalogue().catch(error => {
  if (lastGoodCatalogue) return lastGoodCatalogue;
  throw error;
}));

const checkConnection = async () => {
  const mode = policy.describeMode(client.token);
  const base = {
    provider: 'distribeats', configured: client.isConfigured(), baseUrl: client.baseUrl || DEFAULT_BASE_URL,
    environment: mode.keyMode === 'live' ? 'live' : 'test',
    testMode: mode.testMode, liveAllowed: mode.liveAllowed, liveBlocked: mode.liveBlocked,
    credentialHint: client.token ? `••••••••${client.token.slice(-4)}` : '',
    checkedAt: new Date().toISOString(),
  };
  if (!client.isConfigured()) return { ...base, status: 'not_configured', message: 'Set DISTRIBEATS_API_KEY in the backend environment.' };
  if (mode.liveBlocked) {
    return { ...base, status: 'live_key_blocked', message: 'A live (db_live_) key is configured but this server is in TEST mode. Use a db_test_ key; no request was sent.' };
  }
  const started = Date.now();
  try {
    const [catalogue] = await Promise.all([
      getCatalogue(),
      client.get('/releases', { limit: 1 }, { retries: 0, timeout: 15000 }),
    ]);
    return { ...base, status: 'connected', latencyMs: Date.now() - started, message: mode.testMode ? 'Connected to Distribeats (TEST mode)' : 'Connected to Distribeats', catalogueVersion: catalogue?.version };
  } catch (error) {
    return { ...base, latencyMs: Date.now() - started, status: error.status === 401 || error.status === 403 ? 'authentication_error' : 'api_unavailable', message: error.message };
  }
};

const connectionStatus = (force = false) => {
  if (force) cache.delete('connection');
  return cached('connection', 30_000, checkConnection);
};

const SINGLE_REQUEST_LIMIT = 95 * 1024 * 1024; // provider: single PUT limited to 95 MiB (99,614,720 bytes)

/**
 * Upload one file to the provider. Streams from disk: files over 95 MiB use the documented multipart flow
 * (POST ?uploads -> PUT ?uploadId&partNumber -> POST complete). The assembled size can never exceed maxBytes
 * (the provider's own master limit; chunking does not bypass it).
 */
const uploadFile = async (releaseId, fileId, filePath, contentType, targetUrl, { maxBytes = policy.DEFAULT_MAX_AUDIO_BYTES, http = client } = {}) => {
  const uploadPath = targetUrl || `/releases/${releaseId}/upload/${encodeURIComponent(fileId)}`;
  const { size } = await fs.stat(filePath);
  if (size <= 0) throw new DistribeatsError('The file to upload is empty.', { code: 'DISTRIBEATS_FILE_EMPTY', status: 422 });
  if (size > maxBytes) throw new DistribeatsError(`File is ${size.toLocaleString('en-US')} bytes; the DistriBeats limit is ${maxBytes.toLocaleString('en-US')} bytes.`, { code: 'DISTRIBEATS_FILE_TOO_LARGE', status: 413 });
  const headers = { 'Content-Type': contentType };
  if (size <= SINGLE_REQUEST_LIMIT) return http.put(uploadPath, await fs.readFile(filePath), { headers, timeout: 240000, retries: 1 });
  const sep = uploadPath.includes('?') ? '&' : '?';
  const started = await http.post(`${uploadPath}${sep}uploads`, undefined, { headers, timeout: 60000 });
  const parts = [];
  const handle = await fs.open(filePath, 'r');
  try {
    for (const part of planParts(size, started?.partSize)) {
      const chunk = Buffer.alloc(part.end - part.start);
      await handle.read(chunk, 0, chunk.length, part.start);
      const result = await http.put(`${uploadPath}${sep}uploadId=${encodeURIComponent(started.uploadId)}&partNumber=${part.partNumber}`, chunk, { headers, timeout: 240000, retries: 1 });
      parts.push({ partNumber: part.partNumber, etag: result.etag });
    }
    return await http.post(`${uploadPath}${sep}uploadId=${encodeURIComponent(started.uploadId)}`, { parts }, { timeout: 60000 });
  } catch (error) {
    await http.delete(`${uploadPath}${sep}uploadId=${encodeURIComponent(started.uploadId)}`).catch(() => {});
    throw error;
  } finally { await handle.close(); }
};

const validationFailure = errors => new DistribeatsError('Release metadata does not meet DistriBeats requirements.', { code: 'DISTRIBEATS_VALIDATION_ERROR', status: 422, details: { errors } });

const submitRelease = async (release, artist) => {
  // Fail closed BEFORE any state change or network call: missing/invalid key -> 503, live key under TEST policy -> 403.
  policy.assertKeyAllowed(client.token);
  const catalogue = await getCatalogue();
  const audioMax = policy.maxAudioBytes(catalogue);
  const coverMax = policy.maxCoverBytes();
  if (!release.distribeatsReleaseId) {
    const report = validateRelease(release, { catalogue, mode: 'submit', maxAudioBytes: audioMax });
    if (!report.ready) throw validationFailure(report.errors);
  }
  release.syncStatus = 'syncing';
  release.lastSyncError = '';
  await release.save();
  try {
    if (artist && !artist.distribeatsArtistId) {
      const matchedArtist = await findArtist(artist).catch(() => null);
      if (matchedArtist?.id) {
        artist.distribeatsArtistId = String(matchedArtist.id);
        await artist.save().catch(() => {});
      }
    }
    let remote;
    if (!release.distribeatsReleaseId) {
      const payload = mapRelease(release, artist);
      const mappedErrors = validateMappedPayload(payload, catalogue);
      if (mappedErrors.length) throw validationFailure(mappedErrors);
      remote = await client.post('/releases', payload, { idempotencyKey: `hbe-release-${release._id}` });
      const remoteId = remote?.id || remote?.release_id;
      if (!remoteId) throw new DistribeatsError('Distribeats did not return a release id.', { code: 'DISTRIBEATS_RELEASE_ID_MISSING' });
      release.distribeatsReleaseId = String(remoteId);
      release.providerReleaseId = String(remoteId);
      release.provider = 'distribeats';
      release.distribeatsRawStatus = remote.status || 'Pending Upload';
      (remote.tracks || []).forEach((remoteTrack, index) => { if (release.tracks[index]) release.tracks[index].distribeatsTrackId = String(remoteTrack.id); });
      await release.save();
    } else {
      remote = await client.get(`/releases/${release.distribeatsReleaseId}`);
    }

    const uploadUrls = remote?.uploadUrls || {};
    if (release.coverArtUrl && release.uploadState?.artwork !== 'uploaded') {
      release.uploadState.artwork = 'uploading'; await release.save();
      const coverTarget = uploadUrls.cover || `/releases/${release.distribeatsReleaseId}/upload/cover`;
      await uploadFile(release.distribeatsReleaseId, 'cover', localFile(release.coverArtUrl), mimeType(release.coverArtFileName || release.coverArtUrl), coverTarget, { maxBytes: coverMax });
      release.uploadState.artwork = 'uploaded'; await release.save();
    }
    const remoteTracks = remote?.tracks || [];
    const uploadTrackKeys = Object.keys(uploadUrls).filter(k => k !== 'cover');
    for (let index = 0; index < release.tracks.length; index += 1) {
      const track = release.tracks[index];
      const trackId = track.distribeatsTrackId || remoteTracks[index]?.id || uploadTrackKeys[index];
      if (!trackId) throw new DistribeatsError(`Distribeats did not return an upload id for track ${index + 1}.`, { code: 'DISTRIBEATS_TRACK_ID_MISSING' });
      track.distribeatsTrackId = String(trackId);
      if (track.audioUrl && track.uploadStatus !== 'uploaded') {
        track.uploadStatus = 'uploading'; await release.save();
        const trackTarget = uploadUrls[trackId] || `/releases/${release.distribeatsReleaseId}/upload/${encodeURIComponent(trackId)}`;
        await uploadFile(release.distribeatsReleaseId, trackId, localFile(track.audioUrl), mimeType(track.audioFileName || track.audioUrl), trackTarget, { maxBytes: audioMax });
        track.uploadStatus = 'uploaded'; await release.save();
      }
    }
    let submitted;
    try {
      submitted = await client.post(`/releases/${release.distribeatsReleaseId}/submit`);
    } catch (submitErr) {
      if (submitErr.status === 409 && Array.isArray(submitErr.details?.missing)) {
        const missing = submitErr.details.missing;
        const retryUrls = submitErr.details.uploadUrls || uploadUrls;
        if (missing.includes('cover') && release.coverArtUrl) {
          await uploadFile(release.distribeatsReleaseId, 'cover', localFile(release.coverArtUrl), mimeType(release.coverArtFileName || release.coverArtUrl), retryUrls.cover, { maxBytes: coverMax });
        }
        for (let index = 0; index < release.tracks.length; index += 1) {
          const track = release.tracks[index];
          if (track.distribeatsTrackId && missing.includes(track.distribeatsTrackId) && track.audioUrl) {
            await uploadFile(release.distribeatsReleaseId, track.distribeatsTrackId, localFile(track.audioUrl), mimeType(track.audioFileName || track.audioUrl), retryUrls[track.distribeatsTrackId], { maxBytes: audioMax });
          }
        }
        submitted = await client.post(`/releases/${release.distribeatsReleaseId}/submit`);
      } else {
        throw submitErr;
      }
    }
    release.status = normalizeStatus(submitted?.status || 'Submitted');
    release.distribeatsRawStatus = submitted?.status || 'Submitted';
    release.syncStatus = 'synced';
    release.submittedAt = new Date();
    release.lastSyncedAt = new Date();
    release.syncErrors = [];
    release.providerPayload = submitted;
    await release.save();
    log('release_submitted', { localReleaseId: String(release._id), distribeatsReleaseId: release.distribeatsReleaseId });
    return release;
  } catch (error) {
    release.syncStatus = 'error';
    release.lastSyncError = error.message;
    release.syncErrors.push({ message: error.message, code: error.code || 'DISTRIBEATS_ERROR' });
    await release.save();
    throw error;
  }
};

const syncReleaseStatus = async release => {
  if (!release.distribeatsReleaseId) throw new DistribeatsError('Release has not been submitted to Distribeats.', { code: 'DISTRIBEATS_RELEASE_NOT_SYNCED', status: 409 });
  const remote = await client.get(`/releases/${release.distribeatsReleaseId}`);
  release.distribeatsRawStatus = remote.status || release.distribeatsRawStatus;
  release.status = normalizeStatus(remote.status);
  release.upc ||= remote.upc || '';
  (remote.tracks || []).forEach((item, index) => { if (release.tracks[index]) { release.tracks[index].isrc ||= item.isrc || ''; release.tracks[index].distribeatsTrackId ||= item.id || ''; } });
  release.lastSyncedAt = new Date();
  release.syncStatus = 'synced';
  release.lastSyncError = '';
  release.providerPayload = remote;
  if (release.status === 'delivered') release.deliveredAt ||= new Date();
  if (release.status === 'live') release.liveAt ||= new Date();
  await release.save();
  return release;
};

const requestTakedown = async (release, reason) => {
  if (!release.distribeatsReleaseId) throw new DistribeatsError('Release has not been submitted to Distribeats.', { status: 409 });
  const result = await client.post(`/releases/${release.distribeatsReleaseId}/takedown`, { reason });
  release.status = 'takedown_requested';
  release.providerPayload = result;
  release.lastSyncedAt = new Date();
  await release.save();
  return release;
};

const getReferenceData = async () => {
  const catalogue = await getCatalogue();
  const unavailable = new Set((catalogue.unavailableStores || []).map(String));
  return {
    ...catalogue,
    // Selectable stores exclude provider-flagged unavailable ones; the catalogue stays the source of truth.
    stores: (catalogue.stores || []).filter(store => !unavailable.has(String(store))),
    outlets: (catalogue.stores || []).filter(store => !unavailable.has(String(store))).map(store => ({ name: store, slug: store })),
    // The provider publishes no territory list: ISO 3166-1 alpha-2 codes are validated locally.
    territories: ISO_TERRITORIES,
    languages: catalogue.languages || [],
    policy: {
      ...policy.describeMode(client.token),
      leadTime: policy.leadTimeConfig(),
      earliestReleaseDate: policy.earliestReleaseDate().toISOString().slice(0, 10),
      maxAudioBytes: policy.maxAudioBytes(catalogue),
      maxCoverBytes: policy.maxCoverBytes(),
      artwork: policy.ARTWORK_SPEC,
      audioFormats: ['WAV', 'FLAC'],
    },
  };
};

const getReleaseDdex = async (release, { format = 'xml', version = '4.2', redirect = false } = {}) => {
  if (!release.distribeatsReleaseId) throw new DistribeatsError('Release has not been submitted to Distribeats.', { code: 'DISTRIBEATS_RELEASE_NOT_SYNCED', status: 409 });
  return client.get(`/releases/${release.distribeatsReleaseId}/ddex`, { format, version, redirect: redirect ? 'true' : undefined }, {
    headers: { Accept: format === 'json' ? 'application/json' : 'application/xml' },
  });
};

const listRemoteReleases = (query = {}) => client.get('/releases', query);
const listRemoteArtists = (query = {}) => client.get('/artists', query);
const sendInboundWebhook = (type, data = {}) => client.post('/webhooks/inbound', { type, data });

const findArtist = async artist => {
  let cursor;
  do {
    const page = await client.get('/artists', { limit: 100, starting_after: cursor });
    const match = (page.data || []).find(item => String(item.name || item.displayArtist || '').toLowerCase() === displayName(artist).toLowerCase());
    if (match) return match;
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return null;
};

module.exports = {
  client, connectionStatus, submitRelease, syncReleaseStatus, requestTakedown,
  getReferenceData, getCatalogue, findArtist, getReleaseDdex, listRemoteReleases,
  listRemoteArtists, sendInboundWebhook, normalizeStatus, uploadFile,
};
