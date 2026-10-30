const express = require('express');
const router = express.Router();
const {
  login, getMe, updateProfile, changePassword,
  verifyTwoFactorLogin, setupTwoFactor, confirmTwoFactor, disableTwoFactor,
  requestPasswordReset, resetPassword, uploadAvatar, removeAvatar,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/login', login);
router.post('/login/2fa', verifyTwoFactorLogin);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/profile/avatar', protect, upload.single('file'), uploadAvatar);
router.delete('/profile/avatar', protect, removeAvatar);
router.put('/password', protect, changePassword);
router.post('/2fa/setup', protect, setupTwoFactor);
router.post('/2fa/confirm', protect, confirmTwoFactor);
router.post('/2fa/disable', protect, disableTwoFactor);

module.exports = router;
