const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 20 },
});
