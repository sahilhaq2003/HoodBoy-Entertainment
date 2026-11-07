const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const destination = path.join(__dirname, '..', 'private_uploads', 'linkup_receipts');
const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    try { fs.mkdirSync(destination, { recursive: true }); callback(null, destination); }
    catch (error) { callback(error); }
  },
  filename(_req, file, callback) {
    const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' };
    callback(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extensions[file.mimetype]}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    callback(allowed.includes(file.mimetype) ? null : new Error('Receipt must be a JPG, PNG, or PDF'), allowed.includes(file.mimetype));
  },
});
