const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Central library accepts only the business file formats required by the label.
// Executables, HTML, scripts and SVG are intentionally excluded.
const ALLOWED_TYPES = new Map([
  ['.pdf', new Set(['application/pdf'])],
  ['.doc', new Set(['application/msword', 'application/octet-stream'])],
  ['.docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])],
  ['.txt', new Set(['text/plain'])],
  ['.csv', new Set(['text/csv', 'application/vnd.ms-excel', 'text/plain'])],
  ['.xls', new Set(['application/vnd.ms-excel', 'application/octet-stream'])],
  ['.xlsx', new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])],
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
  ['.gif', new Set(['image/gif'])],
  ['.mp3', new Set(['audio/mpeg', 'audio/mp3'])],
  ['.wav', new Set(['audio/wav', 'audio/x-wav', 'audio/wave'])],
  ['.flac', new Set(['audio/flac', 'audio/x-flac'])],
  ['.aac', new Set(['audio/aac', 'audio/x-aac'])],
  ['.m4a', new Set(['audio/mp4', 'audio/x-m4a'])],
  ['.aiff', new Set(['audio/aiff', 'audio/x-aiff'])],
  ['.mp4', new Set(['video/mp4'])],
  ['.mov', new Set(['video/quicktime'])],
  ['.avi', new Set(['video/x-msvideo'])],
  ['.webm', new Set(['video/webm'])],
  ['.zip', new Set(['application/zip', 'application/x-zip-compressed'])],
  ['.rar', new Set(['application/vnd.rar', 'application/x-rar-compressed'])],
  ['.7z', new Set(['application/x-7z-compressed'])],
]);

const configuredLimitMb = Number.parseInt(process.env.FILE_UPLOAD_MAX_MB || '500', 10);
const maxFileSize = (Number.isFinite(configuredLimitMb) && configuredLimitMb > 0 ? configuredLimitMb : 500) * 1024 * 1024;

const incomingDirectory = path.join(__dirname, '..', 'uploads', 'files', '.incoming');
fs.mkdirSync(incomingDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, incomingDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: maxFileSize, files: 20, fields: 30, fieldSize: 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const acceptedMimeTypes = ALLOWED_TYPES.get(extension);
    if (!acceptedMimeTypes || !acceptedMimeTypes.has((file.mimetype || '').toLowerCase())) {
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      error.message = `Unsupported or mismatched file type: ${extension || 'no extension'}`;
      return callback(error);
    }
    callback(null, true);
  },
});

module.exports.allowedExtensions = [...ALLOWED_TYPES.keys()];
module.exports.maxFileSize = maxFileSize;
