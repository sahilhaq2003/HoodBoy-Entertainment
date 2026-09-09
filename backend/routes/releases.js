const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const {
  getAll, getById, create, update, delete: remove,
  advancePhase, updateChecklistItem, getDashboard,
} = require('../controllers/releaseController');

router.use(protect);

router.get('/dashboard', checkPermission('releases', 'read'), getDashboard);
router.get('/', checkPermission('releases', 'read'), getAll);
router.get('/:id', checkPermission('releases', 'read'), getById);
router.post('/', checkPermission('releases', 'write'), create);
router.put('/:id', checkPermission('releases', 'write'), update);
router.delete('/:id', checkPermission('releases', 'write'), remove);
router.put('/:id/advance-phase', checkPermission('releases', 'write'), advancePhase);
router.put('/:id/phases/:phase/checklist/:itemId', checkPermission('releases', 'write'), updateChecklistItem);

module.exports = router;
