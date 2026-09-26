const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const controller = require('../controllers/labelgridController');

router.use(protect, authorize('admin'));
router.get('/connection-status', controller.status);
router.post('/sync/artists', controller.syncArtists);
router.post('/sync/releases', controller.syncReleases);
router.post('/artists/:id/sync', controller.syncArtist);

module.exports = router;
