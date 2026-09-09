const Ownership = require('../models/Ownership');
const Song = require('../models/Song');
const Release = require('../models/Release');
const { validateOwnershipRecord } = require('../services/ownershipValidationService');

const EDITABLE_FIELDS = [
  'masterOwner', 'writers', 'publishers', 'producer', 'producerPercentage',
  'featuredArtists', 'beatLicense', 'samples', 'signatures',
  'copyrightStatus', 'copyrightNumber', 'proStatus', 'proName', 'proIpi',
  'distributionStatus', 'notes',
];

const applyEditableFields = (ownership, body) => {
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) ownership.set(field, body[field]);
  }
};

const refreshAndSave = async (ownership) => {
  const validation = validateOwnershipRecord(ownership);
  await ownership.save();
  return validation;
};

exports.getBySong = async (req, res) => {
  try {
    const ownership = await Ownership.findOne({ songId: req.params.songId })
      .populate('songId', 'title artist')
      .populate('featuredArtists.artistId', 'name artistName stageName')
      .populate('approvedBy', 'name');
    if (!ownership) return res.status(404).json({ success: false, message: 'Ownership record not found' });
    await refreshAndSave(ownership);
    res.json({ success: true, data: ownership });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { songId, isComplete, releaseApproved } = req.query;
    const query = {};
    if (songId) query.songId = songId;
    if (isComplete !== undefined) query.isComplete = isComplete === 'true';
    if (releaseApproved !== undefined) query.releaseApproved = releaseApproved === 'true';
    const ownerships = await Ownership.find(query)
      .populate('songId', 'title artist')
      .populate('featuredArtists.artistId', 'name artistName stageName')
      .populate('approvedBy', 'name')
      .sort('-updatedAt');
    for (const o of ownerships) {
      await refreshAndSave(o);
    }
    res.json({ success: true, data: ownerships });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrUpdate = async (req, res) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, message: 'songId is required' });
    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
    let ownership = await Ownership.findOne({ songId });
    if (ownership) {
      applyEditableFields(ownership, req.body);
      ownership.releaseApproved = false;
      ownership.approvedBy = undefined;
      ownership.approvedAt = undefined;
    } else {
      ownership = new Ownership({ songId });
      applyEditableFields(ownership, req.body);
    }
    const validation = await refreshAndSave(ownership);
    await Release.updateMany(
      { songs: songId },
      {
        $set: {
          ownershipConfirmed: false,
          'phases.preparation.checklist.$[ownershipItem].status': 'pending',
        },
        $unset: { 'phases.preparation.checklist.$[ownershipItem].completedAt': 1 },
      },
      { arrayFilters: [{ 'ownershipItem.item': 'Ownership confirmed' }] },
    );
    await ownership.populate('songId', 'title artist');
    res.status(ownership.createdAt?.getTime() === ownership.updatedAt?.getTime() ? 201 : 200).json({
      success: true,
      data: ownership,
      validation,
      message: validation.valid ? 'Ownership record is ready for approval' : 'Ownership record saved with outstanding requirements',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.validate = async (req, res) => {
  try {
    const ownership = await Ownership.findOne({ songId: req.params.songId });
    if (!ownership) return res.status(404).json({ success: false, message: 'Ownership not found' });
    const validation = await refreshAndSave(ownership);
    res.json({ success: true, data: { ...validation, ownership } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const ownership = await Ownership.findOne({ songId: req.params.songId });
    if (!ownership) return res.status(404).json({ success: false, message: 'Ownership not found' });
    const validation = validateOwnershipRecord(ownership);
    if (!validation.valid) {
      await ownership.save();
      return res.status(400).json({
        success: false,
        message: 'Ownership cannot be approved until every rights and signature requirement is complete',
        errors: validation.errors,
      });
    }
    ownership.releaseApproved = true;
    ownership.approvedBy = req.user._id;
    ownership.approvedAt = new Date();
    await ownership.save();
    res.json({ success: true, data: ownership });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const linkedRelease = await Release.findOne({ songs: req.params.songId, status: { $ne: 'cancelled' } }).select('title status');
    if (linkedRelease) {
      return res.status(409).json({
        success: false,
        message: `Ownership cannot be deleted while linked to ${linkedRelease.title} (${linkedRelease.status})`,
      });
    }
    const ownership = await Ownership.findOneAndDelete({ songId: req.params.songId });
    if (!ownership) return res.status(404).json({ success: false, message: 'Ownership not found' });
    res.json({ success: true, message: 'Ownership record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const ownerships = await Ownership.find();
    for (const ownership of ownerships) await refreshAndSave(ownership);
    const total = ownerships.length;
    const complete = ownerships.filter(ownership => ownership.isComplete).length;
    const incomplete = total - complete;
    const approved = ownerships.filter(ownership => ownership.releaseApproved).length;
    const pendingApproval = ownerships.filter(ownership => ownership.isReadyForRelease && !ownership.releaseApproved).length;
    const withSamples = ownerships.filter(ownership => ownership.samples?.length > 0).length;
    const readyForRelease = ownerships.filter(ownership => ownership.isReadyForRelease).length;
    const avgPercentage = total
      ? ownerships.reduce((sum, ownership) => sum + (ownership.totalPercentage || 0), 0) / total
      : 0;
    res.json({
      success: true,
      data: {
        total, complete, incomplete, approved, pendingApproval, withSamples, readyForRelease,
        avgPercentage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
