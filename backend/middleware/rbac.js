const ROLE_DESCRIPTIONS = {
  admin: 'Full system access — manage all modules, users, and settings.',
  manager: 'Manage artists, projects, songs, releases, tasks, and campaigns.',
  artist: 'View own profile, songs, releases, royalties, and tasks.',
  finance: 'Full access to finances, budgets, royalties, and reports.',
  marketing: 'Manage campaigns, contacts, content, and social media.',
};

const ROLE_DASHBOARDS = {
  admin: '/',
  manager: '/manager-dashboard',
  artist: '/artist-dashboard',
  finance: '/finance-dashboard',
  marketing: '/marketing-dashboard',
};

const ROLE_NAV = {
  admin: [
    { path: '/', label: 'Dashboard' },
    { path: '/artists', label: 'Artists' },
    { path: '/songs', label: 'Music Catalog' },
    { path: '/releases', label: 'Releases' },
    { path: '/the-lnk-up', label: 'The Lnk Up' },
    { path: '/projects', label: 'Projects' },
    { path: '/contracts', label: 'Contracts' },
    { path: '/finance', label: 'Finance' },
    { path: '/royalties', label: 'Royalties' },
    { path: '/artist-balances', label: 'Artist Balances' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/song-analytics', label: 'Song Analytics' },
    { path: '/campaigns', label: 'Campaigns' },
    { path: '/development', label: 'Development' },
    { path: '/ownership', label: 'Ownership' },
    { path: '/files', label: 'Files' },
    { path: '/metadata', label: 'Metadata' },
    { path: '/contract-templates', label: 'Templates' },
    { path: '/tax-calendar', label: 'Tax Calendar' },
    { path: '/contacts', label: 'Contacts' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/team', label: 'Team' },
    { path: '/settings', label: 'Settings' },
  ],
  manager: [
    { path: '/manager-dashboard', label: 'Dashboard' },
    { path: '/artists', label: 'Artists' },
    { path: '/songs', label: 'Music Catalog' },
    { path: '/releases', label: 'Releases' },
    { path: '/the-lnk-up', label: 'The Lnk Up' },
    { path: '/projects', label: 'Projects' },
    { path: '/campaigns', label: 'Campaigns' },
    { path: '/development', label: 'Development' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/contacts', label: 'Contacts' },
    { path: '/analytics', label: 'Analytics' },
  ],
  artist: [
    { path: '/artist-dashboard', label: 'Dashboard' },
    { path: '/my-music', label: 'My Music' },
    { path: '/my-releases', label: 'My Releases' },
    { path: '/royalties', label: 'Royalties' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/profile', label: 'Profile' },
  ],
  finance: [
    { path: '/finance-dashboard', label: 'Dashboard' },
    { path: '/tasks', label: 'My Tasks' },
    { path: '/finance', label: 'Finance' },
    { path: '/royalties', label: 'Royalties' },
    { path: '/artist-balances', label: 'Artist Balances' },
    { path: '/budgets', label: 'Budgets' },
    { path: '/tax-calendar', label: 'Tax Calendar' },
  ],
  marketing: [
    { path: '/marketing-dashboard', label: 'Dashboard' },
    { path: '/tasks', label: 'My Tasks' },
    { path: '/campaigns', label: 'Campaigns' },
    { path: '/contacts', label: 'Contacts' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/song-analytics', label: 'Song Analytics' },
  ],
};

const ROLE_ACCESS = {
  admin: {
    dashboard: true,
    artists: { read: true, write: true },
    songs: { read: true, write: true },
    releases: { read: true, write: true },
    theLnkUp: { read: true, write: true },
    projects: { read: true, write: true },
    contracts: { read: true, write: true },
    contractTemplates: { read: true, write: true },
    finance: { read: true, write: true },
    budgets: { read: true, write: true },
    royalties: { read: true, write: true },
    artistBalances: { read: true, write: true },
    analytics: { read: true },
    songAnalytics: { read: true, write: true },
    campaigns: { read: true, write: true },
    development: { read: true, write: true },
    ownership: { read: true, write: true },
    files: { read: true, write: true },
    metadata: { read: true, write: true },
    taxCalendar: { read: true, write: true },
    contacts: { read: true, write: true },
    tasks: { read: true, write: true },
    weeklyReports: { read: true, write: true },
    notifications: { read: true, write: true },
    activity: { read: true },
    settings: true,
  },
  manager: {
    dashboard: true,
    artists: { read: true, write: true },
    songs: { read: true, write: true },
    releases: { read: true, write: true },
    theLnkUp: { read: true, write: true },
    projects: { read: true, write: true },
    contracts: { read: true, write: false },
    contractTemplates: { read: false, write: false },
    finance: { read: false, write: false },
    budgets: { read: false, write: false },
    royalties: { read: false, write: false },
    artistBalances: { read: false, write: false },
    analytics: { read: true },
    songAnalytics: { read: false, write: false },
    campaigns: { read: true, write: true },
    development: { read: true, write: true },
    ownership: { read: true, write: false },
    files: { read: true, write: true },
    metadata: { read: true, write: true },
    taxCalendar: { read: false, write: false },
    contacts: { read: true, write: true },
    tasks: { read: true, write: true },
    weeklyReports: { read: true, write: true },
    notifications: { read: true, write: false },
    activity: { read: true },
    settings: false,
  },
  artist: {
    dashboard: true,
    artists: { read: false, write: false },
    songs: { read: false, write: false },
    releases: { read: false, write: false },
    projects: { read: false, write: false },
    contracts: { read: false, write: false },
    contractTemplates: { read: false, write: false },
    finance: { read: false, write: false },
    budgets: { read: false, write: false },
    royalties: { read: false, write: false },
    artistBalances: { read: false, write: false },
    analytics: { read: false },
    songAnalytics: { read: false, write: false },
    campaigns: { read: false, write: false },
    development: { read: false, write: false },
    ownership: { read: false, write: false },
    files: { read: false, write: false },
    metadata: { read: false, write: false },
    taxCalendar: { read: false, write: false },
    contacts: { read: false, write: false },
    tasks: { read: true, write: false },
    weeklyReports: { read: false, write: false },
    notifications: { read: true, write: false },
    activity: { read: false },
    settings: false,
  },
  finance: {
    dashboard: true,
    artists: { read: true, write: false },
    songs: { read: false, write: false },
    releases: { read: true, write: false },
    projects: { read: false, write: false },
    contracts: { read: true, write: false },
    contractTemplates: { read: true, write: true },
    finance: { read: true, write: true },
    budgets: { read: true, write: true },
    royalties: { read: true, write: true },
    artistBalances: { read: true, write: true },
    projects: { read: true, write: false },
    analytics: { read: true },
    songAnalytics: { read: true, write: true },
    campaigns: { read: false, write: false },
    development: { read: false, write: false },
    ownership: { read: false, write: false },
    files: { read: false, write: false },
    metadata: { read: false, write: false },
    taxCalendar: { read: true, write: true },
    contacts: { read: false, write: false },
    tasks: { read: true, write: false },
    weeklyReports: { read: false, write: false },
    notifications: { read: true, write: false },
    activity: { read: false },
    settings: false,
  },
  marketing: {
    dashboard: true,
    artists: { read: true, write: false },
    songs: { read: true, write: false },
    releases: { read: true, write: false },
    projects: { read: false, write: false },
    contracts: { read: false, write: false },
    contractTemplates: { read: false, write: false },
    finance: { read: false, write: false },
    budgets: { read: false, write: false },
    royalties: { read: false, write: false },
    artistBalances: { read: false, write: false },
    analytics: { read: true },
    songAnalytics: { read: true, write: false },
    campaigns: { read: true, write: true },
    development: { read: false, write: false },
    ownership: { read: false, write: false },
    files: { read: false, write: false },
    metadata: { read: false, write: false },
    taxCalendar: { read: false, write: false },
    contacts: { read: true, write: true },
    tasks: { read: true, write: false },
    weeklyReports: { read: false, write: false },
    notifications: { read: true, write: false },
    activity: { read: false },
    settings: false,
  },
};

const checkPermission = (resource, action) => {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(403).json({ success: false, message: 'No role assigned' });
    const access = ROLE_ACCESS[role];
    if (!access) return res.status(403).json({ success: false, message: 'Invalid role' });
    const resourceAccess = access[resource];
    if (!resourceAccess) return res.status(403).json({ success: false, message: `Access denied: ${resource}` });
    if (resourceAccess === true) return next();
    // Routes use CRUD verbs while the policy stores a compact read/write matrix.
    // Normalize these aliases here so authorization stays backend-enforced and
    // every module follows the same rule.
    const normalizedAction = {
      create: 'write',
      update: 'write',
      delete: 'write',
      approve: 'write',
      manage: 'write',
      export: 'read',
    }[action] || action;
    if (resourceAccess[normalizedAction]) return next();
    return res.status(403).json({ success: false, message: `Insufficient permissions: ${resource}:${action}` });
  };
};

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Role '${req.user?.role}' is not authorized` });
    }
    next();
  };
};

const filterByRole = (model, options = {}) => {
  return async (req, res, next) => {
    if (req.user.role === 'admin') return next();
    const artistField = options.artistField || 'artist';
    const assignedField = options.assignedField || 'assignedTo';
    if (req.user.role === 'artist') {
      const User = require('../models/User');
      const artistDoc = await require('../models/Artist').findOne({ email: req.user.email });
      if (artistDoc) {
        req.roleFilter = { [artistField]: artistDoc._id };
      } else {
        req.roleFilter = { [artistField]: req.user._id };
      }
    } else if (req.user.role === 'manager') {
      req.roleFilter = { [assignedField]: req.user._id };
    }
    next();
  };
};

module.exports = {
  ROLE_DESCRIPTIONS,
  ROLE_DASHBOARDS,
  ROLE_NAV,
  ROLE_ACCESS,
  checkPermission,
  allowRoles,
  filterByRole,
};
