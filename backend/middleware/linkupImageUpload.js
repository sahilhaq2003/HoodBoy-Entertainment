const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const destination = path.join(__dirname, '..', 'uploads', 'linkup');
const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    try {
      fs.mkdirSync(destination, { recursive: true });
      callback(null, destination);
    } catch (error) { callback(error); }
  },
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${extensions[file.mimetype] || ''}`),
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!extensions[file.mimetype]) return callback(new Error('Image must be a JPG, PNG, or WEBP file.'));
    callback(null, true);
  },
});
