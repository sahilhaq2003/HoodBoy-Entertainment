const fs = require('fs');
const path = require('path');

const uploadRoot = path.resolve(__dirname, '..', 'uploads');

// Image URLs created by the legacy upload middleware are local files. Never
// attempt to delete arbitrary or externally hosted URLs from a profile field.
const removeLocalUpload = async (publicUrl, folder) => {
  const prefix = `/uploads/${folder}/`;
  if (typeof publicUrl !== 'string' || !publicUrl.startsWith(prefix)) return;
  const relativePath = publicUrl.slice('/uploads/'.length);
  const diskPath = path.resolve(uploadRoot, ...relativePath.split('/').filter(Boolean));
  if (!diskPath.startsWith(`${uploadRoot}${path.sep}`)) return;

  try {
    await fs.promises.unlink(diskPath);
  } catch (error) {
    // A missing legacy file should not prevent the newly uploaded image from
    // being saved. Re-throw real filesystem errors for observability.
    if (error.code !== 'ENOENT') throw error;
  }
};

const removePreviousArtistImage = (imageUrl) => removeLocalUpload(imageUrl, 'images');
const removePreviousDocument = (documentUrl) => removeLocalUpload(documentUrl, 'documents');

module.exports = { removePreviousArtistImage, removePreviousDocument };
