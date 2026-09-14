const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Authorization only needs this small identity projection. In particular,
      // do not hydrate avatar data URIs and profile settings on every API call.
      req.user = await User.findById(decoded.id)
        .select('_id name email role isActive')
        .lean();
      if (!req.user || req.user.isActive === false) {
        return res.status(401).json({ success: false, message: 'Account is deactivated' });
      }
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

const { checkPermission, allowRoles, filterByRole } = require('./rbac');
module.exports = { protect, authorize: allowRoles, checkPermission, allowRoles, filterByRole };
