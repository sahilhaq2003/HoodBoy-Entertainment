const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'songs');
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([
  '.wav', '.mp3', '.flac', '.aif', '.aiff', '.m4a', '.aac', '.ogg', '.zip',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path.basename(file.originalname, extension)
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'audio';
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBaseName}${extension}`);
  },
});

const fileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.has(extension)) return callback(null, true);
  callback(new Error('Unsupported song file. Upload WAV, MP3, FLAC, AIFF, M4A, AAC, OGG, or ZIP files.'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});
