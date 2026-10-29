const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const controller = require('../controllers/distribeatsController');

router.use(protect, authorize('admin'));
router.get('/connection-status', controller.status);
router.get('/catalogue', controller.catalogue);
router.get('/releases', controller.listRemoteReleases);
router.get('/artists', controller.listRemoteArtists);
router.post('/sync/releases', controller.syncReleases);
router.post('/sync/artists', controller.syncArtists);
router.post('/webhooks/inbound', controller.inboundEvent);

module.exports = router;
