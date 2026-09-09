const fs = require('fs');
const path = require('path');

const useCloudStorage = process.env.AWS_S3_BUCKET || process.env.FIREBASE_BUCKET;

const localUpload = async (file, folder) => {
  const uploadDir = path.join(__dirname, '..', '..', 'uploads', folder);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${Date.now()}-${file.originalname}`;
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, file.buffer);
  return { url: `/uploads/${folder}/${filename}`, key: `${folder}/${filename}`, size: file.size, mime: file.mimetype };
};

const uploadFile = async (file, folder = 'uploads') => {
  if (process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
    return localUpload(file, folder);
  }
  return localUpload(file, folder);
};

const deleteFile = async (key) => {
  if (process.env.AWS_S3_BUCKET) {
    return { success: true };
  }
  const filepath = path.join(__dirname, '..', '..', 'uploads', key);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  return { success: true };
};

const getSignedUrl = async (key, expiresIn = 3600) => {
  if (process.env.AWS_S3_BUCKET) {
    return `/api/files/download/${encodeURIComponent(key)}`;
  }
  return `/uploads/${key}`;
};

module.exports = { uploadFile, deleteFile, getSignedUrl, useCloudStorage: !!useCloudStorage };
