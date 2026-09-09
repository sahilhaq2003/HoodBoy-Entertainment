const User = require('../models/User');
const { ROLE_ACCESS, ROLE_NAV, ROLE_DASHBOARDS, ROLE_DESCRIPTIONS } = require('../middleware/rbac');

const USERS_FIELDS = ['name', 'email', 'password', 'role', 'avatar', 'department', 'phone', 'isActive'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getUsers = async (req, res) => {
  try {
    const { search, role, isActive, department, page = 1, limit = 50 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (department) query.department = { $regex: department, $options: 'i' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);
    res.json({ success: true, data: users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }
    const validRoles = ['admin', 'manager', 'artist', 'finance', 'marketing'];
    const userRole = validRoles.includes(role) ? role : 'artist';
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: userRole,
      department: department || '',
      phone: phone || '',
      isActive: true,
    });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const allowed = pick(req.body, ['name', 'email', 'role', 'department', 'phone', 'avatar', 'isActive']);
    if (allowed.email && allowed.email !== user.email) {
      const existing = await User.findOne({ email: allowed.email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use by another account' });
      }
      allowed.email = allowed.email.toLowerCase();
    }
    if (allowed.role) {
      const validRoles = ['admin', 'manager', 'artist', 'finance', 'marketing'];
      if (!validRoles.includes(allowed.role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
    }
    Object.assign(user, allowed);
    await user.save();
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last admin account' });
      }
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, data: user, message: `Account ${user.isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTeamStats = async (req, res) => {
  try {
    const [total, byRole, activeCount, inactiveCount, byDepartment] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.aggregate([
        { $match: { department: { $ne: '' } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    res.json({
      success: true,
      data: {
        total,
        active: activeCount,
        inactive: inactiveCount,
        byRole: byRole.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
        byDepartment,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPermissionsMatrix = async (req, res) => {
  try {
    const roles = Object.keys(ROLE_ACCESS);
    const resources = [...new Set(roles.flatMap(r => Object.keys(ROLE_ACCESS[r])))];
    const matrix = resources.map(resource => {
      const perms = { resource };
      roles.forEach(role => {
        const access = ROLE_ACCESS[role][resource];
        if (access === true) perms[role] = { read: true, write: true };
        else if (access) perms[role] = access;
        else perms[role] = { read: false, write: false };
      });
      return perms;
    });
    const roleMeta = {};
    Object.keys(ROLE_DESCRIPTIONS).forEach(r => {
      roleMeta[r] = {
        description: ROLE_DESCRIPTIONS[r],
        dashboard: ROLE_DASHBOARDS[r],
        navCount: ROLE_NAV[r]?.length || 0,
      };
    });
    res.json({ success: true, data: { matrix, roleMeta } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser, toggleActive, resetPassword, getTeamStats, getPermissionsMatrix };
