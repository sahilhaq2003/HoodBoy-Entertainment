const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/distributionUpload');
const controller = require('../controllers/distributionController');

router.use(protect);
router.get('/connection', checkPermission('distribution', 'read'), controller.connectionStatus);
router.get('/reference-data', checkPermission('distribution', 'read'), controller.referenceData);
router.get('/royalties/summary', checkPermission('distribution', 'read'), controller.royaltySummary);
router.get('/labelgrid/royalties', checkPermission('distribution', 'read'), controller.labelgridRoyalties);
router.get('/labelgrid/analytics', checkPermission('distribution', 'read'), controller.labelgridAnalytics);
router.get('/royalties/export', checkPermission('distribution', 'read'), controller.exportRoyalties);
router.get('/', checkPermission('distribution', 'read'), controller.getAll);
router.get('/:id', checkPermission('distribution', 'read'), controller.getOne);
router.post('/', checkPermission('distribution', 'write'), upload.any(), controller.create);
router.put('/:id', checkPermission('distribution', 'write'), upload.any(), controller.update);
router.post('/:id/submit', checkPermission('distribution', 'write'), controller.submit);
router.post('/:id/sync', checkPermission('distribution', 'write'), controller.sync);
router.put('/:id/qc', protect, controller.adminUpdateQc);

module.exports = router;
