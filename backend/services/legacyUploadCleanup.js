const fs = require('fs');
const path = require('path');

const uploadRoot = path.resolve(__dirname, '..', 'uploads');

// Image URLs created by the legacy upload middleware are local files. Never
// attempt to delete arbitrary or externally hosted URLs from a profile field.
const removePreviousArtistImage = async (imageUrl) => {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/images/')) return;

  const relativePath = imageUrl.slice('/uploads/'.length);
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

module.exports = { removePreviousArtistImage };
