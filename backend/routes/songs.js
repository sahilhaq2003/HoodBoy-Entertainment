const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const Song = require('../models/Song');
const { protect, checkPermission } = require('../middleware/auth');
const songUpload = require('../middleware/songUpload');
const { validateSongsForRelease } = require('../services/ownershipValidationService');

const VERSION_TYPES = [
  'explicit_master', 'clean_master', 'instrumental', 'performance_version',
  'acappella', 'radio_edit', 'stems', 'wav_high_quality', 'reference_mp3',
];

const SONG_EDIT_FIELDS = [
  'title', 'artist', 'album', 'genre', 'duration', 'status', 'releaseDate',
  'producedBy', 'writtenBy', 'isrc', 'fileUrl', 'coverArt', 'streams', 'revenue',
  'notes', 'assignedTo', 'priority', 'credits', 'beatInfo',
];

const pickSongFields = (body) => SONG_EDIT_FIELDS.reduce((result, field) => {
  if (body[field] !== undefined) result[field] = body[field];
  return result;
}, {});

router.use(protect);

router.get('/', checkPermission('songs', 'read'), async (req, res) => {
  try {
    const { status, artist, page = 1, limit = 20, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (artist) query.artist = artist;
    if (search) query.title = { $regex: search, $options: 'i' };
    const songs = await Song.find(query).populate('artist', 'name stageName').populate('assignedTo', 'name').sort('-createdAt').limit(limit * 1).skip((page - 1) * limit);
    const total = await Song.countDocuments(query);
    res.json({ success: true, data: songs, total });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/:id', checkPermission('songs', 'read'), async (req, res) => {
  try {
    let song = await Song.findById(req.params.id).populate('artist', 'name stageName').populate('assignedTo', 'name');
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    if (song.productionWorkflow.length === 0) {
      song.productionWorkflow = Song.buildProductionWorkflow();
      await song.save();
      song = await Song.findById(req.params.id).populate('artist', 'name stageName').populate('assignedTo', 'name');
    }
    res.json({ success: true, data: song });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/', checkPermission('songs', 'write'), async (req, res) => {
  try {
    const data = pickSongFields(req.body);
    if (!data.title?.trim() || !data.artist) {
      return res.status(400).json({ success: false, message: 'Song title and artist are required' });
    }
    if (['awaiting_approval', 'approved', 'released'].includes(data.status)) {
      return res.status(400).json({ success: false, message: 'A new song must complete its production workflow before approval or release' });
    }
    const song = await Song.create(data);
    res.status(201).json({ success: true, data: song });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

router.put('/:id', checkPermission('songs', 'write'), async (req, res) => {
  try {
    const data = pickSongFields(req.body);
    if (['awaiting_approval', 'approved', 'released'].includes(data.status)) {
      const currentSong = await Song.findById(req.params.id);
      if (!currentSong) return res.status(404).json({ success: false, message: 'Song not found' });
      const incompleteStep = currentSong.productionWorkflow.find(step => step.status !== 'completed');
      if (incompleteStep) {
        return res.status(400).json({ success: false, message: `Complete “${incompleteStep.label}” before moving the song to ${data.status.replace(/_/g, ' ')}` });
      }
    }
    if (['approved', 'released'].includes(data.status)) {
      const ownershipValidation = await validateSongsForRelease([req.params.id]);
      if (!ownershipValidation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Song cannot be approved or released until ownership and required signatures are complete',
          errors: ownershipValidation.errors,
        });
      }
    }
    const song = await Song.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    res.json({ success: true, data: song });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

router.delete('/:id', checkPermission('songs', 'write'), async (req, res) => {
  try {
    await Song.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Song deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Production workflow - update a step
router.put('/:id/workflow/:stepId', checkPermission('songs', 'write'), async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    const step = song.productionWorkflow.id(req.params.stepId);
    if (!step) return res.status(404).json({ success: false, message: 'Step not found' });
    const nextStatus = req.body.status;
    if (nextStatus && ['in_progress', 'completed'].includes(nextStatus)) {
      const previousSteps = song.productionWorkflow.filter(item => item.order < step.order);
      const incompletePrevious = previousSteps.find(item => item.status !== 'completed');
      if (incompletePrevious) {
        return res.status(400).json({ success: false, message: `Complete “${incompletePrevious.label}” first` });
      }
    }
    if (nextStatus && nextStatus !== 'completed' && step.status === 'completed') {
      const laterActiveStep = song.productionWorkflow.find(item => item.order > step.order && item.status !== 'pending');
      if (laterActiveStep) {
        return res.status(400).json({ success: false, message: `Move “${laterActiveStep.label}” back to pending first` });
      }
    }
    if (nextStatus === 'completed' && step.step === 'beat_ownership_verified' &&
        (!song.beatInfo?.ownershipVerified || !song.beatInfo?.producer || !song.beatInfo?.licenseType)) {
      return res.status(400).json({ success: false, message: 'Record the beat producer, license type, and ownership verification first' });
    }
    if (nextStatus === 'completed' && step.step === 'alternate_versions_created') {
      const uploadedTypes = new Set(song.versions.map(version => version.type));
      const missingVersions = VERSION_TYPES.filter(type => !uploadedTypes.has(type));
      if (missingVersions.length > 0) {
        return res.status(400).json({ success: false, message: `${missingVersions.length} required song version(s) are still missing` });
      }
    }
    if (nextStatus === 'completed' && step.step === 'credits_confirmed' && song.credits.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one song credit before confirming credits' });
    }
    if (req.body.status) step.status = req.body.status;
    if (req.body.notes !== undefined) step.notes = req.body.notes;
    if (req.body.status === 'completed') {
      step.completedAt = new Date();
      step.completedBy = req.user._id;
    } else if (req.body.status) {
      step.completedAt = undefined;
      step.completedBy = undefined;
    }
    await song.save();
    res.json({ success: true, data: song });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// Song versions - add a version
router.post('/:id/versions', checkPermission('songs', 'write'), songUpload.single('file'), async (req, res) => {
  let keepUploadedFile = false;
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: 'Song not found' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Select a song file to upload' });
    if (!VERSION_TYPES.includes(req.body.type)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'Invalid song version type' });
    }
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (req.body.type === 'wav_high_quality' && extension !== '.wav') {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'High-Quality WAV must be uploaded as a .wav file' });
    }
    if (req.body.type === 'reference_mp3' && extension !== '.mp3') {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'Reference MP3 must be uploaded as a .mp3 file' });
    }
    if (req.body.type === 'stems' && extension !== '.zip') {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'Stems must be uploaded as a .zip archive' });
    }
    if (song.versions.some(version => version.type === req.body.type)) {
      fs.unlink(req.file.path, () => {});
      return res.status(409).json({ success: false, message: 'That song version already exists. Delete it before uploading a replacement.' });
    }
    song.versions.push({
      type: req.body.type,
      fileUrl: `/uploads/songs/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      format: path.extname(req.file.originalname).slice(1).toUpperCase(),
      notes: req.body.notes || '',
      uploadedBy: req.user._id,
    });
    await song.save();
    keepUploadedFile = true;
    res.status(201).json({ success: true, data: song });
  } catch (error) {
    if (req.file && !keepUploadedFile) fs.unlink(req.file.path, () => {});
    res.status(400).json({ success: false, message: error.message });
  }
});

// Song versions - update a version
router.put('/:id/versions/:versionId', checkPermission('songs', 'write'), async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    const version = song.versions.id(req.params.versionId);
    if (!version) return res.status(404).json({ success: false, message: 'Version not found' });
    if (req.body.notes !== undefined) version.notes = req.body.notes;
    await song.save();
    res.json({ success: true, data: song });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// Song versions - delete a version
router.delete('/:id/versions/:versionId', checkPermission('songs', 'write'), async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    const version = song.versions.id(req.params.versionId);
    if (!version) return res.status(404).json({ success: false, message: 'Version not found' });
    if (version.fileUrl?.startsWith('/uploads/songs/')) {
      const fileName = path.basename(version.fileUrl);
      const filePath = path.resolve(__dirname, '..', 'uploads', 'songs', fileName);
      const uploadRoot = path.resolve(__dirname, '..', 'uploads', 'songs');
      if (filePath.startsWith(`${uploadRoot}${path.sep}`)) fs.unlink(filePath, () => {});
    }
    version.deleteOne();
    song.productionWorkflow.forEach(step => {
      if (step.order >= 10) {
        step.status = step.order === 10 ? 'in_progress' : 'pending';
        step.completedAt = undefined;
        step.completedBy = undefined;
      }
    });
    await song.save();
    res.json({ success: true, data: song });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// Production workflow stats
router.get('/:id/workflow/stats', checkPermission('songs', 'read'), async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    const total = song.productionWorkflow.length;
    const completed = song.productionWorkflow.filter(s => s.status === 'completed').length;
    const inProgress = song.productionWorkflow.filter(s => s.status === 'in_progress').length;
    const pending = song.productionWorkflow.filter(s => s.status === 'pending').length;
    const blocked = song.productionWorkflow.filter(s => s.status === 'blocked').length;
    res.json({ success: true, data: { total, completed, inProgress, pending, blocked, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
