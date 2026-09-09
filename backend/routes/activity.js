const express = require('express');
const router = express.Router();
const { getActivities, getTimeline } = require('../controllers/activityController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/', checkPermission('activity', 'read'), getActivities);
router.get('/timeline', checkPermission('activity', 'read'), getTimeline);

module.exports = router;
