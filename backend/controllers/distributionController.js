const DistributionRelease = require('../models/DistributionRelease');
const Artist = require('../models/Artist');
const RoyaltyLedger = require('../models/RoyaltyLedger');
const distribeats = require('../services/distribeats/distribeatsService');
const qcService = require('../services/qcService');

/** Emit a release update to all sockets watching that release and all admin sockets. */
const emitRelease = (release) => {
  try {
    const payload = {
      releaseId: String(release._id),
      title: release.title,
      status: release.status,
      syncStatus: release.syncStatus,
      distribeatsRawStatus: release.distribeatsRawStatus,
      distribeatsReleaseId: release.distribeatsReleaseId,
      storeStatuses: release.storeStatuses,
      uploadState: release.uploadState,
      lastSyncedAt: release.lastSyncedAt,
      lastSyncError: release.lastSyncError,
    };
    global.io?.to(`release:${release._id}`).emit('distribeats:release_updated', payload);
    global.io?.to('distribeats:admin').emit('distribeats:release_updated', payload);
  } catch {}
};

const artistForUser = req => req.user.role === 'artist' ? Artist.findOne({ email: req.user.email }).select('_id') : null;
const parseArray = value => Array.isArray(value) ? value : String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const parseJson = (value, fallback) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

const scope = async req => {
  if (req.user.role !== 'artist') return {};
  const artist = await artistForUser(req);
  return { artist: artist?._id || null };
};

const validateRelease = release => {
  const errors = [];
  if (!release.title) errors.push('Release title is required');
  if (!release.artist) errors.push('Artist is required');
  if (!release.releaseDate) errors.push('Release date is required');
  if (!release.genre) errors.push('Genre is required');
  if (!release.copyright) errors.push('Copyright information is required');
  if (!release.coverArtUrl) errors.push('Cover artwork is required');
  if (!release.tracks?.length) errors.push('At least one track is required');
  release.tracks?.forEach((track, index) => {
    if (!track.title) errors.push(`Track ${index + 1}: title is required`);
    if (!track.audioUrl) errors.push(`Track ${index + 1}: audio file is required`);
    if (track.audioFileName && !/\.(wav|flac)$/i.test(track.audioFileName)) errors.push(`Track ${index + 1}: Distribeats accepts WAV or FLAC audio only`);
    if (!track.contributors?.some(item => item.role === 'primary_artist')) errors.push(`Track ${index + 1}: primary artist credit is required`);
  });
  return errors;
};

exports.connectionStatus = async (req, res) => {
  const status = await distribeats.connectionStatus();
  if (req.user.role !== 'admin') { delete status.credentialHint; delete status.account; }
  res.json({ success: true, data: status });
};

exports.referenceData = async (_req, res) => {
  try { res.json({ success: true, data: await distribeats.getReferenceData() }); }
  catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.getAll = async (req, res) => {
  try {
    const filter = await scope(req);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.artist && req.user.role !== 'artist') filter.artist = req.query.artist;
    if (req.query.q) filter.$or = [
      { title: { $regex: req.query.q, $options: 'i' } },
      { upc: { $regex: req.query.q, $options: 'i' } },
      { providerReleaseId: { $regex: req.query.q, $options: 'i' } },
    ];
    const data = await DistributionRelease.find(filter)
      .populate('artist', 'name stageName artistName image')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) })
      .populate('artist', 'name stageName artistName image')
      .lean();
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    res.json({ success: true, data: release });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const payloadFromRequest = async req => {
  const tracks = parseJson(req.body.tracks, []);
  const files = req.files || [];
  const cover = files.find(file => file.fieldname === 'cover');
  tracks.forEach((track, index) => {
    const file = files.find(item => item.fieldname === `audio_${index}`);
    if (file) { track.audioUrl = `/uploads/distribution/${file.filename}`; track.audioFileName = file.originalname; }
    track.contributors = parseJson(track.contributors, track.contributors || []);
  });
  let artist = req.body.artist;
  if (req.user.role === 'artist') artist = (await artistForUser(req))?._id;
  return {
    title: req.body.title, artist, type: req.body.type || 'single', releaseDate: req.body.releaseDate,
    genre: req.body.genre, language: req.body.language || 'English', explicit: String(req.body.explicit) === 'true',
    upc: req.body.upc || '', copyright: req.body.copyright, producer: req.body.producer || '',
    featuringArtists: parseArray(req.body.featuringArtists), songwriters: parseArray(req.body.songwriters),
    composers: parseArray(req.body.composers), territories: parseArray(req.body.territories || 'WORLDWIDE'),
    subGenre: req.body.subGenre || '', mixingEngineers: parseArray(req.body.mixingEngineers),
    masteringEngineers: parseArray(req.body.masteringEngineers), spotifyArtistUrl: req.body.spotifyArtistUrl || '',
    aiDocumentUrl: req.body.aiDocumentUrl || '',
    attestations: parseJson(req.body.attestations, { age: false, rights: false }),
    excludedTerritories: parseArray(req.body.excludedTerritories), tracks,
    catalogNumber: req.body.catalogNumber || '', publishingCopyright: req.body.publishingCopyright || '',
    artworkAiUsage: req.body.artworkAiUsage || 'none', dspOutletIds: parseArray(req.body.dspOutletIds || 'all_dsps'),
    ...(cover ? { coverArtUrl: `/uploads/distribution/${cover.filename}`, coverArtFileName: cover.originalname } : {}),
  };
};

exports.create = async (req, res) => {
  try {
    const payload = await payloadFromRequest(req);
    const release = await DistributionRelease.create({ ...payload, createdBy: req.user._id, updatedBy: req.user._id });
    qcService.queueReleaseForQc(release._id);
    res.status(201).json({ success: true, data: release });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.update = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    if (release.status !== 'draft') return res.status(409).json({ success: false, message: 'Only draft releases can be edited' });
    Object.assign(release, await payloadFromRequest(req), { updatedBy: req.user._id });
    // Reset QC status if edited
    release.qcStatus = 'pending_qc';
    await release.save();
    qcService.queueReleaseForQc(release._id);
    res.json({ success: true, data: release });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.submit = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    if (!['draft', 'rejected', 'error'].includes(release.status)) return res.status(409).json({ success: false, message: 'Release has already been submitted' });
    
    if (release.qcStatus !== 'ready_for_distribution') {
      return res.status(422).json({ 
        success: false, 
        message: 'Release cannot be submitted to Distribeats until Content/QC review is completed.'
      });
    }

    const errors = validateRelease(release);
    if (errors.length) return res.status(422).json({ success: false, message: 'Release is not ready for distribution', errors });
    const artist = await Artist.findById(release.artist);
    await distribeats.submitRelease(release, artist);
    emitRelease(release);
    res.json({ success: true, data: release, integration: await distribeats.connectionStatus() });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code, errors: error.details?.errors || error.details?.errors_structured }); }
};

exports.distribute = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    if (!release.distribeatsReleaseId) return res.status(409).json({ success: false, message: 'Release has not been submitted to Distribeats.' });
    await distribeats.syncReleaseStatus(release);
    emitRelease(release);
    res.json({ success: true, data: release });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.sync = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    await distribeats.syncReleaseStatus(release);
    emitRelease(release);
    res.json({ success: true, data: release, integration: await distribeats.connectionStatus() });
  } catch (error) {
    await DistributionRelease.findByIdAndUpdate(req.params.id, { $push: { syncErrors: { message: error.message, code: error.code || 'SYNC_ERROR' } }, status: 'error' }).catch(() => {});
    res.status(502).json({ success: false, message: error.message, code: error.code });
  }
};

exports.takedown = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    if (!req.body.reason?.trim()) return res.status(422).json({ success: false, message: 'A takedown reason is required' });
    await distribeats.requestTakedown(release, req.body.reason.trim());
    emitRelease(release);
    res.json({ success: true, data: release });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.getDdex = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    const format = req.query.format === 'json' ? 'json' : 'xml';
    const version = req.query.version === '3.8.2' ? '3.8.2' : '4.2';
    const feed = await distribeats.getReleaseDdex(release, { format, version, redirect: req.query.redirect === 'true' });
    if (format === 'json' || typeof feed === 'object') return res.json({ success: true, data: feed });
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ern-${release.distribeatsReleaseId || release._id}-${version}.xml"`);
    res.send(feed);
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message, code: error.code }); }
};

exports.royaltySummary = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'artist') filter.artist = (await artistForUser(req))?._id || null;
    if (req.query.period) filter.period = req.query.period;
    const entries = await RoyaltyLedger.find(filter).populate('artist', 'name stageName').populate('release', 'title').populate('song', 'title').sort({ periodStart: -1 }).lean();
    const byPlatform = {};
    const byRelease = {};
    const byTrack = {};
    let totalRevenue = 0; let artistEarnings = 0; let streamsSales = 0;
    entries.forEach(entry => {
      totalRevenue += entry.grossIncome || 0; artistEarnings += entry.artistShare || 0;
      Object.entries(entry.incomeBySource || {}).forEach(([key, value]) => { byPlatform[key] = (byPlatform[key] || 0) + Number(value || 0); });
      if (entry.release?.title) byRelease[entry.release.title] = (byRelease[entry.release.title] || 0) + entry.grossIncome;
      if (entry.song?.title) byTrack[entry.song.title] = (byTrack[entry.song.title] || 0) + entry.grossIncome;
      streamsSales += Number(entry.units || entry.streams || 0);
    });
    res.json({ success: true, data: { totalRevenue, artistEarnings, streamsSales, byPlatform, byRelease, byTrack, entries, source: 'local_ledger' } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.exportRoyalties = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'artist') filter.artist = (await artistForUser(req))?._id || null;
    const entries = await RoyaltyLedger.find(filter).populate('artist', 'name stageName').populate('release', 'title').populate('song', 'title').sort({ periodStart: -1 }).lean();
    const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['Period', 'Artist', 'Release', 'Track', 'Gross Revenue', 'Artist Earnings', 'Paid', 'Balance', 'Status'], ...entries.map(e => [e.period, e.artist?.stageName || e.artist?.name, e.release?.title, e.song?.title, e.grossIncome, e.artistShare, e.totalPaid, e.remainingBalance, e.status])];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="royalty-report.csv"');
    res.send(rows.map(row => row.map(escape).join(',')).join('\n'));
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.adminUpdateQc = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const release = await DistributionRelease.findById(req.params.id);
    if (!release) return res.status(404).json({ success: false, message: 'Not found' });
    
    if (req.body.qcStatus) release.qcStatus = req.body.qcStatus;
    if (req.body.rightsStatus) release.rightsStatus = req.body.rightsStatus;
    if (req.body.adminReviewNotes) release.adminReviewNotes = req.body.adminReviewNotes;
    
    release.qcHistory.push({
      action: 'Admin Review Update',
      status: req.body.qcStatus || release.qcStatus,
      notes: req.body.notes || 'Status updated by admin',
      performedBy: req.user._id
    });
    
    await release.save();
    emitRelease(release);
    res.json({ success: true, data: release });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
