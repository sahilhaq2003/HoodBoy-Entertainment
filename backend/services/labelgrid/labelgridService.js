const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { LabelGridClient, DEFAULT_BASE_URL } = require('./labelgridClient');
const { LabelGridError } = require('./labelgridErrors');
const { mapArtist, mapRelease, mapTrack, normalizeStatus } = require('./labelgridMapper');

const client = new LabelGridClient();
const log = (event, details = {}) => console.info(JSON.stringify({ service: 'labelgrid', event, at: new Date().toISOString(), ...details }));
const localFile = url => path.join(__dirname, '..', '..', String(url || '').replace(/^\/?uploads\//, 'uploads/'));
const clean = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined && value !== ''));

const connectionStatus = async () => {
  const base = { provider: 'labelgrid', configured: client.isConfigured(), baseUrl: client.baseUrl || DEFAULT_BASE_URL, credentialHint: process.env.LABELGRID_API_TOKEN ? `••••••••${process.env.LABELGRID_API_TOKEN.slice(-4)}` : '', status: 'connection_error' };
  if (!client.isConfigured()) return { ...base, status: 'not_configured', message: 'LabelGrid API token is not configured.' };
  try { const account = await client.get('/me'); return { ...base, status: 'connected', message: 'Connected', account: { username: account.username, email: account.email, stats: account.stats } }; }
  catch (error) { return { ...base, status: error.code === 'LABELGRID_AUTHENTICATION_ERROR' ? 'authentication_error' : 'api_unavailable', message: error.message }; }
};

const resolveGenreId = async genre => {
  const genres = await client.get('/genres');
  const match = genres.find(item => item.name.toLowerCase() === String(genre).toLowerCase()) || genres.find(item => item.name.toLowerCase().includes(String(genre).toLowerCase()));
  if (!match) throw new LabelGridError(`Genre "${genre}" is not available in LabelGrid.`, { code: 'LABELGRID_GENRE_NOT_FOUND', status: 422 });
  return match.id;
};

const syncArtist = async artist => {
  const payload = clean(mapArtist(artist));
  log('artist_sync_started', { localArtistId: String(artist._id), update: Boolean(artist.labelgridArtistId) });
  const data = artist.labelgridArtistId ? await client.patch(`/artists/${artist.labelgridArtistId}`, payload) : await client.post('/artists', payload);
  artist.labelgridArtistId = String(data.id); artist.labelgridSyncStatus = 'synced'; artist.labelgridLastSyncedAt = new Date(); artist.labelgridSyncError = '';
  await artist.save(); log('artist_sync_completed', { localArtistId: String(artist._id), labelgridArtistId: artist.labelgridArtistId });
  return data;
};

const uploadArtwork = async release => {
  const bytes = await fs.readFile(localFile(release.coverArtUrl));
  const form = new FormData(); form.append('file', new Blob([bytes]), release.coverArtFileName || 'cover.jpg');
  release.uploadState.artwork = 'uploading'; await release.save();
  try { const result = await client.post(`/releases/${release.labelgridReleaseId}/photo`, form); release.uploadState.artwork = 'uploaded'; return result; }
  catch (error) { release.uploadState.artwork = 'failed'; throw error; }
};

const uploadAudio = async (track, release) => {
  const bytes = await fs.readFile(localFile(track.audioUrl));
  track.uploadStatus = 'uploading'; await release.save();
  try {
    const prepared = await client.post(`/tracks/${track.labelgridTrackId}/files/stereo/upload-url`, { filename: track.audioFileName });
    const uploaded = await fetch(prepared.upload_url, { method: 'PUT', body: bytes, signal: AbortSignal.timeout(120000) });
    if (!uploaded.ok) throw new LabelGridError('Audio upload failed.', { code: 'LABELGRID_AUDIO_UPLOAD_FAILED', status: 502 });
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    const result = await client.put(`/tracks/${track.labelgridTrackId}/files/stereo`, { s3_key: prepared.key, checksum });
    track.uploadStatus = result?.queued ? 'processing' : 'uploaded'; track.labelgridUploadAttemptId = result?.upload_attempt?.id || '';
    return result;
  } catch (error) { track.uploadStatus = 'failed'; throw error; }
};

const submitRelease = async (release, artist) => {
  if (!process.env.LABELGRID_LABEL_ID) throw new LabelGridError('LABELGRID_LABEL_ID is required.', { code: 'LABELGRID_LABEL_ID_REQUIRED', status: 503 });
  if (!artist.labelgridArtistId) await syncArtist(artist);
  const genreId = await resolveGenreId(release.genre);
  release.syncStatus = 'syncing'; release.lastSyncError = ''; await release.save();
  try {
    if (!release.labelgridReleaseId) {
      const remote = await client.post('/releases', mapRelease(release, artist, genreId));
      release.labelgridReleaseId = String(remote.id); release.providerReleaseId = String(remote.id); release.provider = 'labelgrid'; release.labelgridRawStatus = remote.review_status || remote.delivery_status || 'draft';
      await release.save();
    }
    if (release.coverArtUrl && release.uploadState.artwork !== 'uploaded') { await uploadArtwork(release); await release.save(); }
    for (let index = 0; index < release.tracks.length; index += 1) {
      const track = release.tracks[index];
      if (!track.labelgridTrackId) {
        const remoteTrack = await client.post('/tracks', mapTrack(track, release, artist, index, genreId));
        track.labelgridTrackId = String(remoteTrack.id || remoteTrack.data?.id);
        if (!track.labelgridTrackId || track.labelgridTrackId === 'undefined') throw new LabelGridError('LabelGrid did not return a track ID.', { code: 'LABELGRID_TRACK_ID_MISSING' });
        await release.save();
      }
      if (track.audioUrl && !['uploaded', 'processing'].includes(track.uploadStatus)) { await uploadAudio(track, release); await release.save(); }
    }
    const validation = await client.post(`/releases/${release.labelgridReleaseId}/validate`);
    release.validationResult = validation;
    if (validation.result !== 'OK') throw new LabelGridError('Required release metadata is missing.', { code: 'LABELGRID_VALIDATION_FAILED', status: 422, details: validation });
    const distributed = await client.post(`/releases/${release.labelgridReleaseId}/distribute`);
    release.status = 'submitted'; release.labelgridRawStatus = distributed.status; release.syncStatus = 'synced'; release.submittedAt = new Date(); release.lastSyncedAt = new Date(); release.syncErrors = [];
    await release.save(); log('release_submitted', { localReleaseId: String(release._id), labelgridReleaseId: release.labelgridReleaseId });
    return release;
  } catch (error) {
    release.syncStatus = 'error'; release.lastSyncError = error.message; release.syncErrors.push({ message: error.message, code: error.code || 'LABELGRID_ERROR' }); await release.save(); throw error;
  }
};

const syncReleaseStatus = async release => {
  if (!release.labelgridReleaseId) throw new LabelGridError('Release has not been submitted to LabelGrid.', { code: 'LABELGRID_RELEASE_NOT_SYNCED', status: 409 });
  const [remote, delivery] = await Promise.all([client.get(`/releases/${release.labelgridReleaseId}`), client.get(`/releases/${release.labelgridReleaseId}/delivery-status`)]);
  release.labelgridRawStatus = delivery.state || remote.review_status || remote.delivery_status; release.status = normalizeStatus(delivery.state && delivery.state !== 'not_submitted' ? delivery : remote);
  release.storeStatuses = (delivery.outlets || []).map(item => ({ store: item.outlet, status: item.customer_state || item.state, url: item.action_url || '', updatedAt: item.updated_at ? new Date(item.updated_at) : new Date() }));
  release.lastSyncedAt = new Date(); release.syncStatus = 'synced'; release.lastSyncError = ''; release.providerPayload = { review_status: remote.review_status, delivery_status: remote.delivery_status, delivery };
  if (delivery.currently_live) release.liveAt ||= new Date(); await release.save(); return release;
};

const getReferenceData = async () => {
  const [outlets, genres, languages, territories] = await Promise.all([client.get('/distro-outlets'), client.get('/genres'), client.get('/languages'), client.get('/territories')]);
  return { outlets, genres, languages, territories };
};

const getRoyalties = query => client.get('/royalties/breakdown', { group_by: query.group_by || 'dsp,period', per_page: query.per_page || 100, ...query });
const getAnalytics = query => client.get('/analytics/summary', { 'filter[start_date]': query.startDate, 'filter[end_date]': query.endDate, 'metrics[]': query.metrics || ['streams', 'listeners', 'streams-by-country'] });

module.exports = { client, connectionStatus, syncArtist, submitRelease, syncReleaseStatus, getReferenceData, getRoyalties, getAnalytics, normalizeStatus };
