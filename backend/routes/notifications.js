const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const Notification = require('../models/Notification');
const { generateDeadlineNotifications } = require('../services/notificationService');

router.use(protect);

router.get('/', checkPermission('notifications', 'read'), async (req, res) => {
  try {
    const { unread, page = 1, limit = 30 } = req.query;
    const query = { userId: req.user._id };
    if (unread === 'true') query.read = false;
    const notifications = await Notification.find(query)
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ success: true, data: notifications, total, unreadCount });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/read-all', checkPermission('notifications', 'read'), async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/unread-count', checkPermission('notifications', 'read'), async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ success: true, data: { count } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/:id/read', checkPermission('notifications', 'read'), async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json({ success: true, data: notif });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/:id', checkPermission('notifications', 'write'), async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/generate', checkPermission('notifications', 'write'), async (req, res) => {
  try {
    const count = await generateDeadlineNotifications();
    res.json({ success: true, message: `Generated ${count} notifications` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
