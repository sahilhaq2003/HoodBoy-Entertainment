const crypto = require('crypto');
const Artist = require('../models/Artist');
const DistributionRelease = require('../models/DistributionRelease');
const service = require('../services/labelgrid/labelgridService');
const { verifyWebhook } = require('../services/labelgrid/labelgridWebhook');

/** Emit a Socket.IO event to all admin clients (no-op when io is not ready). */
const emit = (event, data) => {
  try { global.io?.to('labelgrid:admin').emit(event, data); } catch {}
};

/** Emit an event to everyone watching a specific release. */
const emitRelease = (releaseId, event, data) => {
  try {
    global.io?.to(`release:${releaseId}`).emit(event, data);
    global.io?.to('labelgrid:admin').emit(event, data);
  } catch {}
};

// ── Admin summary ──────────────────────────────────────────────────────────────
exports.status = async (_req, res) => {
  const [connection, syncedArtists, syncedReleases, syncErrors, lastSuccess, lastFailure] = await Promise.all([
    service.connectionStatus(),
    Artist.countDocuments({ labelgridArtistId: { $ne: '' } }),
    DistributionRelease.countDocuments({ labelgridReleaseId: { $ne: '' } }),
    DistributionRelease.countDocuments({ syncStatus: 'error' }),
    DistributionRelease.findOne({ lastSyncedAt: { $exists: true } }).sort({ lastSyncedAt: -1 }).select('lastSyncedAt').lean(),
    DistributionRelease.findOne({ 'syncErrors.0': { $exists: true } }).sort({ 'syncErrors.occurredAt': -1 }).select('syncErrors').lean(),
  ]);
  const payload = {
    ...connection,
    syncedArtists,
    syncedReleases,
    syncErrors,
    lastSuccessfulSync: lastSuccess?.lastSyncedAt,
    lastFailedSync: lastFailure?.syncErrors?.at(-1)?.occurredAt,
    webhookStatus: process.env.LABELGRID_WEBHOOK_SECRET ? 'configured' : 'not_configured',
  };
  // Broadcast to all admin sockets so LabelGrid status panels update live.
  emit('labelgrid:status', payload);
  res.json({ success: true, data: payload });
};

// ── Single artist sync ─────────────────────────────────────────────────────────
exports.syncArtist = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    emit('labelgrid:sync_progress', { type: 'artist', phase: 'started', artistId: String(artist._id), name: artist.stageName || artist.name });
    const remote = await service.syncArtist(artist);
    emit('labelgrid:sync_progress', { type: 'artist', phase: 'completed', artistId: String(artist._id), labelgridArtistId: artist.labelgridArtistId });
    res.json({ success: true, data: artist, remote });
  } catch (error) {
    await Artist.findByIdAndUpdate(req.params.id, { labelgridSyncStatus: 'error', labelgridSyncError: error.message }).catch(() => {});
    emit('labelgrid:sync_progress', { type: 'artist', phase: 'error', artistId: req.params.id, message: error.message });
    res.status(error.status || 502).json({ success: false, message: error.message, code: error.code });
  }
};

// ── Bulk artist sync ───────────────────────────────────────────────────────────
exports.syncArtists = async (_req, res) => {
  const artists = await Artist.find({ status: { $ne: 'inactive' } });
  const results = [];
  const total = artists.length;

  emit('labelgrid:sync_progress', { type: 'artists_bulk', phase: 'started', total });

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    try {
      emit('labelgrid:sync_progress', { type: 'artists_bulk', phase: 'syncing', current: i + 1, total, name: artist.stageName || artist.name });
      await service.syncArtist(artist);
      results.push({ id: artist._id, success: true, name: artist.stageName || artist.name });
      emit('labelgrid:sync_progress', { type: 'artists_bulk', phase: 'artist_done', current: i + 1, total, name: artist.stageName || artist.name, success: true });
    } catch (error) {
      artist.labelgridSyncStatus = 'error';
      artist.labelgridSyncError = error.message;
      await artist.save();
      results.push({ id: artist._id, success: false, message: error.message });
      emit('labelgrid:sync_progress', { type: 'artists_bulk', phase: 'artist_done', current: i + 1, total, name: artist.stageName || artist.name, success: false, message: error.message });
    }
  }

  const allOk = results.every(r => r.success);
  emit('labelgrid:sync_progress', { type: 'artists_bulk', phase: 'completed', total, successCount: results.filter(r => r.success).length });
  res.status(allOk ? 200 : 207).json({ success: allOk, data: results });
};

// ── Bulk release sync ──────────────────────────────────────────────────────────
exports.syncReleases = async (_req, res) => {
  const releases = await DistributionRelease.find({ labelgridReleaseId: { $ne: '' } });
  const results = [];
  const total = releases.length;

  emit('labelgrid:sync_progress', { type: 'releases_bulk', phase: 'started', total });

  for (let i = 0; i < releases.length; i++) {
    const release = releases[i];
    try {
      emit('labelgrid:sync_progress', { type: 'releases_bulk', phase: 'syncing', current: i + 1, total, title: release.title });
      await service.syncReleaseStatus(release);
      results.push({ id: release._id, success: true });
      emitRelease(String(release._id), 'labelgrid:release_updated', {
        releaseId: String(release._id),
        title: release.title,
        status: release.status,
        labelgridRawStatus: release.labelgridRawStatus,
        storeStatuses: release.storeStatuses,
        lastSyncedAt: release.lastSyncedAt,
      });
    } catch (error) {
      results.push({ id: release._id, success: false, message: error.message });
    }
  }

  const allOk = results.every(r => r.success);
  emit('labelgrid:sync_progress', { type: 'releases_bulk', phase: 'completed', total, successCount: results.filter(r => r.success).length });
  res.status(allOk ? 200 : 207).json({ success: allOk, data: results });
};

// ── Incoming LabelGrid webhook ─────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  try {
    const payload = verifyWebhook(req.body, req.get('X-Webhook-Signature'));
    const remoteId = payload.data?.release_id;
    if (!remoteId) return res.sendStatus(204);

    const release = await DistributionRelease.findOne({ labelgridReleaseId: String(remoteId) });
    if (!release) return res.sendStatus(204);

    // Idempotency — reject duplicate events.
    const stableId = payload.data.distro_queue_id || payload.data.track_id || `${payload.data.outlet_id || ''}:${payload.data.new_status || payload.data.status || ''}`;
    const key = crypto.createHash('sha256').update(`${payload.event}:${remoteId}:${stableId}`).digest('hex');
    if (release.webhookEventKeys.includes(key)) return res.sendStatus(204);
    release.webhookEventKeys.push(key);
    if (release.webhookEventKeys.length > 100) release.webhookEventKeys = release.webhookEventKeys.slice(-100);

    // Apply state changes.
    if (payload.event === 'release.review.status_changed') {
      release.labelgridRawStatus = payload.data.new_status;
      release.status = service.normalizeStatus({ review_status: payload.data.new_status });
    }
    if (['delivery.completed', 'delivery.failed', 'takedown.completed', 'distribution.outlet.status_changed'].includes(payload.event)) {
      const store = payload.data.outlet_name || `Outlet ${payload.data.outlet_id}`;
      const existing = release.storeStatuses.find(s => s.store === store);
      const next = { store, status: payload.data.status, updatedAt: new Date() };
      if (existing) Object.assign(existing, next); else release.storeStatuses.push(next);
      if (payload.event === 'delivery.failed') { release.status = 'error'; release.lastSyncError = payload.data.message || 'LabelGrid delivery failed.'; }
      if (payload.event === 'takedown.completed') release.status = 'removed';
    }
    if (payload.event === 'audio.transcode.completed') {
      const track = release.tracks.find(t => String(t.labelgridTrackId) === String(payload.data.track_id));
      if (track) track.uploadStatus = 'uploaded';
    }

    release.lastSyncedAt = new Date();
    await release.save();

    // ── Real-time broadcast ──────────────────────────────────────────────────
    const liveData = {
      releaseId: String(release._id),
      title: release.title,
      status: release.status,
      labelgridRawStatus: release.labelgridRawStatus,
      storeStatuses: release.storeStatuses,
      lastSyncedAt: release.lastSyncedAt,
      event: payload.event,
      eventData: {
        outlet: payload.data.outlet_name,
        outletStatus: payload.data.status,
        message: payload.data.message,
      },
    };
    emitRelease(String(release._id), 'labelgrid:release_updated', liveData);
    emit('labelgrid:webhook_received', { event: payload.event, releaseId: String(release._id), title: release.title, at: new Date() });

    res.sendStatus(204);
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
};
