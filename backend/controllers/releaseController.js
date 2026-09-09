const Release = require('../models/Release');
const { validateSongsForRelease } = require('../services/ownershipValidationService');

const PHASE_CHECKLISTS = {
  preparation: [
    'Song approved', 'Ownership confirmed', 'Final master delivered',
    'Artwork approved', 'Metadata completed', 'Lyrics completed', 'Budget approved',
  ],
  distribution: [
    'Upload release', 'Confirm platforms', 'Verify profiles',
    'Pre-save page', 'Platform pitches', 'Confirm release date',
  ],
  marketing: [
    'Content calendar', 'Press materials', 'Playlist pitching',
    'Ads launched', 'Video schedule', 'Interviews',
  ],
  post_release: [
    'Performance tracking', 'Platform fixes', 'Retargeting',
    'Additional content', 'Royalty updates', 'Campaign report',
  ],
};

const verifyReleaseOwnership = async (release) => {
  const result = await validateSongsForRelease(release.songs);
  release.ownershipConfirmed = result.valid;
  if (result.valid) {
    const ownershipItem = release.phases?.preparation?.checklist?.find(item => item.item === 'Ownership confirmed');
    if (ownershipItem && ownershipItem.status !== 'completed') {
      ownershipItem.status = 'completed';
      ownershipItem.completedAt = new Date();
    }
  } else {
    const ownershipItem = release.phases?.preparation?.checklist?.find(item => item.item === 'Ownership confirmed');
    if (ownershipItem) {
      ownershipItem.status = 'pending';
      ownershipItem.completedAt = undefined;
    }
  }
  return result;
};

exports.getAll = async (req, res) => {
  try {
    const { status, phase, artist, upcoming } = req.query;
    const query = {};
    if (status) query.status = status;
    if (phase) query.currentPhase = phase;
    if (artist) query.artist = artist;
    if (upcoming === 'true') {
      query.releaseDate = { $gte: new Date() };
      query.status = { $nin: ['cancelled', 'released'] };
    }
    const releases = await Release.find(query)
      .populate('artist', 'name artistName stageName image')
      .populate('songs', 'title')
      .populate('assignedTo', 'name')
      .sort('releaseDate');
    res.json({ success: true, data: releases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const release = await Release.findById(req.params.id)
      .populate('artist', 'name artistName stageName image')
      .populate('songs', 'title artist status')
      .populate('assignedTo', 'name')
      .populate('phases.preparation.checklist.assignedTo', 'name')
      .populate('phases.distribution.checklist.assignedTo', 'name')
      .populate('phases.marketing.checklist.assignedTo', 'name')
      .populate('phases.post_release.checklist.assignedTo', 'name');
    if (!release) return res.status(404).json({ success: false, message: 'Release not found' });
    res.json({ success: true, data: release });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const release = await Release.create({
      ...req.body,
      status: 'scheduled',
      currentPhase: 'preparation',
      ownershipConfirmed: false,
      phases: {
        ...(req.body.phases || {}),
        preparation: { ...(req.body.phases?.preparation || {}), startedAt: new Date() },
      },
    });
    const phases = ['preparation', 'distribution', 'marketing', 'post_release'];
    for (const phase of phases) {
      if (release.phases?.[phase]?.checklist?.length === 0 || !release.phases?.[phase]?.checklist) {
        release.phases[phase].checklist = (PHASE_CHECKLISTS[phase] || []).map((item, idx) => ({
          item, status: 'pending', order: idx,
        }));
      }
    }
    await release.save();
    res.status(201).json({ success: true, data: release });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const release = await Release.findById(req.params.id);
    if (!release) return res.status(404).json({ success: false, message: 'Release not found' });
    const sensitiveStatuses = ['submitted', 'approved', 'released'];
    const leavingPreparation = req.body.currentPhase && req.body.currentPhase !== 'preparation';
    const requiresOwnershipGate = leavingPreparation || sensitiveStatuses.includes(req.body.status) || req.body.ownershipConfirmed === true;
    if (requiresOwnershipGate) {
      const validation = await verifyReleaseOwnership(release);
      if (!validation.valid) {
        await release.save();
        return res.status(400).json({
          success: false,
          message: 'Release blocked: ownership or required signatures are incomplete',
          errors: validation.errors,
        });
      }
    }
    const updates = { ...req.body };
    delete updates.ownershipConfirmed;
    Object.assign(release, updates);
    await release.save();
    res.json({ success: true, data: release });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const release = await Release.findByIdAndDelete(req.params.id);
    if (!release) return res.status(404).json({ success: false, message: 'Release not found' });
    res.json({ success: true, message: 'Release deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.advancePhase = async (req, res) => {
  try {
    const release = await Release.findById(req.params.id);
    if (!release) return res.status(404).json({ success: false, message: 'Release not found' });
    const phases = ['preparation', 'distribution', 'marketing', 'post_release'];
    const currentIdx = phases.indexOf(release.currentPhase);
    if (release.currentPhase === 'completed') return res.status(400).json({ success: false, message: 'Release workflow is already complete' });
    if (currentIdx < 0) return res.status(400).json({ success: false, message: 'Invalid current release phase' });
    if (release.currentPhase === 'preparation') {
      const validation = await verifyReleaseOwnership(release);
      if (!validation.valid) {
        await release.save();
        return res.status(400).json({
          success: false,
          message: 'Release blocked: every song needs 100% ownership, approval, and all required signatures',
          errors: validation.errors,
        });
      }
    }
    const currentPhaseData = release.phases[release.currentPhase];
    if (currentPhaseData && currentPhaseData.checklist.length > 0) {
      const incomplete = currentPhaseData.checklist.filter(i => i.status !== 'completed' && i.status !== 'skipped');
      if (incomplete.length > 0 && !req.body.force) {
        return res.status(400).json({
          success: false,
          message: `${incomplete.length} items incomplete in current phase. Use force=true to override.`,
        });
      }
    }
    if (currentPhaseData) {
      currentPhaseData.completed = true;
      currentPhaseData.completedAt = new Date();
    }
    const nextPhase = phases[currentIdx + 1] || 'completed';
    release.currentPhase = nextPhase;
    if (nextPhase !== 'completed' && release.phases[nextPhase]) {
      release.phases[nextPhase].startedAt = new Date();
    }
    const statusByPhase = { distribution: 'in_preparation', marketing: 'submitted', post_release: 'released', completed: 'released' };
    release.status = statusByPhase[nextPhase] || release.status;
    await release.save();
    res.json({ success: true, data: release });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateChecklistItem = async (req, res) => {
  try {
    const { phase, itemId } = req.params;
    const release = await Release.findById(req.params.id);
    if (!release) return res.status(404).json({ success: false, message: 'Release not found' });
    const phaseData = release.phases[phase];
    if (!phaseData) return res.status(400).json({ success: false, message: 'Invalid phase' });
    const item = phaseData.checklist.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Checklist item not found' });
    if (phase === 'preparation' && item.item === 'Ownership confirmed' && req.body.status === 'completed') {
      const validation = await verifyReleaseOwnership(release);
      if (!validation.valid) {
        await release.save();
        return res.status(400).json({
          success: false,
          message: 'Ownership cannot be confirmed until every song passes rights validation',
          errors: validation.errors,
        });
      }
    }
    if (phase === 'preparation' && item.item === 'Ownership confirmed' && req.body.status !== 'completed') {
      release.ownershipConfirmed = false;
    }
    const allowedUpdates = ['status', 'assignedTo', 'dueDate', 'notes'];
    allowedUpdates.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) item[field] = req.body[field] || undefined;
    });
    if (req.body.status === 'completed') item.completedAt = new Date();
    else if (req.body.status) item.completedAt = undefined;
    if (phase === 'preparation') {
      const flagByItem = {
        'Final master delivered': 'masterApproved',
        'Artwork approved': 'artworkApproved',
        'Metadata completed': 'metadataComplete',
      };
      const flag = flagByItem[item.item];
      if (flag) release[flag] = item.status === 'completed';
    }
    await release.save();
    res.json({ success: true, data: release });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const [total, byStatus, byPhase, upcoming, byType] = await Promise.all([
      Release.countDocuments(),
      Release.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Release.aggregate([{ $group: { _id: '$currentPhase', count: { $sum: 1 } } }]),
      Release.find({ releaseDate: { $gte: new Date() }, status: { $nin: ['cancelled', 'released'] } })
        .populate('artist', 'name artistName stageName')
        .sort('releaseDate').limit(10),
      Release.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    ]);
    res.json({
      success: true,
      data: {
        total,
        byStatus: byStatus.reduce((a, s) => { a[s._id] = s.count; return a; }, {}),
        byPhase: byPhase.reduce((a, s) => { a[s._id] = s.count; return a; }, {}),
        byType,
        upcoming,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
