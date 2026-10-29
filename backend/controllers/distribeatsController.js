const DistributionRelease = require('../models/DistributionRelease');
const Artist = require('../models/Artist');
const service = require('../services/distribeats/distribeatsService');
const { verifyWebhook } = require('../services/distribeats/distribeatsWebhook');

const emit = (event, data) => { try { global.io?.to('distribeats:admin').emit(event, data); } catch {} };
const emitRelease = release => {
  const data = {
    releaseId: String(release._id), title: release.title, status: release.status,
    syncStatus: release.syncStatus, distribeatsRawStatus: release.distribeatsRawStatus,
    distribeatsReleaseId: release.distribeatsReleaseId, storeStatuses: release.storeStatuses,
    lastSyncedAt: release.lastSyncedAt, lastSyncError: release.lastSyncError,
  };
  global.io?.to(`release:${release._id}`).emit('distribeats:release_updated', data);
  emit('distribeats:release_updated', data);
};

exports.status = async (req, res) => {
  try {
    const [connection, releaseCount, artistCount, errorCount, latest, latestError] = await Promise.all([
      service.connectionStatus(req.query.refresh === '1'),
      DistributionRelease.countDocuments({ distribeatsReleaseId: { $ne: '' } }),
      Artist.countDocuments({ distribeatsArtistId: { $ne: '' } }),
      DistributionRelease.countDocuments({ syncStatus: 'error' }),
      DistributionRelease.findOne({ lastSyncedAt: { $exists: true } }).sort({ lastSyncedAt: -1 }).select('lastSyncedAt').lean(),
      DistributionRelease.findOne({ syncStatus: 'error' }).sort({ updatedAt: -1 }).select('updatedAt lastSyncError').lean(),
    ]);
    const payload = {
      ...connection,
      releaseCount,
      syncedReleases: releaseCount,
      syncedArtists: artistCount,
      errorCount,
      syncErrors: errorCount,
      lastSyncedAt: latest?.lastSyncedAt,
      lastSuccessfulSync: latest?.lastSyncedAt,
      lastFailedSync: latestError?.updatedAt,
      webhookStatus: process.env.DISTRIBEATS_WEBHOOK_SECRET ? 'configured' : 'not_configured',
    };
    emit('distribeats:status', payload);
    res.json({ success: true, data: payload });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.catalogue = async (_req, res) => {
  try { res.json({ success: true, data: await service.getCatalogue() }); }
  catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.listRemoteReleases = async (req, res) => {
  try {
    const data = await service.listRemoteReleases({
      limit: req.query.limit,
      starting_after: req.query.starting_after,
      status: req.query.status,
    });
    res.json({ success: true, data });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.listRemoteArtists = async (req, res) => {
  try {
    const data = await service.listRemoteArtists({
      limit: req.query.limit,
      starting_after: req.query.starting_after,
    });
    res.json({ success: true, data });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.syncArtists = async (_req, res) => {
  try {
    const artists = await Artist.find({});
    const results = [];
    emit('distribeats:sync_progress', { type: 'artists_bulk', phase: 'started', total: artists.length });
    for (let index = 0; index < artists.length; index += 1) {
      const artist = artists[index];
      try {
        const matched = await service.findArtist(artist);
        if (matched?.id) {
          artist.distribeatsArtistId = String(matched.id);
          await artist.save();
          results.push({ id: artist._id, distribeatsArtistId: matched.id, matched: true, success: true });
        } else {
          results.push({ id: artist._id, matched: false, success: true });
        }
      } catch (error) {
        results.push({ id: artist._id, success: false, message: error.message });
      }
      emit('distribeats:sync_progress', { type: 'artists_bulk', phase: 'syncing', current: index + 1, total: artists.length });
    }
    emit('distribeats:sync_progress', { type: 'artists_bulk', phase: 'completed', total: artists.length, successCount: results.filter(item => item.matched).length });
    res.json({ success: true, data: results });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.inboundEvent = async (req, res) => {
  try {
    if (!req.body?.type) return res.status(422).json({ success: false, message: 'Event type is required' });
    const data = await service.sendInboundWebhook(req.body.type, req.body.data || {});
    res.status(202).json({ success: true, data });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.syncReleases = async (_req, res) => {
  const releases = await DistributionRelease.find({ distribeatsReleaseId: { $ne: '' } });
  const results = [];
  emit('distribeats:sync_progress', { type: 'releases_bulk', phase: 'started', total: releases.length });
  for (let index = 0; index < releases.length; index += 1) {
    try { await service.syncReleaseStatus(releases[index]); emitRelease(releases[index]); results.push({ id: releases[index]._id, success: true }); }
    catch (error) { results.push({ id: releases[index]._id, success: false, message: error.message }); }
    emit('distribeats:sync_progress', { type: 'releases_bulk', phase: 'syncing', current: index + 1, total: releases.length });
  }
  emit('distribeats:sync_progress', { type: 'releases_bulk', phase: 'completed', total: releases.length, successCount: results.filter(item => item.success).length });
  res.json({ success: true, data: results });
};

exports.webhook = async (req, res) => {
  try {
    const payload = verifyWebhook(req.body, {
      signature: req.get('X-DistriBeats-Signature'),
      timestamp: req.get('X-DistriBeats-Timestamp'),
    });
    const event = req.get('X-DistriBeats-Event') || payload.type || '';
    const deliveryId = req.get('X-DistriBeats-Delivery-Id') || payload.id;
    const remote = payload.data?.release;
    if (!remote?.id) return res.status(202).json({ received: true });
    const release = await DistributionRelease.findOne({ distribeatsReleaseId: String(remote.id) });
    if (!release) return res.status(202).json({ received: true });
    if (deliveryId && release.webhookEventKeys?.includes(deliveryId)) return res.status(200).json({ received: true, duplicate: true });
    if (deliveryId) release.webhookEventKeys.push(deliveryId);
    release.distribeatsRawStatus = remote.status || release.distribeatsRawStatus;
    release.status = service.normalizeStatus(remote.status);
    release.upc ||= remote.upc || '';
    release.lastSyncedAt = new Date();
    if (release.status === 'delivered') release.deliveredAt ||= new Date();
    if (release.status === 'live') release.liveAt ||= new Date();
    // Per DistriBeats Identifier sync docs: on release.approved or release.store_live,
    // call GET /releases/{id} to sync assigned upc and tracks[].isrc when API is configured.
    if ((event === 'release.approved' || event === 'release.store_live' || release.status === 'approved' || release.status === 'live') && service.client.isConfigured()) {
      await service.syncReleaseStatus(release).catch(() => release.save());
    } else {
      await release.save();
    }
    emitRelease(release);
    emit('distribeats:webhook_received', { event, releaseId: String(release._id), title: release.title, at: new Date() });
    res.status(200).json({ received: true });
  } catch (error) { res.status(error.status || 401).json({ received: false, message: error.message }); }
};
