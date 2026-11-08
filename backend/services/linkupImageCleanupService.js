const fs = require('node:fs');
const path = require('node:path');

const defaultRoot = path.resolve(__dirname, '..', 'uploads', 'linkup');
const publicPrefix = '/uploads/linkup/';

const resolveLinkupImagePath = (publicUrl, root = defaultRoot) => {
  if (typeof publicUrl !== 'string') return null;
  const cleanUrl = publicUrl.split(/[?#]/, 1)[0];
  if (!cleanUrl.startsWith(publicPrefix)) return null;
  const filename = cleanUrl.slice(publicPrefix.length);
  if (!filename || filename !== path.basename(filename)) return null;
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, filename);
  return candidate.startsWith(`${resolvedRoot}${path.sep}`) ? candidate : null;
};

const removeLinkupImage = async (publicUrl, options = {}) => {
  const diskPath = resolveLinkupImagePath(publicUrl, options.root);
  if (!diskPath) return false;
  try {
    await fs.promises.unlink(diskPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const removeLinkupImages = async (urls, options = {}) => {
  const unique = [...new Set((urls || []).filter(Boolean))];
  const results = await Promise.allSettled(unique.map(url => removeLinkupImage(url, options)));
  for (const result of results) if (result.status === 'rejected') console.error(`Linkup image cleanup warning: ${result.reason?.message || result.reason}`);
  return results.filter(result => result.status === 'fulfilled' && result.value).length;
};

module.exports = { resolveLinkupImagePath, removeLinkupImage, removeLinkupImages };
