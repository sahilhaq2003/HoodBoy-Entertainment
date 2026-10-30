const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS } = require('../lib/mediaValidation');
const policy = require('../services/distribeats/distribeatsPolicy');

const root = path.join(__dirname, '..', 'uploads', 'distribution');
fs.mkdirSync(root, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, root),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]+/gi, '-').slice(0, 80) || 'asset';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
  },
});

class UploadRejected extends Error {
  constructor(field, message, code) { super(message); this.field = field; this.code = code; this.isUploadRejection = true; }
}

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'cover') {
    return IMAGE_EXTENSIONS.has(ext) ? cb(null, true) : cb(new UploadRejected('cover', 'Artwork must be a JPG or PNG file.', 'ART_FORMAT'));
  }
  if (/^audio_\d+$/.test(file.fieldname)) {
    return AUDIO_EXTENSIONS.has(ext) ? cb(null, true) : cb(new UploadRejected(file.fieldname.replace('audio_', 'tracks[') + '].audio', 'Audio must be WAV or FLAC. AIFF, MP3, M4A and other formats are not accepted.', 'AUDIO_FORMAT'));
  }
  return cb(new UploadRejected(file.fieldname, `Unexpected upload field "${file.fieldname}".`, 'UNEXPECTED_FIELD'));
};

// The ceiling here is the provider's own master limit (150,000,000 bytes by default). The controller
// re-checks against the live GET /catalogue value. Cover size is checked in the controller as well.
const upload = multer({
  storage,
  limits: { fileSize: policy.maxAudioBytes(), files: 51 },
  fileFilter,
});

/** multipart parser that answers rejected uploads with a structured 422 instead of a generic 500. */
const uploadAny = (req, res, next) => upload.any()(req, res, error => {
  if (!error) return next();
  const tooLarge = error.code === 'LIMIT_FILE_SIZE';
  const field = error.field || (tooLarge ? 'audio' : 'files');
  const message = tooLarge ? `File exceeds the maximum upload size of ${policy.maxAudioBytes().toLocaleString('en-US')} bytes.` : error.message;
  return res.status(tooLarge ? 413 : 422).json({ success: false, message, errors: [{ field, message, code: error.code || 'UPLOAD_REJECTED' }] });
});

module.exports = { uploadAny, any: () => uploadAny, fileFilter, UploadRejected };
