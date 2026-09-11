const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

const authPayload = (user, token) => {
  const { ROLE_DESCRIPTIONS, ROLE_DASHBOARDS, ROLE_NAV, ROLE_ACCESS } = require('../middleware/rbac');
  return {
    success: true,
    token,
    user,
    roleDescription: ROLE_DESCRIPTIONS[user.role] || '',
    dashboardPath: ROLE_DASHBOARDS[user.role] || '/',
    nav: ROLE_NAV[user.role] || [],
    access: ROLE_ACCESS[user.role] || {},
  };
};

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const encodeBase32 = (buffer) => {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) output += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return output;
};
const decodeBase32 = (value) => {
  const normalized = String(value).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of normalized) bits += BASE32.indexOf(char).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};
const totp = (secret, counter = Math.floor(Date.now() / 30000)) => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(value % 1000000).padStart(6, '0');
};
const verifyTotp = (secret, code) => {
  const normalized = String(code || '').replace(/\D/g, '');
  const counter = Math.floor(Date.now() / 30000);
  return normalized.length === 6 && [-1, 0, 1].some(offset => {
    const expected = Buffer.from(totp(secret, counter + offset));
    const received = Buffer.from(normalized);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password +twoFactorSecret');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact an administrator.' });
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.twoFactorEnabled) {
      const challengeToken = jwt.sign({ id: user._id, purpose: '2fa-login' }, process.env.JWT_SECRET, { expiresIn: '5m' });
      return res.json({ success: true, requiresTwoFactor: true, challengeToken });
    }
    res.json(authPayload(user, generateToken(user._id)));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(authPayload(user, undefined));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { name, phone, department, avatar, notificationPreferences, appearance, integrationLinks } = req.body;
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (avatar !== undefined) {
      if (avatar === '' || (typeof avatar === 'string' && avatar.startsWith('data:image/') && avatar.length <= 3500000)) {
        user.avatar = avatar;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid profile image. Must be an image data URI under 3.5MB.' });
      }
    }
    if (notificationPreferences !== undefined) {
      if (!Array.isArray(notificationPreferences) || notificationPreferences.length > 20 || notificationPreferences.some(pref => !pref || typeof pref.key !== 'string' || typeof pref.enabled !== 'boolean')) {
        return res.status(400).json({ success: false, message: 'Invalid notification preferences' });
      }
      user.notificationPreferences = notificationPreferences.map(pref => ({ key: pref.key.trim().slice(0, 80), enabled: pref.enabled }));
    }
    if (appearance !== undefined) {
      const validThemes = ['light', 'indigo', 'warm', 'dark'];
      const validSizes = ['small', 'default', 'large'];
      if (!appearance || !validThemes.includes(appearance.theme) || !validSizes.includes(appearance.fontSize)) {
        return res.status(400).json({ success: false, message: 'Invalid appearance settings' });
      }
      user.appearance = appearance;
    }
    if (integrationLinks !== undefined) {
      const sanitized = {};
      for (const key of ['spotify', 'appleMusic', 'distributor']) {
        const value = String(integrationLinks?.[key] || '').trim();
        if (value) {
          try {
            const parsed = new URL(value);
            if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('invalid');
          } catch {
            return res.status(400).json({ success: false, message: `${key} must be a valid web URL` });
          }
        }
        sanitized[key] = value;
      }
      user.integrationLinks = sanitized;
    }
    await user.save();
    const { ROLE_DESCRIPTIONS, ROLE_DASHBOARDS, ROLE_NAV, ROLE_ACCESS } = require('../middleware/rbac');
    res.json({
      success: true,
      user,
      roleDescription: ROLE_DESCRIPTIONS[user.role] || '',
      dashboardPath: ROLE_DASHBOARDS[user.role] || '/',
      nav: ROLE_NAV[user.role] || [],
      access: ROLE_ACCESS[user.role] || {},
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyTwoFactorLogin = async (req, res) => {
  try {
    const decoded = jwt.verify(req.body.challengeToken, process.env.JWT_SECRET);
    if (decoded.purpose !== '2fa-login') return res.status(401).json({ success: false, message: 'Invalid verification challenge' });
    const user = await User.findById(decoded.id).select('+twoFactorSecret');
    if (!user || !user.isActive || !user.twoFactorEnabled || !verifyTotp(user.twoFactorSecret, req.body.code)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired authenticator code' });
    }
    res.json(authPayload(user, generateToken(user._id)));
  } catch {
    res.status(401).json({ success: false, message: 'Verification challenge expired. Sign in again.' });
  }
};

const setupTwoFactor = async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const secret = encodeBase32(crypto.randomBytes(20));
  user.twoFactorSecret = secret;
  user.twoFactorEnabled = false;
  await user.save();
  const label = encodeURIComponent(`HoodBoy Entertainment:${user.email}`);
  const issuer = encodeURIComponent('HoodBoy Entertainment');
  res.json({ success: true, data: { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&period=30&digits=6` } });
};

const confirmTwoFactor = async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!user?.twoFactorSecret || !verifyTotp(user.twoFactorSecret, req.body.code)) {
    return res.status(400).json({ success: false, message: 'Invalid authenticator code' });
  }
  user.twoFactorEnabled = true;
  await user.save();
  res.json({ success: true, message: 'Two-factor authentication enabled' });
};

const disableTwoFactor = async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +twoFactorSecret');
  if (!user || !await user.matchPassword(req.body.password || '')) {
    return res.status(401).json({ success: false, message: 'Password is incorrect' });
  }
  user.twoFactorEnabled = false;
  user.twoFactorSecret = '';
  await user.save();
  res.json({ success: true, message: 'Two-factor authentication disabled' });
};

const requestPasswordReset = async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (process.env.NODE_ENV === 'production' && !process.env.PASSWORD_RESET_WEBHOOK_URL) {
      return res.status(503).json({ success: false, message: 'Password recovery delivery is not configured. Contact an administrator.' });
    }
    const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
    const generic = { success: true, message: 'If the account exists, password reset instructions are available.' };
    if (!user) return res.json(generic);
    const token = crypto.randomBytes(24).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?resetToken=${token}`;
    if (process.env.PASSWORD_RESET_WEBHOOK_URL) {
      const response = await fetch(process.env.PASSWORD_RESET_WEBHOOK_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name, resetUrl, expiresInMinutes: 15 }),
      });
      if (!response.ok) throw new Error('Password reset delivery failed');
    }
    res.json({ ...generic, ...(process.env.NODE_ENV !== 'production' || process.env.PASSWORD_RESET_EXPOSE_TOKEN === 'true' ? { demoToken: token } : {}) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(String(req.body.token || '')).digest('hex');
  const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } })
    .select('+passwordResetToken +passwordResetExpires');
  if (!user) return res.status(400).json({ success: false, message: 'Reset link is invalid or expired' });
  if (!req.body.newPassword || req.body.newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }
  user.password = req.body.newPassword;
  user.passwordResetToken = '';
  user.passwordResetExpires = undefined;
  await user.save();
  res.json({ success: true, message: 'Password reset. You can now sign in.' });
};

module.exports = {
  login, getMe, updateProfile, changePassword,
  verifyTwoFactorLogin, setupTwoFactor, confirmTwoFactor, disableTwoFactor,
  requestPasswordReset, resetPassword,
};
// Exported for deterministic authentication tests; not exposed as an HTTP route.
module.exports._totp = totp;
module.exports._verifyTotp = verifyTotp;
