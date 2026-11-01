const fs = require('fs/promises');
const path = require('path');
const connectDB = require('../config/db');
const DistributionRelease = require('../models/DistributionRelease');
const DistribeatsWebhookEvent = require('../models/DistribeatsWebhookEvent');
const Artist = require('../models/Artist');
const Song = require('../models/Song');
const SongMetadata = require('../models/SongMetadata');
const Ownership = require('../models/Ownership');
const RoyaltyLedger = require('../models/RoyaltyLedger');
const distribeats = require('../services/distribeats/distribeatsService');
const policy = require('../services/distribeats/distribeatsPolicy');
const { mapRelease, displayName } = require('../services/distribeats/distribeatsMapper');
const { validateRelease, validateMappedPayload } = require('../services/distribeats/distribeatsValidation');
const { parseReleaseBody, mergeDraft } = require('../services/distribeats/distributionDraft');
const { buildImport, resolveUploadPath } = require('../services/distribeats/distributionImport');
const { validateArtworkFile, validateAudioFile } = require('../lib/mediaValidation');
const qcService = require('../services/qcService');

/** Emit a release update to all sockets watching that release and all admin sockets. */
const emitRelease = (release) => {
  try {
    const payload = {
      releaseId: String(release._id),
      title: release.title,
      status: release.status,
      qcStatus: release.qcStatus,
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

const scope = async req => {
  if (req.user.role !== 'artist') return {};
  const artist = await artistForUser(req);
  return { artist: artist?._id || null };
};

const unlinkQuietly = async files => {
  await Promise.all((files || []).map(file => file?.path ? fs.unlink(file.path).catch(() => {}) : Promise.resolve()));
};

/** Ensure legacy `contributors` array has at least a `primary_artist` entry for internal QC & backwards compatibility. */
const syncLegacyContributors = (release, artistDoc) => {
  const primaryName = displayName(artistDoc) || 'Artist';
  (release.tracks || []).forEach(track => {
    if (!Array.isArray(track.performers) || track.performers.length === 0) {
      const fromContributors = (track.contributors || []).find(item => item?.name);
      track.performers = [{ name: fromContributors?.name || primaryName, role: 'Lead Vocals' }];
    }
    if (!Array.isArray(track.contributors) || !track.contributors.some(item => item.role === 'primary_artist')) {
      const lead = track.performers[0]?.name || primaryName;
      track.contributors = [
        { name: lead, role: 'primary_artist' },
        ...(track.featuredArtists || []).filter(Boolean).map(name => ({ name, role: 'featured_artist' })),
        ...(track.producers || []).filter(Boolean).map(name => ({ name, role: 'producer' })),
        ...(track.writers || []).filter(Boolean).map(name => ({ name, role: 'songwriter' })),
        ...(track.composers || []).filter(Boolean).map(name => ({ name, role: 'composer' })),
      ];
    }
  });
};

/** Inspect and validate any newly uploaded cover/audio files on disk before persisting. */
const processUploadedAssets = async (req, catalogue) => {
  const files = req.files || [];
  const errors = [];
  const uploads = { cover: null, audio: {} };
  const cover = files.find(file => file.fieldname === 'cover');
  if (cover) {
    const check = await validateArtworkFile(cover.path, { name: cover.originalname, mimetype: cover.mimetype, size: cover.size }, { maxBytes: policy.maxCoverBytes(), field: 'cover' });
    if (check.errors.length) errors.push(...check.errors);
    else {
      uploads.cover = {
        coverArtUrl: `/uploads/distribution/${cover.filename}`,
        coverArtFileName: cover.originalname,
        coverArtMeta: { ...check.info, size: cover.size },
      };
    }
  }
  const audioMax = policy.maxAudioBytes(catalogue);
  for (const file of files) {
    const match = /^audio_(\d+)$/.exec(file.fieldname);
    if (!match) continue;
    const index = Number(match[1]);
    const check = await validateAudioFile(file.path, { name: file.originalname, mimetype: file.mimetype, size: file.size }, { maxBytes: audioMax, field: `tracks[${index}].audio` });
    if (check.length) errors.push(...check);
    else {
      uploads.audio[index] = {
        audioUrl: `/uploads/distribution/${file.filename}`,
        audioFileName: file.originalname,
        audioSizeBytes: file.size,
      };
    }
  }
  if (errors.length) await unlinkQuietly(files);
  return { uploads, errors };
};

/** Attach catalog audio when a track references `sourceSong` and has no uploaded audio yet. */
const attachSourceSongAudio = async (tracks, catalogue) => {
  const audioMax = policy.maxAudioBytes(catalogue);
  for (let index = 0; index < (tracks || []).length; index += 1) {
    const track = tracks[index];
    if (track.audioUrl || !track.sourceSong) continue;
    const song = await Song.findById(track.sourceSong).lean().catch(() => null);
    if (!song) continue;
    const imported = buildImport({ song }, catalogue);
    if (!imported.audioCandidate?.fileUrl) continue;
    const diskPath = resolveUploadPath(imported.audioCandidate.fileUrl);
    if (!diskPath) continue;
    const stat = await fs.stat(diskPath).catch(() => null);
    if (!stat) continue;
    const errs = await validateAudioFile(diskPath, { name: imported.audioCandidate.fileName, mimetype: '', size: stat.size }, { maxBytes: audioMax, field: `tracks[${index}].audio` });
    if (!errs.length) {
      track.audioUrl = imported.audioCandidate.fileUrl;
      track.audioFileName = imported.audioCandidate.fileName;
      track.audioSizeBytes = stat.size;
    }
  }
};

/** Re-verify stored cover and audio files on disk right before submission. */
const verifyStoredFilesOnDisk = async (release, catalogue) => {
  const errors = [];
  if (release.coverArtUrl) {
    const coverPath = resolveUploadPath(release.coverArtUrl);
    const stat = coverPath ? await fs.stat(coverPath).catch(() => null) : null;
    if (!stat) errors.push({ field: 'cover', message: 'Cover artwork file could not be found on disk; please re-upload it.', code: 'ART_MISSING' });
    else {
      const ext = (release.coverArtFileName || release.coverArtUrl).toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const check = await validateArtworkFile(coverPath, { name: release.coverArtFileName || release.coverArtUrl, mimetype: ext, size: stat.size }, { maxBytes: policy.maxCoverBytes(), field: 'cover' });
      errors.push(...check.errors);
    }
  }
  const audioMax = policy.maxAudioBytes(catalogue);
  for (let index = 0; index < (release.tracks || []).length; index += 1) {
    const track = release.tracks[index];
    if (!track.audioUrl) continue;
    const audioPath = resolveUploadPath(track.audioUrl);
    const stat = audioPath ? await fs.stat(audioPath).catch(() => null) : null;
    if (!stat) errors.push({ field: `tracks[${index}].audio`, message: `Track ${index + 1}: audio file could not be found on disk; please re-upload it.`, code: 'AUDIO_MISSING' });
    else {
      const check = await validateAudioFile(audioPath, { name: track.audioFileName || track.audioUrl, mimetype: '', size: stat.size }, { maxBytes: audioMax, field: `tracks[${index}].audio` });
      errors.push(...check);
    }
  }
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

exports.importSong = async (req, res) => {
  try {
    const songFilter = { _id: req.params.songId, ...(await scope(req)) };
    const song = await Song.findOne(songFilter).lean();
    if (!song) return res.status(404).json({ success: false, message: 'Song not found in Music Catalog' });
    const [metadata, ownership, artist, catalogue] = await Promise.all([
      SongMetadata.findOne({ songId: song._id }).lean(),
      Ownership.findOne({ songId: song._id }).lean(),
      Artist.findById(song.artist).lean(),
      distribeats.getCatalogue().catch(() => ({})),
    ]);
    const imported = buildImport({ song, metadata, ownership, artist }, catalogue);
    if (imported.audioCandidate?.fileUrl) {
      const diskPath = resolveUploadPath(imported.audioCandidate.fileUrl);
      const stat = diskPath ? await fs.stat(diskPath).catch(() => null) : null;
      if (stat) {
        const audioErrors = await validateAudioFile(diskPath, { name: imported.audioCandidate.fileName, mimetype: '', size: stat.size }, { maxBytes: policy.maxAudioBytes(catalogue), field: 'audio' });
        if (audioErrors.length === 0) {
          imported.track.audioUrl = imported.audioCandidate.fileUrl;
          imported.track.audioFileName = imported.audioCandidate.fileName;
          imported.track.audioSizeBytes = stat.size;
        } else {
          imported.warnings.push(`Catalog audio "${imported.audioCandidate.fileName}" cannot be used directly (${audioErrors[0].message}). Upload a WAV or FLAC master.`);
        }
      }
    }
    res.json({ success: true, data: imported });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
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
      .populate('artist', 'name stageName artistName legalName image socialLinks distribeatsArtistId')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) })
      .populate('artist', 'name stageName artistName legalName image socialLinks distribeatsArtistId')
      .lean();
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    res.json({ success: true, data: release });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.create = async (req, res) => {
  try {
    const incoming = parseReleaseBody(req.body);
    if (incoming.bulkImportKey) {
      const existing = await DistributionRelease.findOne({ bulkImportKey: incoming.bulkImportKey, createdBy: req.user._id });
      if (existing) {
        await unlinkQuietly(req.files);
        return res.status(200).json({ success: true, data: existing, duplicate: true });
      }
    }
    const catalogue = await distribeats.getCatalogue().catch(() => ({}));
    const { uploads, errors: fileErrors } = await processUploadedAssets(req, catalogue);
    if (fileErrors.length) return res.status(422).json({ success: false, message: fileErrors[0].message, errors: fileErrors });

    if (req.user.role === 'artist') incoming.artist = (await artistForUser(req))?._id;
    const defaults = {
      type: 'single',
      language: 'English',
      worldwide: true,
      territories: ['WORLDWIDE'],
      excludedTerritories: [],
      dspOutletIds: ['Spotify'],
      attestations: { age: false, rights: false },
      artworkAiUsage: 'none',
      distributionMode: 'new_release',
      sourceDistributor: '',
      sourceReleaseUrl: '',
      transferAcknowledged: false,
    };
    const merged = mergeDraft(defaults, { ...incoming, ...(uploads.cover || {}) }, uploads);
    if (merged.worldwide === false && Array.isArray(merged.territories)) {
      merged.territories = merged.territories.filter(code => code !== 'WORLDWIDE');
    } else if (merged.worldwide !== false && (!merged.territories || merged.territories.length === 0)) {
      merged.territories = ['WORLDWIDE'];
    }
    await attachSourceSongAudio(merged.tracks, catalogue);
    const artistDoc = merged.artist ? await Artist.findById(merged.artist).lean().catch(() => null) : null;
    syncLegacyContributors(merged, artistDoc);

    const draftCheck = validateRelease(merged, { catalogue, mode: 'draft', enforceLeadTime: Boolean(merged.releaseDate) });
    if (draftCheck.errors.length) {
      await unlinkQuietly(req.files);
      return res.status(422).json({ success: false, message: draftCheck.errors[0].message, errors: draftCheck.errors });
    }
    merged.validationResult = validateRelease(merged, { catalogue, mode: 'submit' });

    const release = await DistributionRelease.create({ ...merged, createdBy: req.user._id, updatedBy: req.user._id });
    qcService.queueReleaseForQc(release._id);
    res.status(201).json({ success: true, data: release });
  } catch (error) {
    await unlinkQuietly(req.files);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) { await unlinkQuietly(req.files); return res.status(404).json({ success: false, message: 'Distribution release not found' }); }
    if (release.status !== 'draft') { await unlinkQuietly(req.files); return res.status(409).json({ success: false, message: 'Only draft releases can be edited' }); }

    const catalogue = await distribeats.getCatalogue().catch(() => ({}));
    const { uploads, errors: fileErrors } = await processUploadedAssets(req, catalogue);
    if (fileErrors.length) return res.status(422).json({ success: false, message: fileErrors[0].message, errors: fileErrors });

    const incoming = parseReleaseBody(req.body);
    if (req.user.role === 'artist') delete incoming.artist;
    const merged = mergeDraft(release.toObject(), { ...incoming, ...(uploads.cover || {}) }, uploads);
    if (merged.worldwide === false && Array.isArray(merged.territories)) {
      merged.territories = merged.territories.filter(code => code !== 'WORLDWIDE');
    } else if (merged.worldwide !== false && (!merged.territories || merged.territories.length === 0)) {
      merged.territories = ['WORLDWIDE'];
    }
    await attachSourceSongAudio(merged.tracks, catalogue);
    const artistDoc = merged.artist ? await Artist.findById(merged.artist).lean().catch(() => null) : null;
    syncLegacyContributors(merged, artistDoc);

    const draftCheck = validateRelease(merged, { catalogue, mode: 'draft', enforceLeadTime: Boolean(merged.releaseDate) });
    if (draftCheck.errors.length) {
      await unlinkQuietly(req.files);
      return res.status(422).json({ success: false, message: draftCheck.errors[0].message, errors: draftCheck.errors });
    }
    merged.validationResult = validateRelease(merged, { catalogue, mode: 'submit' });
    if (uploads.cover) release.uploadState = { ...(release.uploadState || {}), artwork: 'preparing' };

    Object.assign(release, merged, { updatedBy: req.user._id, qcStatus: 'pending_qc' });
    await release.save();
    qcService.queueReleaseForQc(release._id);
    res.json({ success: true, data: release });
  } catch (error) {
    await unlinkQuietly(req.files);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.validateDraftPayload = async (req, res) => {
  try {
    const catalogue = await distribeats.getCatalogue().catch(() => ({}));
    const incoming = parseReleaseBody(req.body || {});
    const report = validateRelease(incoming, { catalogue, mode: req.body?.mode === 'draft' ? 'draft' : 'submit', enforceLeadTime: true });
    res.json({ success: true, data: report });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.validate = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    const [artist, catalogue] = await Promise.all([
      Artist.findById(release.artist),
      distribeats.getCatalogue().catch(() => ({})),
    ]);
    const report = validateRelease(release, { catalogue, mode: 'submit' });
    const diskErrors = await verifyStoredFilesOnDisk(release, catalogue);
    const allErrors = [...report.errors, ...diskErrors];
    const mappedPayload = mapRelease(release, artist);
    const mappedErrors = validateMappedPayload(mappedPayload, catalogue);
    mappedErrors.forEach(errItem => {
      if (!allErrors.some(existing => existing.field === errItem.field && existing.message === errItem.message)) allErrors.push(errItem);
    });
    const result = { ready: allErrors.length === 0, errors: allErrors, warnings: report.warnings, mode: 'submit' };
    release.validationResult = result;
    await release.save();
    res.json({ success: true, data: { ...result, mappedPayload } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.submit = async (req, res) => {
  try {
    const release = await DistributionRelease.findOne({ _id: req.params.id, ...(await scope(req)) });
    if (!release) return res.status(404).json({ success: false, message: 'Distribution release not found' });
    if (!['draft', 'rejected', 'error'].includes(release.status)) return res.status(409).json({ success: false, message: 'Release has already been submitted' });

    if (release.qcStatus !== 'ready_for_distribution') {
      return res.status(422).json({
        success: false,
        message: 'Release cannot be submitted to Distribeats until Content/QC review is completed.',
        errors: [{ field: 'qcStatus', message: 'Release cannot be submitted to Distribeats until Content/QC review is completed.', code: 'QC_NOT_READY' }],
      });
    }

    const [artist, catalogue] = await Promise.all([
      Artist.findById(release.artist),
      distribeats.getCatalogue(),
    ]);
    const report = validateRelease(release, { catalogue, mode: 'submit' });
    const diskErrors = await verifyStoredFilesOnDisk(release, catalogue);
    const errors = [...report.errors, ...diskErrors];
    if (errors.length) {
      release.validationResult = { ready: false, errors, warnings: report.warnings, mode: 'submit' };
      await release.save();
      return res.status(422).json({ success: false, message: errors[0].message, errors });
    }
    await distribeats.submitRelease(release, artist);
    emitRelease(release);
    res.json({ success: true, data: release, integration: await distribeats.connectionStatus() });
  } catch (error) {
    const structured = error.details?.errors || error.details?.errors_structured;
    res.status(error.status || 502).json({
      success: false,
      message: error.message,
      code: error.code,
      errors: Array.isArray(structured) ? structured.map(item => typeof item === 'string' ? { field: 'release', message: item, code: error.code || 'PROVIDER_ERROR' } : item) : undefined,
    });
  }
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
    const format = req.query.format === 'json' ? 'json' : 'json' === req.query.format ? 'json' : 'xml';
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
      performedBy: req.user._id,
    });

    await release.save();
    emitRelease(release);
    res.json({ success: true, data: release });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 100% Read-Only System & Distribution Health Diagnostics.
 * Never creates or submits any demo/test release. Inspects infrastructure, MySQL, storage,
 * DistriBeats API/catalogue, webhook audit logs, artist readiness, and every distribution release's
 * metadata, on-disk cover/audio files, QC status, and sync errors.
 */
exports.systemHealth = async (req, res) => {
  try {
    const startedAt = Date.now();
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    // 1. Database health check (read-only ping)
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    let dbError = '';
    try {
      const dbStart = Date.now();
      const seq = connectDB.getSequelize?.();
      if (seq) await seq.authenticate();
      dbLatencyMs = Date.now() - dbStart;
    } catch (err) {
      dbStatus = 'down';
      dbError = err.message || 'Database connection error';
    }

    // 2. Upload storage directory health check (read-only)
    const uploadDir = path.resolve(__dirname, '..', 'uploads', 'distribution');
    let storageStatus = 'healthy';
    let uploadDirExists = false;
    let totalFilesOnDisk = 0;
    let totalBytesOnDisk = 0;
    try {
      const entries = await fs.readdir(uploadDir, { withFileTypes: true });
      uploadDirExists = true;
      for (const entry of entries) {
        if (entry.isFile()) {
          totalFilesOnDisk += 1;
          const st = await fs.stat(path.join(uploadDir, entry.name)).catch(() => null);
          if (st) totalBytesOnDisk += st.size;
        }
      }
    } catch {
      uploadDirExists = false;
      storageStatus = 'warning';
    }

    // 3. DistriBeats connection & live catalogue probe (read-only)
    const [connection, catalogue] = await Promise.all([
      distribeats.connectionStatus(forceRefresh).catch(err => ({
        status: 'api_unavailable',
        message: err.message || 'Failed to check DistriBeats connection',
      })),
      distribeats.getCatalogue().catch(() => ({})),
    ]);

    if (req.user.role !== 'admin') {
      delete connection.credentialHint;
      delete connection.account;
    }

    // 4. Webhook health check (read-only)
    const [totalWebhooks, processedWebhooks, failedWebhooks, latestWebhook] = await Promise.all([
      DistribeatsWebhookEvent.countDocuments({}).catch(() => 0),
      DistribeatsWebhookEvent.countDocuments({ status: 'processed' }).catch(() => 0),
      DistribeatsWebhookEvent.countDocuments({ status: { $in: ['failed', 'error', 'invalid_signature'] } }).catch(() => 0),
      DistribeatsWebhookEvent.findOne({}).sort({ receivedAt: -1 }).select('receivedAt event status').lean().catch(() => null),
    ]);

    // 5. Artist roster readiness (read-only)
    const filter = await scope(req);
    const [releases, artists] = await Promise.all([
      DistributionRelease.find(filter)
        .populate('artist', 'name stageName artistName legalName email socialLinks distribeatsArtistId')
        .sort({ createdAt: -1 })
        .lean(),
      req.user.role === 'artist'
        ? Artist.find(filter.artist ? { _id: filter.artist } : {}).lean()
        : Artist.find({}).lean(),
    ]);

    const artistById = new Map(artists.map(a => [String(a._id), a]));

    // 6. Per-release non-destructive audit (metadata + mapped OpenAPI payload + on-disk files + QC + sync)
    const byStatus = { draft: 0, submitted: 0, processing: 0, approved: 0, delivered: 0, live: 0, rejected: 0, error: 0 };
    let healthyReleasesCount = 0;
    let releasesWithErrorsCount = 0;
    let qcPendingCount = 0;
    let transferReleasesCount = 0;
    let bulkReleasesCount = 0;

    const releaseChecks = [];
    for (const release of releases) {
      const stKey = release.status || 'draft';
      byStatus[stKey] = (byStatus[stKey] || 0) + 1;
      if (release.distributionMode === 'catalog_transfer') transferReleasesCount += 1;
      if (release.bulkReleaseKey || release.bulkImportKey) bulkReleasesCount += 1;
      if (['pending_qc', 'action_required', 'manual_review'].includes(release.qcStatus || 'pending_qc')) {
        qcPendingCount += 1;
      }

      const artistObj = (release.artist && typeof release.artist === 'object')
        ? release.artist
        : artistById.get(String(release.artist || '')) || null;

      const report = validateRelease(release, { catalogue, mode: 'submit' });
      const diskErrors = await verifyStoredFilesOnDisk(release, catalogue);
      let mappedErrors = [];
      try {
        const mapped = mapRelease(release, artistObj);
        mappedErrors = validateMappedPayload(mapped, catalogue);
      } catch (mapErr) {
        mappedErrors = [{ field: 'release', message: mapErr.message || 'Mapping error', code: 'MAP_ERROR' }];
      }

      const issues = [];
      report.errors.forEach(item => {
        issues.push({
          category: item.field === 'cover' || item.field?.endsWith('.audio') ? 'file' : 'metadata',
          field: item.field,
          message: item.message,
          code: item.code || 'VALIDATION_ERROR',
        });
      });
      diskErrors.forEach(item => {
        if (!issues.some(existing => existing.field === item.field && existing.message === item.message)) {
          issues.push({ category: 'file', field: item.field, message: item.message, code: item.code || 'DISK_FILE_ERROR' });
        }
      });
      mappedErrors.forEach(item => {
        if (!issues.some(existing => existing.field === item.field && existing.message === item.message)) {
          issues.push({ category: 'metadata', field: item.field, message: item.message, code: item.code || 'OPENAPI_PAYLOAD_ERROR' });
        }
      });

      if (release.qcStatus === 'qc_failed' || release.qcStatus === 'action_required') {
        issues.push({
          category: 'qc',
          field: 'qcStatus',
          message: release.adminReviewNotes || `QC status is "${(release.qcStatus || '').replace(/_/g, ' ')}".`,
          code: 'QC_ISSUE',
        });
      }

      if (release.syncStatus === 'error' || release.lastSyncError) {
        issues.push({
          category: 'sync',
          field: 'distribeatsSync',
          message: release.lastSyncError || 'DistriBeats synchronization reported an error.',
          code: 'SYNC_ERROR',
        });
      }

      const coverOk = Boolean(release.coverArtUrl) && !issues.some(i => i.field === 'cover');
      const audioOk = Array.isArray(release.tracks) && release.tracks.length > 0 && !issues.some(i => /\.audio$/.test(i.field));
      const metadataOk = !issues.some(i => i.category === 'metadata');
      const syncOk = !issues.some(i => i.category === 'sync');
      const qcOk = release.qcStatus === 'ready_for_distribution' || ['submitted', 'processing', 'approved', 'delivered', 'live'].includes(release.status);

      if (issues.length === 0) healthyReleasesCount += 1;
      else releasesWithErrorsCount += 1;

      releaseChecks.push({
        _id: String(release._id),
        title: release.title || 'Untitled Release',
        type: release.type || 'single',
        distributionMode: release.distributionMode || 'new_release',
        sourceDistributor: release.sourceDistributor || '',
        status: release.status || 'draft',
        qcStatus: release.qcStatus || 'pending_qc',
        syncStatus: release.syncStatus || 'idle',
        upc: release.upc || '',
        providerReleaseId: release.distribeatsReleaseId || release.providerReleaseId || '',
        releaseDate: release.releaseDate,
        originalReleaseDate: release.originalReleaseDate || null,
        tracksCount: Array.isArray(release.tracks) ? release.tracks.length : 0,
        artist: {
          _id: artistObj?._id ? String(artistObj._id) : '',
          name: displayName(artistObj) || 'Unassigned Artist',
          hasDistribeatsId: Boolean(artistObj?.distribeatsArtistId),
          hasEmail: Boolean(artistObj?.email),
        },
        coverOk,
        audioOk,
        metadataOk,
        syncOk,
        qcOk,
        readyToSubmit: issues.length === 0 && release.qcStatus === 'ready_for_distribution' && release.status === 'draft',
        issues,
      });
    }

    const mem = process.memoryUsage();
    const unavailableStores = Array.isArray(catalogue?.unavailableStores) ? catalogue.unavailableStores : [];
    const allStores = Array.isArray(catalogue?.stores) ? catalogue.stores : [];
    const activeStoresCount = allStores.filter(s => !unavailableStores.includes(s)).length;

    const overallStatus =
      dbStatus === 'down' || connection?.status === 'authentication_error' || connection?.status === 'live_key_blocked'
        ? 'degraded'
        : connection?.status !== 'connected' || releasesWithErrorsCount > 0
          ? 'warning'
          : 'healthy';

    res.json({
      success: true,
      data: {
        overallStatus,
        checkedAt: new Date().toISOString(),
        checkDurationMs: Date.now() - startedAt,
        readOnlyGuarantee: '100% Read-Only Diagnostics — No demo releases or external submissions are ever triggered.',
        infrastructure: {
          server: {
            status: 'healthy',
            uptimeSeconds: Math.round(process.uptime()),
            memoryRssMb: Math.round((mem.rss / 1048576) * 10) / 10,
            memoryHeapMb: Math.round((mem.heapUsed / 1048576) * 10) / 10,
            nodeVersion: process.version,
            env: process.env.NODE_ENV || 'development',
          },
          database: {
            status: dbStatus,
            dialect: 'MySQL (Sequelize Pool)',
            latencyMs: dbLatencyMs,
            error: dbError || undefined,
          },
          storage: {
            status: storageStatus,
            uploadDirExists,
            totalFilesOnDisk,
            totalMegabytesOnDisk: Math.round((totalBytesOnDisk / 1048576) * 100) / 100,
          },
          webhook: {
            status: process.env.DISTRIBEATS_WEBHOOK_SECRET ? 'configured' : 'not_configured',
            configured: Boolean(process.env.DISTRIBEATS_WEBHOOK_SECRET),
            totalEvents: totalWebhooks,
            processedEvents: processedWebhooks,
            failedEvents: failedWebhooks,
            lastReceivedAt: latestWebhook?.receivedAt || null,
            lastEventType: latestWebhook?.event || null,
          },
        },
        provider: {
          connection,
          catalogue: {
            loaded: Boolean(allStores.length || catalogue?.genres?.length),
            genresCount: Array.isArray(catalogue?.genres) ? catalogue.genres.length : 0,
            languagesCount: Array.isArray(catalogue?.languages) ? catalogue.languages.length : 0,
            activeStoresCount,
            unavailableStoresCount: unavailableStores.length,
            unavailableStores,
            performerRolesCount: Array.isArray(catalogue?.performerRoles) ? catalogue.performerRoles.length : 0,
            releaseTypes: Array.isArray(catalogue?.releaseTypes) ? catalogue.releaseTypes : ['Single', 'EP', 'Album'],
            maxAudioMegabytes: Math.round(policy.maxAudioBytes(catalogue) / 1_000_000),
            maxCoverMegabytes: Math.round(policy.maxCoverBytes() / 1048576),
            earliestReleaseDate: policy.earliestReleaseDate().toISOString().slice(0, 10),
            leadTime: policy.leadTimeConfig(),
          },
        },
        distributionAudit: {
          totalReleases: releases.length,
          byStatus,
          healthyReleasesCount,
          releasesWithErrorsCount,
          qcPendingCount,
          transferReleasesCount,
          bulkReleasesCount,
          releaseChecks,
        },
        artistRosterAudit: {
          totalArtists: artists.length,
          linkedToDistribeatsCount: artists.filter(a => Boolean(a.distribeatsArtistId)).length,
          withEmailCount: artists.filter(a => Boolean(a.email)).length,
          withSpotifyUrlCount: artists.filter(a => Boolean(a.socialLinks?.spotify)).length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
