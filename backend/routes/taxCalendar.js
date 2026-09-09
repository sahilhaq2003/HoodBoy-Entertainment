const express = require('express');
const router = express.Router();
const { getAll, getUpcoming, create, update, delete: remove } = require('../controllers/taxCalendarController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/', checkPermission('taxCalendar', 'read'), getAll);
router.get('/upcoming', checkPermission('taxCalendar', 'read'), getUpcoming);
router.post('/', checkPermission('taxCalendar', 'write'), create);
router.put('/:id', checkPermission('taxCalendar', 'write'), update);
router.delete('/:id', checkPermission('taxCalendar', 'write'), remove);

module.exports = router;
