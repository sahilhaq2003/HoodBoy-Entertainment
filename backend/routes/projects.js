const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { protect, checkPermission } = require('../middleware/auth');

const PROJECT_FIELDS = ['name', 'type', 'artist', 'songs', 'status', 'priority', 'releaseDate', 'startDate', 'budget', 'spent', 'assignedTo', 'description', 'coverArt', 'notes', 'completionPercentage'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

router.use(protect);

router.get('/', checkPermission('projects', 'read'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    const projects = await Project.find(query).populate('artist', 'name stageName').populate('assignedTo', 'name').sort('-createdAt').limit(limit * 1).skip((page - 1) * limit);
    const total = await Project.countDocuments(query);
    res.json({ success: true, data: projects, total });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/', checkPermission('projects', 'write'), async (req, res) => {
  try {
    const project = await Project.create(pick(req.body, PROJECT_FIELDS));
    res.status(201).json({ success: true, data: project });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

router.put('/:id', checkPermission('projects', 'write'), async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, pick(req.body, PROJECT_FIELDS), { new: true, runValidators: true });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: project });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

router.delete('/:id', checkPermission('projects', 'write'), async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
