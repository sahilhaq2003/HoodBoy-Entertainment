const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getAll, getById, create, update, delete: remove, getExpiring, getStats,
} = require('../controllers/contractController');

router.use(protect);

router.get('/stats', checkPermission('contracts', 'read'), getStats);
router.get('/expiring', checkPermission('contracts', 'read'), getExpiring);
router.get('/', checkPermission('contracts', 'read'), getAll);
router.get('/:id', checkPermission('contracts', 'read'), getById);
router.post('/', upload.single('file'), checkPermission('contracts', 'write'), create);
router.put('/:id', upload.single('file'), checkPermission('contracts', 'write'), update);
router.delete('/:id', checkPermission('contracts', 'write'), remove);

module.exports = router;
