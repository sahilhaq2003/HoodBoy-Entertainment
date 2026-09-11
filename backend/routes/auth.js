const express = require('express');
const router = express.Router();
const {
  login, getMe, updateProfile, changePassword,
  verifyTwoFactorLogin, setupTwoFactor, confirmTwoFactor, disableTwoFactor,
  requestPasswordReset, resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/login/2fa', verifyTwoFactorLogin);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.post('/2fa/setup', protect, setupTwoFactor);
router.post('/2fa/confirm', protect, confirmTwoFactor);
router.post('/2fa/disable', protect, disableTwoFactor);

module.exports = router;
