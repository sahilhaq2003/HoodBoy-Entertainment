require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const app = express();

// ── CORS origins ──────────────────────────────────────────────────────────────
const configuredOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...configuredOrigins, 'http://localhost:5173', 'http://localhost:5174'])];

// ── Core Middleware ───────────────────────────────────────────────────────────
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression({ threshold: 1024 }));

// LabelGrid webhook MUST receive the raw body before express.json() parses it.
app.post(
  '/api/webhooks/labelgrid',
  express.raw({ type: 'application/json', limit: '64kb' }),
  require('./controllers/labelgridController').webhook
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  if (req.path === '/files' || req.path.startsWith('/files/')) {
    return res.status(404).json({ success: false, message: 'Use the authorized file endpoint' });
  }
  return next();
}, express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', immutable: true, etag: true }));

// ── API Routes ────────────────────────────────────────────────────────────────
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
app.use('/api/distribution', require('./routes/distribution'));
app.use('/api/labelgrid', require('./routes/labelgrid'));
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

app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: 'HBE Label Management API is running 🎵', timestamp: new Date() })
);

const { errorHandler, notFound } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ── Socket.IO real-time engine ────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new SocketIO(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
  transports: ['websocket', 'polling'],
});

// Make io accessible to any controller/service via global.io — avoids
// circular-import problems and keeps service modules side-effect-free.
global.io = io;

// Authenticate every socket connection with the same JWT the REST API uses.
io.use((socket, next) => {
  try {
    const raw =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer /i, '');
    if (!raw) return next(new Error('Authentication required'));
    socket.user = jwt.verify(raw, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const { id: userId, role } = socket.user || {};

  // Per-user and per-role rooms for targeted emissions.
  if (userId) socket.join(`user:${userId}`);
  if (role)   socket.join(`role:${role}`);
  // Admins receive all labelgrid-admin broadcasts.
  if (role === 'admin') socket.join('labelgrid:admin');

  // Clients join a release room so they get live updates for a specific release.
  socket.on('join:release', (releaseId) => { if (releaseId) socket.join(`release:${releaseId}`); });
  socket.on('leave:release', (releaseId) => { if (releaseId) socket.leave(`release:${releaseId}`); });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '127.0.0.1';
httpServer.listen(PORT, HOST, () => {
  const safeMongoUri = process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@') : 'Not Configured';
  console.log(`🚀 HBE API running on http://${HOST}:${PORT} [Socket.IO enabled]`);
  console.log(`🍃 MongoDB URI: ${safeMongoUri}`);
});
