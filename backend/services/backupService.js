const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TARGETS = {
  cloud: {
    env: 'CLOUD_BACKUP_PATH',
    label: 'Cloud-synced drive',
  },
  external: {
    env: 'EXTERNAL_BACKUP_PATH',
    label: 'External backup drive',
  },
};

const checksumFile = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', chunk => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const getTarget = (target) => {
  const definition = TARGETS[target];
  if (!definition) throw new Error('Backup target must be cloud or external');
  const configuredPath = process.env[definition.env];
  if (!configuredPath) {
    const error = new Error(`${definition.label} is not configured. Set ${definition.env}.`);
    error.code = 'BACKUP_NOT_CONFIGURED';
    throw error;
  }
  const root = path.resolve(configuredPath);
  if (!fs.existsSync(root)) {
    const error = new Error(`${definition.label} is unavailable. Connect or mount the configured drive.`);
    error.code = 'BACKUP_UNAVAILABLE';
    throw error;
  }
  return { ...definition, root };
};

const safeDestination = (root, relativePath) => {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const destination = path.resolve(root, ...normalized.split('/').filter(Boolean));
  if (destination !== root && !destination.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid backup destination');
  }
  return destination;
};

const backupFile = async ({ sourcePath, relativePath, target }) => {
  const destinationTarget = getTarget(target);
  const destinationPath = safeDestination(destinationTarget.root, relativePath);
  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.promises.copyFile(sourcePath, destinationPath);

  const [sourceStats, destinationStats, sourceChecksum, destinationChecksum] = await Promise.all([
    fs.promises.stat(sourcePath),
    fs.promises.stat(destinationPath),
    checksumFile(sourcePath),
    checksumFile(destinationPath),
  ]);
  if (sourceStats.size !== destinationStats.size || sourceChecksum !== destinationChecksum) {
    await fs.promises.unlink(destinationPath).catch(() => {});
    throw new Error(`Backup verification failed for ${destinationTarget.label}`);
  }

  return {
    target,
    label: destinationTarget.label,
    checksum: destinationChecksum,
    size: destinationStats.size,
    verifiedAt: new Date(),
  };
};

const getConfiguration = () => Object.entries(TARGETS).reduce((result, [target, definition]) => {
  const configuredPath = process.env[definition.env];
  result[target] = {
    label: definition.label,
    configured: Boolean(configuredPath),
    available: Boolean(configuredPath && fs.existsSync(path.resolve(configuredPath))),
  };
  return result;
}, {});

module.exports = { backupFile, checksumFile, getConfiguration };
