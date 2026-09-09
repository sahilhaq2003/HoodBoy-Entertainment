const express = require('express');
const router = express.Router();
const { getDashboardStats, getMonthlyFinancials, getProjectStatusBreakdown, getUpcomingDeadlines, getUnifiedDashboard, getRoleDashboard } = require('../controllers/dashboardController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/role', checkPermission('dashboard', 'read'), getRoleDashboard);
router.get('/stats', checkPermission('dashboard', 'read'), getDashboardStats);
router.get('/financials', checkPermission('dashboard', 'read'), getMonthlyFinancials);
router.get('/projects', checkPermission('dashboard', 'read'), getProjectStatusBreakdown);
router.get('/deadlines', checkPermission('dashboard', 'read'), getUpcomingDeadlines);
router.get('/unified', checkPermission('dashboard', 'read'), getUnifiedDashboard);

module.exports = router;
