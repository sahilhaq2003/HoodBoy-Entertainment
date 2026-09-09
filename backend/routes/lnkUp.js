const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const ctrl = require('../controllers/lnkUpController');

router.use(protect);
router.get('/stats', checkPermission('theLnkUp', 'read'), ctrl.getStats);
router.route('/')
  .get(checkPermission('theLnkUp', 'read'), ctrl.getAll)
  .post(checkPermission('theLnkUp', 'write'), ctrl.create);
router.route('/:id')
  .get(checkPermission('theLnkUp', 'read'), ctrl.getById)
  .put(checkPermission('theLnkUp', 'write'), ctrl.update)
  .delete(checkPermission('theLnkUp', 'write'), ctrl.delete);

module.exports = router;
