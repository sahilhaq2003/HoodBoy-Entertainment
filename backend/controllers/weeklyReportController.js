const WeeklyReport = require('../models/WeeklyReport');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Release = require('../models/Release');

const REPORT_FIELDS = ['weekStart', 'weekEnd', 'completed', 'stillOpen', 'blocked', 'needsApproval', 'dueThisWeek', 'biggestRisk', 'nextActionOwner', 'notes'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const taskSummary = task => ({
  _id: task._id,
  title: task.title,
  status: task.status,
  priority: task.priority,
  category: task.category,
  deadline: task.deadline,
  completedAt: task.completedAt,
  assignee: task.assignedTo?.name || 'Unassigned',
  project: task.relatedProject?.name || '',
});

const buildAutomation = async (weekStart, weekEnd) => {
  const now = new Date();
  const upcomingEnd = new Date(weekEnd);
  upcomingEnd.setDate(upcomingEnd.getDate() + 30);

  const [tasks, projects, releases] = await Promise.all([
    Task.find().populate('assignedTo', 'name role').populate('relatedProject', 'name').sort('deadline').limit(2000),
    Project.find().populate('assignedTo', 'name').populate('artist', 'name stageName artistName').limit(1000),
    Release.find().populate('assignedTo', 'name').populate('artist', 'name stageName artistName').sort('releaseDate').limit(1000),
  ]);

  const completed = tasks.filter(task => task.status === 'completed' && task.completedAt && new Date(task.completedAt) >= weekStart && new Date(task.completedAt) <= weekEnd);
  const active = tasks.filter(task => task.status !== 'completed');
  const open = active.filter(task => ['not_started', 'in_progress', 'delayed'].includes(task.status));
  const blocked = active.filter(task => task.status === 'blocked');
  const approvals = active.filter(task => task.status === 'waiting_approval');
  const due = active.filter(task => task.deadline && new Date(task.deadline) >= weekStart && new Date(task.deadline) <= weekEnd);
  const overdue = active.filter(task => task.deadline && new Date(task.deadline) < now);
  const critical = active.filter(task => task.priority === 'critical');

  const ownerMap = new Map();
  active.forEach(task => {
    const owner = task.assignedTo?.name || 'Unassigned';
    const current = ownerMap.get(owner) || { owner, total: 0, overdue: 0, blocked: 0, critical: 0 };
    current.total += 1;
    if (task.deadline && new Date(task.deadline) < now) current.overdue += 1;
    if (task.status === 'blocked') current.blocked += 1;
    if (task.priority === 'critical') current.critical += 1;
    ownerMap.set(owner, current);
  });

  const activeProjects = projects.filter(project => !['completed', 'cancelled'].includes(project.status));
  const atRiskProjects = activeProjects.filter(project => project.status === 'delayed' || project.priority === 'critical' || (project.releaseDate && new Date(project.releaseDate) < now));
  const upcomingReleases = releases.filter(release => {
    const releaseDate = new Date(release.releaseDate);
    return !['released', 'cancelled'].includes(release.status) && releaseDate >= weekStart && releaseDate <= upcomingEnd;
  });

  const totalOutcome = completed.length + active.length;
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      completed: completed.length,
      active: active.length,
      open: open.length,
      blocked: blocked.length,
      approvals: approvals.length,
      dueThisWeek: due.length,
      overdue: overdue.length,
      critical: critical.length,
      completionRate: totalOutcome ? Math.round((completed.length / totalOutcome) * 100) : 0,
      activeProjects: activeProjects.length,
      atRiskProjects: atRiskProjects.length,
      upcomingReleases: upcomingReleases.length,
    },
    completedTasks: completed.slice(0, 100).map(taskSummary),
    openTasks: open.slice(0, 100).map(taskSummary),
    blockedTasks: blocked.slice(0, 100).map(taskSummary),
    approvalTasks: approvals.slice(0, 100).map(taskSummary),
    dueTasks: due.slice(0, 100).map(taskSummary),
    overdueTasks: overdue.slice(0, 100).map(taskSummary),
    ownerWorkload: [...ownerMap.values()].sort((a, b) => (b.overdue + b.blocked + b.critical) - (a.overdue + a.blocked + a.critical) || b.total - a.total),
    atRiskProjects: atRiskProjects.slice(0, 50).map(project => ({
      _id: project._id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      completionPercentage: project.completionPercentage || 0,
      releaseDate: project.releaseDate,
      owner: project.assignedTo?.name || 'Unassigned',
      artist: project.artist?.stageName || project.artist?.artistName || project.artist?.name || '',
    })),
    upcomingReleases: upcomingReleases.slice(0, 50).map(release => ({
      _id: release._id,
      title: release.title,
      status: release.status,
      priority: release.priority,
      releaseDate: release.releaseDate,
      owner: release.assignedTo?.name || 'Unassigned',
      artist: release.artist?.stageName || release.artist?.artistName || release.artist?.name || '',
    })),
  };
};

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
    const automation = await buildAutomation(weekStart, weekEnd);
    res.json({ success: true, data: { ...report.toObject(), automation } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getAll, getById, create, update, remove, getCurrentWeek };
