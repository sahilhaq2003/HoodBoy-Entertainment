const express = require('express');
const router = express.Router();
const { getDashboardStats, getMonthlyFinancials, getProjectStatusBreakdown, getUpcomingDeadlines, getUnifiedDashboard, getRoleDashboard, getMyProfile, updateMyProfile, uploadMyImage } = require('../controllers/dashboardController');
const { protect, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/role', checkPermission('dashboard', 'read'), getRoleDashboard);
router.get('/profile', checkPermission('dashboard', 'read'), getMyProfile);
router.put('/profile', checkPermission('dashboard', 'write'), updateMyProfile);
router.post('/profile/image', checkPermission('dashboard', 'write'), upload.single('file'), uploadMyImage);
router.get('/stats', checkPermission('dashboard', 'read'), getDashboardStats);
router.get('/financials', checkPermission('dashboard', 'read'), getMonthlyFinancials);
router.get('/projects', checkPermission('dashboard', 'read'), getProjectStatusBreakdown);
router.get('/deadlines', checkPermission('dashboard', 'read'), getUpcomingDeadlines);
router.get('/unified', checkPermission('dashboard', 'read'), getUnifiedDashboard);

module.exports = router;
