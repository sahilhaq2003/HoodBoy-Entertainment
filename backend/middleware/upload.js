const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Deployment environments start from the repository contents, where upload
// folders are intentionally not committed. Create the destination on demand
// so Multer does not fail with ENOENT before the controller receives a file.
const uploadDirectory = (file) => path.join(
  __dirname,
  '..',
  file.mimetype.startsWith('image/') ? 'uploads/images' : 'uploads/documents'
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const destination = uploadDirectory(file);
    try {
      fs.mkdirSync(destination, { recursive: true });
      cb(null, destination);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Accepted: PDF, JPEG, PNG, WEBP, DOC, DOCX, TXT'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = upload;
