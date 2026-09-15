const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

const cloudinaryUrl = process.env.CLOUDINARY_URL;
const cloudinaryEnabled = Boolean(cloudinaryUrl);

if (cloudinaryEnabled) cloudinary.config({ secure: true });

const removeLocalTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const uploadArtistImage = async (file) => {
  if (!cloudinaryEnabled) return `/uploads/images/${file.filename}`;

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'hbe/artist-images',
      resource_type: 'image',
      use_filename: false,
      unique_filename: true,
    });
    return result.secure_url;
  } finally {
    // Multer writes a temporary local file first. Cloudinary is the source of
    // truth once configured, so do not leave duplicate files on the server.
    await removeLocalTempFile(file.path);
  }
};

const cloudinaryPublicId = (imageUrl) => {
  if (typeof imageUrl !== 'string' || !imageUrl.includes('res.cloudinary.com')) return null;
  try {
    const segments = new URL(imageUrl).pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');
    if (uploadIndex === -1) return null;
    const pathParts = segments.slice(uploadIndex + 1);
    if (/^v\d+$/.test(pathParts[0])) pathParts.shift();
    const publicId = pathParts.join('/').replace(/\.[^.]+$/, '');
    return publicId.startsWith('hbe/artist-images/') ? publicId : null;
  } catch {
    return null;
  }
};

const removeCloudinaryArtistImage = async (imageUrl) => {
  if (!cloudinaryEnabled) return false;
  const publicId = cloudinaryPublicId(imageUrl);
  if (!publicId) return false;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  return true;
};

module.exports = { uploadArtistImage, removeCloudinaryArtistImage };
