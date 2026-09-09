const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
    const user = await User.create({ name, email, password, role: 'artist' });
    const token = generateToken(user._id);
    const { ROLE_DESCRIPTIONS, ROLE_DASHBOARDS, ROLE_NAV, ROLE_ACCESS } = require('../middleware/rbac');
    res.status(201).json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, phone: user.phone, department: user.department },
      roleDescription: ROLE_DESCRIPTIONS[user.role] || '',
      dashboardPath: ROLE_DASHBOARDS[user.role] || '/',
      nav: ROLE_NAV[user.role] || [],
      access: ROLE_ACCESS[user.role] || {},
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const user = await User.findOne({ email }).select('+password');
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
    const token = generateToken(user._id);
    const { ROLE_DESCRIPTIONS, ROLE_DASHBOARDS, ROLE_NAV, ROLE_ACCESS } = require('../middleware/rbac');
    res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, phone: user.phone, department: user.department },
      roleDescription: ROLE_DESCRIPTIONS[user.role] || '',
      dashboardPath: ROLE_DASHBOARDS[user.role] || '/',
      nav: ROLE_NAV[user.role] || [],
      access: ROLE_ACCESS[user.role] || {},
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
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

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { name, phone, department, avatar } = req.body;
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

module.exports = { register, login, getMe, updateProfile, changePassword };
