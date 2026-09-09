const WeeklyReport = require('../models/WeeklyReport');

const REPORT_FIELDS = ['weekStart', 'weekEnd', 'completed', 'stillOpen', 'blocked', 'needsApproval', 'dueThisWeek', 'biggestRisk', 'nextActionOwner', 'notes'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getAll = async (req, res) => {
  try {
    const reports = await WeeklyReport.find().populate('createdBy', 'name').sort('-weekStart');
    res.json({ success: true, data: reports });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getById = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id).populate('createdBy', 'name');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const create = async (req, res) => {
  try {
    const report = await WeeklyReport.create({ ...pick(req.body, REPORT_FIELDS), createdBy: req.user._id });
    res.status(201).json({ success: true, data: report });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const update = async (req, res) => {
  try {
    const report = await WeeklyReport.findByIdAndUpdate(req.params.id, pick(req.body, REPORT_FIELDS), { new: true, runValidators: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const remove = async (req, res) => {
  try {
    const report = await WeeklyReport.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCurrentWeek = async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    let report = await WeeklyReport.findOne({ weekStart: { $lte: weekEnd }, weekEnd: { $gte: weekStart } }).populate('createdBy', 'name');
    if (!report) {
      report = await WeeklyReport.create({ weekStart, weekEnd, createdBy: req.user._id });
      report = await report.populate('createdBy', 'name');
    }
    res.json({ success: true, data: report });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getAll, getById, create, update, remove, getCurrentWeek };
