const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const ctrl = require('../controllers/campaignController');
const { validate, commonValidations } = require('../middleware/validate');

router.use(protect);
router.get('/stats', checkPermission('campaigns', 'read'), ctrl.getCampaignStats);
router.get('/calendar', checkPermission('campaigns', 'read'), ctrl.getCalendar);
router.route('/')
  .get(checkPermission('campaigns', 'read'), ctrl.getCampaigns)
  .post(checkPermission('campaigns', 'create'), validate(commonValidations.createCampaign), ctrl.createCampaign);
router.route('/:id')
  .get(checkPermission('campaigns', 'read'), ctrl.getCampaignById)
  .put(checkPermission('campaigns', 'update'), ctrl.updateCampaign)
  .delete(checkPermission('campaigns', 'delete'), ctrl.deleteCampaign);
router.get('/:id/performance', checkPermission('campaigns', 'read'), ctrl.getCampaignPerformance);
router.post('/:id/content', checkPermission('campaigns', 'create'), ctrl.addContentItem);
router.put('/:id/content/:contentId', checkPermission('campaigns', 'update'), ctrl.updateContentItem);
router.delete('/:id/content/:contentId', checkPermission('campaigns', 'delete'), ctrl.deleteContentItem);

module.exports = router;
