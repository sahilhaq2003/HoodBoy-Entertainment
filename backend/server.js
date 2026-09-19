require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const app = express();

// Middleware
const configuredOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
// Keep local Vite development available against the deployed API for
// authenticated end-to-end testing without opening CORS to arbitrary sites.
const allowedOrigins = [...new Set([...configuredOrigins, 'http://localhost:5173', 'http://localhost:5174'])];
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Large dashboard and management payloads compress especially well. This also
// covers API traffic when the app is run without the production nginx proxy.
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Managed library files are always served through /api/files with authentication.
// Legacy non-library uploads retain their existing paths.
app.use('/uploads', (req, res, next) => {
  if (req.path === '/files' || req.path.startsWith('/files/')) {
    return res.status(404).json({ success: false, message: 'Use the authorized file endpoint' });
  }
  return next();
}, express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  immutable: true,
  etag: true,
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/artists', require('./routes/artists'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/finances', require('./routes/finances'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/songs', require('./routes/songs'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/development', require('./routes/development'));
app.use('/api/files', require('./routes/fileManager'));
app.use('/api/ownership', require('./routes/ownership'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/releases', require('./routes/releases'));
app.use('/api/weekly-reports', require('./routes/weeklyReports'));
app.use('/api/metadata', require('./routes/metadata'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/royalties', require('./routes/royalties'));
app.use('/api/contract-templates', require('./routes/contractTemplates'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/tax-calendar', require('./routes/taxCalendar'));
app.use('/api/artist-balances', require('./routes/artistBalances'));
app.use('/api/per-song-analytics', require('./routes/perSongAnalytics'));
app.use('/api/lnk-up', require('./routes/lnkUp'));
app.use('/api/users', require('./routes/users'));
app.use('/api/search', require('./routes/search'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'HBE Label Management API is running 🎵', timestamp: new Date() });
});

const { errorHandler, notFound } = require('./middleware/errorHandler');

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`🚀 HBE Label API running on http://${HOST}:${PORT}`);
});
