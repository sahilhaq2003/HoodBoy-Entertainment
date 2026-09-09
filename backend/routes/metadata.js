const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const {
  getMetadata, getMetadataById, getMetadataBySong,
  createMetadata, updateMetadata, deleteMetadata,
  validateMetadata, bulkValidate, exportMetadata, getStats,
} = require('../controllers/metadataController');

router.use(protect);

router.get('/stats', checkPermission('metadata', 'read'), getStats);
router.post('/validate', checkPermission('metadata', 'read'), validateMetadata);
router.post('/validate/bulk', checkPermission('metadata', 'read'), bulkValidate);
router.post('/export', checkPermission('metadata', 'read'), exportMetadata);
router.get('/song/:songId', checkPermission('metadata', 'read'), getMetadataBySong);
router.route('/').get(checkPermission('metadata', 'read'), getMetadata).post(checkPermission('metadata', 'write'), createMetadata);
router.route('/:id').get(checkPermission('metadata', 'read'), getMetadataById).put(checkPermission('metadata', 'write'), updateMetadata).delete(checkPermission('metadata', 'write'), deleteMetadata);

module.exports = router;
