const express = require('express');
const router = express.Router();
const { getAll, getSongAnalytics, create, update, delete: remove } = require('../controllers/perSongAnalyticsController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/', checkPermission('songAnalytics', 'read'), getAll);
router.get('/song/:songId', checkPermission('songAnalytics', 'read'), getSongAnalytics);
router.post('/', checkPermission('songAnalytics', 'write'), create);
router.put('/:id', checkPermission('songAnalytics', 'write'), update);
router.delete('/:id', checkPermission('songAnalytics', 'write'), remove);

module.exports = router;
