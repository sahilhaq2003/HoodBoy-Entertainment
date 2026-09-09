const express = require('express');
const router = express.Router();
const {
  createPlan,
  getAllPlans,
  getPlan,
  updatePlan,
  deletePlan,
  addScorecard,
  updateScorecard,
  getArtistProgress,
  getDashboardStats,
} = require('../controllers/developmentController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', checkPermission('development', 'read'), getDashboardStats);
router.get('/artist/:artistId', checkPermission('development', 'read'), getArtistProgress);

router.route('/').get(checkPermission('development', 'read'), getAllPlans).post(checkPermission('development', 'write'), createPlan);
router.route('/:id').get(checkPermission('development', 'read'), getPlan).put(checkPermission('development', 'write'), updatePlan).delete(checkPermission('development', 'write'), deletePlan);

router.post('/:id/scorecards', checkPermission('development', 'write'), addScorecard);
router.put('/:id/scorecards/:scorecardId', checkPermission('development', 'write'), updateScorecard);

module.exports = router;
