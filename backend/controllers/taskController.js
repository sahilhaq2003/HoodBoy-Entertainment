const Task = require('../models/Task');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');

const TASK_FIELDS = ['title', 'description', 'assignedTo', 'relatedProject', 'relatedArtist', 'deadline', 'status', 'priority', 'category', 'deliverable', 'tags', 'notes'];
const TASK_SUMMARY_FIELDS = 'title description assignedTo deadline status priority category deliverable completedAt createdAt updatedAt';
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});
const canManageTasks = (user) => ['admin', 'manager'].includes(user?.role);
const taskScope = (req) => canManageTasks(req.user) ? {} : { assignedTo: req.user._id };
const idOf = (value) => value?._id?.toString?.() || value?.toString?.() || '';
const canParticipate = (task, user) => canManageTasks(user)
  || idOf(task.assignedTo) === user._id.toString()
  || idOf(task.assignedBy) === user._id.toString();
const populateTask = (query) => query
  .populate('assignedTo', 'name email role avatar isActive')
  .populate('assignedBy', 'name email role avatar')
  .populate('relatedProject', 'name')
  .populate('relatedArtist', 'name stageName artistName image')
  .populate('comments.author', 'name email role avatar')
  .populate('activity.actor', 'name role avatar')
  .lean();

const emptyKanban = () => ({
  not_started: [], in_progress: [], waiting_approval: [],
  blocked: [], delayed: [], completed: [],
});

const summarizeTasks = (tasks, now = new Date()) => {
  const kanban = emptyKanban();
  const byStatus = {};
  const byPriority = {};
  let overdue = 0;
  let dueThisWeek = 0;
  const weekEnd = new Date(now.getTime() + 7 * 86400000);

  for (const task of tasks) {
    (kanban[task.status] || kanban.not_started).push(task);
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    if (task.status !== 'completed' && task.deadline) {
      const deadline = new Date(task.deadline);
      if (deadline < now) overdue += 1;
      else if (deadline <= weekEnd) dueThisWeek += 1;
    }
  }

  return {
    kanban,
    stats: { total: tasks.length, byStatus, byPriority, overdue, dueThisWeek },
  };
};

const summarizeTeam = (tasks) => {
  const members = new Map();
  for (const task of tasks) {
    const assignee = task.assignedTo;
    if (!assignee?._id) continue;
    const id = assignee._id.toString();
    const member = members.get(id) || {
      _id: id, name: assignee.name, role: assignee.role,
      total: 0, completed: 0, delayed: 0, inProgress: 0, critical: 0, onTime: 0,
    };
    member.total += 1;
    if (task.status === 'completed') {
      member.completed += 1;
      if (task.completedAt && task.deadline && new Date(task.completedAt) <= new Date(task.deadline)) member.onTime += 1;
    }
    if (task.status === 'delayed') member.delayed += 1;
    if (task.status === 'in_progress') member.inProgress += 1;
    if (task.priority === 'critical') member.critical += 1;
    members.set(id, member);
  }

  return [...members.values()]
    .map(member => ({
      ...member,
      completionRate: member.total ? Math.round((member.completed / member.total) * 100) : 0,
      onTimeRate: member.completed ? Math.round((member.onTime / member.completed) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
};

const notifySafely = async (payload) => {
  try { await createNotification(payload); } catch (_error) { /* Task changes must not fail if notification storage is unavailable. */ }
};

const getTasks = async (req, res) => {
  try {
    const { status, priority, assignedTo, category, search, page = 1, limit = 50 } = req.query;
    const query = { ...taskScope(req) };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };
    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const [tasks, total] = await Promise.all([
      populateTask(Task.find(query))
      .sort('deadline')
      .limit(pageSize).skip((pageNumber - 1) * pageSize),
      Task.countDocuments(query),
    ]);
    res.json({ success: true, data: tasks, total });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// The tasks screen previously loaded the same records through several endpoints.
// This compact payload performs one task read and derives the board, statistics,
// and team figures in memory, saving repeated database queries and round trips.
const getOverview = async (req, res) => {
  try {
    const manager = canManageTasks(req.user);
    const tasksQuery = Task.find(taskScope(req))
      .select(TASK_SUMMARY_FIELDS)
      .populate('assignedTo', 'name email role isActive')
      .sort({ deadline: 1 })
      .lean();
    const usersQuery = manager
      ? User.find({ isActive: true }).select('name email role isActive').sort({ name: 1 }).lean()
      : Promise.resolve([]);
    const [tasks, users] = await Promise.all([tasksQuery, usersQuery]);
    const { kanban, stats } = summarizeTasks(tasks);
    res.json({
      success: true,
      data: {
        kanban,
        stats,
        team: manager ? summarizeTeam(tasks) : [],
        users,
      },
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getTask = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!canParticipate(task, req.user)) return res.status(403).json({ success: false, message: 'You can only access tasks assigned to you' });
    res.json({ success: true, data: task });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createTask = async (req, res) => {
  try {
    const data = pick(req.body, TASK_FIELDS);
    if (data.assignedTo) {
      const assignee = await User.findOne({ _id: data.assignedTo, isActive: true });
      if (!assignee) return res.status(400).json({ success: false, message: 'Select an active team member' });
    }
    const task = await Task.create({
      ...data,
      assignedTo: data.assignedTo || null,
      assignedBy: req.user._id,
      activity: [{ actor: req.user._id, action: 'created', message: 'Created the task' }],
    });
    if (task.assignedTo) {
      await notifySafely({
        userId: task.assignedTo, type: 'task_assigned', title: `New task: ${task.title}`,
        message: `${req.user.name} assigned this task to you`, link: `/tasks?task=${task._id}`,
        priority: task.priority === 'critical' ? 'high' : 'medium', metadata: { taskId: task._id },
      });
    }
    res.status(201).json({ success: true, data: await populateTask(Task.findById(task._id)) });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!canParticipate(task, req.user)) return res.status(403).json({ success: false, message: 'You can only update tasks assigned to you' });

    const manager = canManageTasks(req.user);
    const updateData = pick(req.body, manager ? TASK_FIELDS : ['status', 'notes']);
    const previousStatus = task.status;
    const previousAssignee = task.assignedTo?.toString() || '';

    if (updateData.assignedTo !== undefined) {
      if (updateData.assignedTo) {
        const assignee = await User.findOne({ _id: updateData.assignedTo, isActive: true });
        if (!assignee) return res.status(400).json({ success: false, message: 'Select an active team member' });
      } else updateData.assignedTo = null;
    }
    Object.assign(task, updateData);
    if (updateData.status === 'completed') task.completedAt = new Date();
    else if (updateData.status && previousStatus === 'completed') task.completedAt = undefined;

    if (updateData.assignedTo !== undefined && previousAssignee !== (task.assignedTo?.toString() || '')) {
      const action = !task.assignedTo ? 'unassigned' : previousAssignee ? 'reassigned' : 'assigned';
      task.activity.push({ actor: req.user._id, action, from: previousAssignee, to: task.assignedTo?.toString() || '', message: action === 'unassigned' ? 'Removed the assignee' : 'Changed the assignee' });
    }
    if (updateData.status && updateData.status !== previousStatus) {
      task.activity.push({ actor: req.user._id, action: 'status_changed', from: previousStatus, to: updateData.status, message: `Changed status from ${previousStatus} to ${updateData.status}` });
    }
    await task.save();

    if (updateData.assignedTo !== undefined && task.assignedTo && previousAssignee !== task.assignedTo.toString()) {
      await notifySafely({ userId: task.assignedTo, type: 'task_assigned', title: `Task assigned: ${task.title}`, message: `${req.user.name} assigned this task to you`, link: `/tasks?task=${task._id}`, priority: task.priority === 'critical' ? 'high' : 'medium', metadata: { taskId: task._id } });
    }
    if (updateData.status && updateData.status !== previousStatus) {
      const notifyUser = updateData.status === 'waiting_approval' ? task.assignedBy : (task.assignedTo?.toString() !== req.user._id.toString() ? task.assignedTo : task.assignedBy);
      if (notifyUser && notifyUser.toString() !== req.user._id.toString()) {
        await notifySafely({ userId: notifyUser, type: 'task_update', title: `Task updated: ${task.title}`, message: `${req.user.name} changed the status to ${updateData.status.replace(/_/g, ' ')}`, link: `/tasks?task=${task._id}`, priority: updateData.status === 'blocked' ? 'high' : 'medium', metadata: { taskId: task._id } });
      }
    }
    res.json({ success: true, data: await populateTask(Task.findById(task._id)) });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const addComment = async (req, res) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    if (message.length > 2000) return res.status(400).json({ success: false, message: 'Message must be 2,000 characters or fewer' });
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!canParticipate(task, req.user)) return res.status(403).json({ success: false, message: 'You cannot message on this task' });
    task.comments.push({ author: req.user._id, message });
    task.activity.push({ actor: req.user._id, action: 'commented', message: 'Added a message' });
    await task.save();
    const recipients = [task.assignedTo, task.assignedBy]
      .filter(Boolean).map(id => id.toString())
      .filter((id, index, all) => id !== req.user._id.toString() && all.indexOf(id) === index);
    for (const userId of recipients) {
      await notifySafely({ userId, type: 'task_comment', title: `New message: ${task.title}`, message: `${req.user.name}: ${message.slice(0, 120)}`, link: `/tasks?task=${task._id}`, priority: 'medium', metadata: { taskId: task._id } });
    }
    res.status(201).json({ success: true, data: await populateTask(Task.findById(task._id)) });
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
    const tasks = await populateTask(Task.find(taskScope(req))).sort('deadline');
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
      { $match: { assignedTo: { $exists: true, $ne: null } } },
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

const getAssignableUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email role isActive')
      .sort('name')
      .lean();
    res.json({ success: true, data: users });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getStats = async (req, res) => {
  try {
    const scope = taskScope(req);
    const scopeMatch = Object.keys(scope).length ? [{ $match: scope }] : [];
    const [total, byStatus, byPriority, overdue, dueThisWeek] = await Promise.all([
      Task.countDocuments(scope),
      Task.aggregate([...scopeMatch, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.aggregate([...scopeMatch, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Task.countDocuments({ ...scope, deadline: { $lt: new Date() }, status: { $nin: ['completed'] } }),
      Task.countDocuments({
        ...scope,
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

module.exports = { getTasks, getOverview, getTask, createTask, updateTask, deleteTask, addComment, getKanban, getTeamPerformance, getStats, getAssignableUsers };
