const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(protect);

// Existing System 14 endpoints
router.get('/overview', checkPermission('analytics', 'read'), ctrl.getOverview);
router.get('/revenue', checkPermission('analytics', 'read'), ctrl.getRevenueAnalytics);
router.get('/artists', checkPermission('analytics', 'read'), ctrl.getArtistAnalytics);
router.get('/releases', checkPermission('analytics', 'read'), ctrl.getReleaseAnalytics);
router.get('/operational', checkPermission('analytics', 'read'), ctrl.getOperationalAnalytics);
router.get('/kpis', checkPermission('analytics', 'read'), ctrl.getKPIData);

// System 14: Enhanced analytics endpoints
router.get('/executive', checkPermission('analytics', 'read'), ctrl.getExecutiveDashboard);
router.get('/artist-performance', checkPermission('analytics', 'read'), ctrl.getArtistPerformanceDetail);
router.get('/release-performance', checkPermission('analytics', 'read'), ctrl.getReleasePerformanceDetail);
router.get('/financial', checkPermission('analytics', 'read'), ctrl.getFinancialAnalytics);
router.get('/marketing', checkPermission('analytics', 'read'), ctrl.getMarketingAnalytics);
router.get('/export', checkPermission('analytics', 'read'), ctrl.exportReport);

module.exports = router;
