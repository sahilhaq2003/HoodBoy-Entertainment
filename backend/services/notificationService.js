const Notification = require('../models/Notification');

const createNotification = async ({ userId, type, title, message, link, priority, metadata }) => {
  return Notification.create({ userId, type, title, message, link: link || '', priority: priority || 'medium', metadata: metadata || {} });
};

const createBulkNotifications = async (notifications) => {
  return Notification.insertMany(notifications);
};

const generateDeadlineNotifications = async () => {
  const Task = require('../models/Task');
  const Contract = require('../models/Contract');
  const Release = require('../models/Release');
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const notifications = [];

  const tasks = await Task.find({ deadline: { $gte: now, $lte: in3Days }, status: { $nin: ['completed'] } }).populate('assignedTo', 'name');
  for (const task of tasks) {
    if (task.assignedTo) {
      notifications.push({
        userId: task.assignedTo._id,
        type: 'task_deadline',
        title: `Task Due: ${task.title}`,
        message: `Deadline approaching: ${task.deadline.toLocaleDateString()}`,
        link: '/tasks',
        priority: 'high',
        metadata: { taskId: task._id },
      });
    }
  }

  const contracts = await Contract.find({ endDate: { $gte: now, $lte: in7Days }, status: 'active' }).populate('artist', 'name stageName');
  for (const contract of contracts) {
    if (contract.managedBy || contract.artist?._id) {
      notifications.push({
        userId: contract.managedBy || contract.artist._id,
        type: 'contract_expiry',
        title: `Contract Expiring: ${contract.title}`,
        message: `Expires on ${contract.endDate.toLocaleDateString()}`,
        link: '/contracts',
        priority: 'high',
        metadata: { contractId: contract._id },
      });
    }
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
  return notifications.length;
};

module.exports = { createNotification, createBulkNotifications, generateDeadlineNotifications };
