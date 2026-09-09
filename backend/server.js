require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.listen(PORT, () => {
  console.log(`🚀 HBE Label API running on http://localhost:${PORT}`);
});
