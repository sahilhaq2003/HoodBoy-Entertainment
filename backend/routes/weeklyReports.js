const express = require('express');
const router = express.Router();
const { getAll, getById, create, update, remove, getCurrentWeek } = require('../controllers/weeklyReportController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/current', checkPermission('weeklyReports', 'read'), getCurrentWeek);
router.route('/').get(checkPermission('weeklyReports', 'read'), getAll).post(checkPermission('weeklyReports', 'write'), create);
router.route('/:id').get(checkPermission('weeklyReports', 'read'), getById).put(checkPermission('weeklyReports', 'write'), update).delete(checkPermission('weeklyReports', 'write'), remove);

module.exports = router;
