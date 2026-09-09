const Task = require('../models/Task');

const TASK_FIELDS = ['title', 'description', 'assignedTo', 'relatedProject', 'relatedArtist', 'deadline', 'status', 'priority', 'category', 'deliverable', 'tags', 'completedAt', 'notes'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getTasks = async (req, res) => {
  try {
    const { status, priority, assignedTo, category, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name')
      .populate('relatedProject', 'name')
      .populate('relatedArtist', 'name stageName')
      .sort('deadline')
      .limit(limit * 1).skip((page - 1) * limit);
    const total = await Task.countDocuments(query);
    res.json({ success: true, data: tasks, total });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name')
      .populate('relatedProject', 'name')
      .populate('relatedArtist', 'name stageName');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createTask = async (req, res) => {
  try {
    const task = await Task.create({ ...pick(req.body, TASK_FIELDS), assignedBy: req.user._id });
    res.status(201).json({ success: true, data: task });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const updateTask = async (req, res) => {
  try {
    const updateData = pick(req.body, TASK_FIELDS);
    if (updateData.status === 'completed' && !updateData.completedAt) updateData.completedAt = new Date();
    const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getKanban = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name')
      .populate('relatedProject', 'name')
      .populate('relatedArtist', 'name stageName')
      .sort('deadline');
    const columns = {
      not_started: [], in_progress: [], waiting_approval: [],
      blocked: [], delayed: [], completed: [],
    };
    for (const t of tasks) {
      const col = columns[t.status] || columns.not_started;
      col.push(t);
    }
    res.json({ success: true, data: columns });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getTeamPerformance = async (req, res) => {
  try {
    const users = await Task.aggregate([
      { $match: { assignedTo: { $exists: true } } },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          delayed: { $sum: { $cond: [{ $eq: ['$status', 'delayed'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
          onTime: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'completed'] }, { $lte: ['$completedAt', '$deadline'] }] },
                1, 0,
              ],
            },
          },
        },
      },
      {
        $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1, name: '$user.name', role: '$user.role',
          total: 1, completed: 1, delayed: 1, inProgress: 1, critical: 1, onTime: 1,
          completionRate: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 0] }, 0] },
          onTimeRate: { $cond: [{ $gt: ['$completed', 0] }, { $round: [{ $multiply: [{ $divide: ['$onTime', '$completed'] }, 100] }, 0] }, 0] },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.json({ success: true, data: users });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getStats = async (req, res) => {
  try {
    const [total, byStatus, byPriority, overdue, dueThisWeek] = await Promise.all([
      Task.countDocuments(),
      Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Task.countDocuments({ deadline: { $lt: new Date() }, status: { $nin: ['completed'] } }),
      Task.countDocuments({
        deadline: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) },
        status: { $nin: ['completed'] },
      }),
    ]);
    res.json({
      success: true,
      data: {
        total,
        byStatus: byStatus.reduce((a, s) => { a[s._id] = s.count; return a; }, {}),
        byPriority: byPriority.reduce((a, s) => { a[s._id] = s.count; return a; }, {}),
        overdue, dueThisWeek,
      },
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getTasks, getTask, createTask, updateTask, deleteTask, getKanban, getTeamPerformance, getStats };
