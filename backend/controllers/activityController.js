const Activity = require('../models/Activity');

const logActivity = async ({ action, entityType, entityId, entityName, user, userName, details, metadata }) => {
  try {
    await Activity.create({ action, entityType, entityId, entityName, user, userName, details, metadata });
  } catch (e) { console.error('Activity log error:', e.message); }
};

const getActivities = async (req, res) => {
  try {
    const { entityType, entityId, user, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (user) filter.user = user;
    const activities = await Activity.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Activity.countDocuments(filter);
    res.json({ success: true, data: activities, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTimeline = async (req, res) => {
  try {
    const { days = 30, limit = 100 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    const activities = await Activity.find({ createdAt: { $gte: since } })
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    const grouped = {};
    activities.forEach(a => {
      const date = a.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(a);
    });
    res.json({ success: true, data: { activities, grouped, total: activities.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { logActivity, getActivities, getTimeline };
