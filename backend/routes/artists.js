const express = require('express');
const router = express.Router();
const {
  getArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,
  updateOnboardingStep,
  uploadDocument,
  uploadImage,
  removeImage,
  removeDocument,
  approveOnboarding,
  rejectOnboarding,
  submitForApproval,
  getOnboardingStats,
} = require('../controllers/artistController');
const { protect, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

// Onboarding stats (must be before /:id routes)
router.get('/onboarding/stats', checkPermission('artists', 'read'), getOnboardingStats);

// CRUD
router.route('/').get(checkPermission('artists', 'read'), getArtists).post(checkPermission('artists', 'create'), createArtist);
router.route('/:id').get(checkPermission('artists', 'read'), getArtist).put(checkPermission('artists', 'update'), updateArtist).delete(checkPermission('artists', 'delete'), deleteArtist);

// Onboarding steps
router.put('/:id/onboarding-step', checkPermission('artists', 'write'), updateOnboardingStep);
router.put('/:id/submit-for-approval', checkPermission('artists', 'write'), submitForApproval);
router.put('/:id/approve', checkPermission('artists', 'write'), approveOnboarding);
router.put('/:id/reject', checkPermission('artists', 'write'), rejectOnboarding);

// Document uploads
router.post('/:id/documents', checkPermission('artists', 'write'), upload.single('file'), uploadDocument);
router.delete('/:id/documents/:docId', checkPermission('artists', 'write'), removeDocument);

// Image uploads
router.post('/:id/image', checkPermission('artists', 'write'), upload.single('file'), uploadImage);
router.delete('/:id/image', checkPermission('artists', 'write'), removeImage);

module.exports = router;
