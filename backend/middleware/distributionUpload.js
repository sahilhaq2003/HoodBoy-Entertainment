const multer = require('multer');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', 'uploads', 'distribution');
fs.mkdirSync(root, { recursive: true });
const audio = new Set(['.wav', '.flac', '.aif', '.aiff', '.mp3', '.m4a']);
const images = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, root),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]+/gi, '-').slice(0, 80) || 'asset';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 51 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'cover' && images.has(ext)) return cb(null, true);
    if (file.fieldname.startsWith('audio_') && audio.has(ext)) return cb(null, true);
    cb(new Error('Invalid distribution asset. Cover: JPG/PNG/WEBP; audio: WAV/FLAC/AIFF/MP3/M4A.'));
  },
});
