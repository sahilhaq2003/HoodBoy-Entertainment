const fs = require('fs/promises');
const path = require('path');
const { DistribeatsClient, DistribeatsError, DEFAULT_BASE_URL } = require('./distribeatsClient');
const { mapRelease, normalizeStatus, displayName } = require('./distribeatsMapper');

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

const getCatalogue = () => cached('catalogue', 15 * 60_000, () => client.get('/catalogue', undefined, { requireAuth: false }));

const connectionStatus = () => cached('connection', 30_000, async () => {
  const base = {
    provider: 'distribeats', configured: client.isConfigured(), baseUrl: client.baseUrl || DEFAULT_BASE_URL,
    environment: process.env.DISTRIBEATS_API_KEY?.startsWith('db_live_') ? 'live' : 'test',
    credentialHint: process.env.DISTRIBEATS_API_KEY ? `••••••••${process.env.DISTRIBEATS_API_KEY.slice(-4)}` : '',
  };
  if (!client.isConfigured()) return { ...base, status: 'not_configured', message: 'Set DISTRIBEATS_API_KEY in the backend environment.' };
  try {
    const [catalogue] = await Promise.all([
      getCatalogue(),
      client.get('/releases', { limit: 1 }),
    ]);
    return { ...base, status: 'connected', message: 'Connected to Distribeats', catalogueVersion: catalogue?.version };
  } catch (error) {
    return { ...base, status: error.status === 401 || error.status === 403 ? 'authentication_error' : 'api_unavailable', message: error.message };
  }
});

const uploadBytes = async (releaseId, fileId, bytes, contentType, targetUrl) => {
  const uploadPath = targetUrl || `/releases/${releaseId}/upload/${encodeURIComponent(fileId)}`;
  if (bytes.length <= 95 * 1024 * 1024) return client.put(uploadPath, bytes, { headers: { 'Content-Type': contentType }, timeout: 240000, retries: 1 });
  if (bytes.length > 150_000_000) throw new DistribeatsError('Audio exceeds the Distribeats 150 MB assembled-file limit.', { code: 'DISTRIBEATS_FILE_TOO_LARGE', status: 413 });
  const sep = uploadPath.includes('?') ? '&' : '?';
  const started = await client.post(`${uploadPath}${sep}uploads`, undefined, { headers: { 'Content-Type': contentType }, timeout: 60000 });
  const partSize = Number(started?.partSize) || 52_428_800;
  const parts = [];
  try {
    for (let offset = 0, partNumber = 1; offset < bytes.length; offset += partSize, partNumber += 1) {
      const result = await client.put(`${uploadPath}${sep}uploadId=${encodeURIComponent(started.uploadId)}&partNumber=${partNumber}`, bytes.subarray(offset, Math.min(offset + partSize, bytes.length)), { headers: { 'Content-Type': contentType }, timeout: 240000, retries: 1 });
      parts.push({ partNumber, etag: result.etag });
    }
    return await client.post(`${uploadPath}${sep}uploadId=${encodeURIComponent(started.uploadId)}`, { parts }, { timeout: 60000 });
  } catch (error) {
    await client.delete(`${uploadPath}${sep}uploadId=${encodeURIComponent(started.uploadId)}`).catch(() => {});
    throw error;
  }
};

const validateMappedPayload = payload => {
  const errors = [];
  for (const field of ['title', 'displayArtist', 'genre', 'subGenre', 'language', 'releaseDate', 'pLine', 'cLine']) if (!payload[field]) errors.push(`${field} is required by Distribeats`);
  if (!payload.stores?.length) errors.push('Select at least one Distribeats store');
  if (!payload.attestations?.age || !payload.attestations?.rights) errors.push('Age and rights attestations must both be accepted');
  if (payload.releaseType === 'Single' && payload.tracks?.length === 1 && payload.tracks[0].title !== payload.title) {
    errors.push('For a Single release, the track title must equal the release title');
  }
  const hasAiTrack = payload.tracks.some(track => track.aiUsage === 'Partial' || track.aiUsage === 'Full');
  if (hasAiTrack && !/^https:\/\/.*\.pdf(?:\?|$)/i.test(String(payload.aiDocumentUrl || ''))) {
    errors.push('An HTTPS PDF aiDocumentUrl is required when any track uses Partial or Full AI');
  }
  if (hasAiTrack && payload.stores?.includes('YouTube Content ID')) {
    errors.push('YouTube Content ID cannot be selected when any track uses AI');
  }
  payload.tracks.forEach((track, index) => {
    for (const field of ['composers', 'producers', 'mixingEngineers', 'masteringEngineers']) if (!track[field]) errors.push(`Track ${index + 1}: ${field} is required`);
    if (!track.instrumental && track.language !== 'Instrumental' && !track.writers) errors.push(`Track ${index + 1}: writers is required unless instrumental`);
    if ((track.compositionType === 'Cover' || track.copyrightType === 'Licensed') && !track.rightsProofUrl) {
      errors.push(`Track ${index + 1}: rightsProofUrl is required for Cover or Licensed tracks`);
    }
  });
  if (errors.length) throw new DistribeatsError('Release metadata does not meet Distribeats requirements.', { code: 'DISTRIBEATS_VALIDATION_ERROR', status: 422, details: { errors } });
};

const submitRelease = async (release, artist) => {
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
      validateMappedPayload(payload);
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
      await uploadBytes(release.distribeatsReleaseId, 'cover', await fs.readFile(localFile(release.coverArtUrl)), mimeType(release.coverArtFileName || release.coverArtUrl), coverTarget);
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
        await uploadBytes(release.distribeatsReleaseId, trackId, await fs.readFile(localFile(track.audioUrl)), mimeType(track.audioFileName || track.audioUrl), trackTarget);
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
          await uploadBytes(release.distribeatsReleaseId, 'cover', await fs.readFile(localFile(release.coverArtUrl)), mimeType(release.coverArtFileName || release.coverArtUrl), retryUrls.cover);
        }
        for (let index = 0; index < release.tracks.length; index += 1) {
          const track = release.tracks[index];
          if (track.distribeatsTrackId && missing.includes(track.distribeatsTrackId) && track.audioUrl) {
            await uploadBytes(release.distribeatsReleaseId, track.distribeatsTrackId, await fs.readFile(localFile(track.audioUrl)), mimeType(track.audioFileName || track.audioUrl), retryUrls[track.distribeatsTrackId]);
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
  return {
    ...catalogue,
    outlets: (catalogue.stores || []).map(store => typeof store === 'string' ? { name: store, slug: store } : store),
    territories: catalogue.territories || [],
    languages: catalogue.languages || [],
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
  listRemoteArtists, sendInboundWebhook, normalizeStatus,
};
