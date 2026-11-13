const DistributionRelease = require('../models/DistributionRelease');
const distribeats = require('./distribeats/distribeatsService');

const ACTIVE_STATUSES = ['submitted', 'processing', 'approved', 'delivered', 'rejected', 'error'];
let workerTimer = null;
let running = false;

const emitRelease = release => {
  const payload = {
    releaseId: String(release._id),
    title: release.title,
    status: release.status,
    qcStatus: release.qcStatus,
    syncStatus: release.syncStatus,
    distribeatsRawStatus: release.distribeatsRawStatus,
    distribeatsReleaseId: release.distribeatsReleaseId,
    storeStatuses: release.storeStatuses,
    uploadState: release.uploadState,
    lastSyncedAt: release.lastSyncedAt,
    lastSyncError: release.lastSyncError,
  };
  global.io?.to(`release:${release._id}`).emit('distribeats:release_updated', payload);
  global.io?.to('distribeats:admin').emit('distribeats:release_updated', payload);
};

const syncActiveReleases = async ({
  findReleases = () => DistributionRelease.find({ status: { $in: ACTIVE_STATUSES } }),
  syncRelease = release => distribeats.syncReleaseStatus(release),
  emit = emitRelease,
  log = message => console.error(message),
} = {}) => {
  if (running) return { skipped: true, synced: 0, failed: 0 };
  running = true;
  let synced = 0;
  let failed = 0;
  try {
    const releases = await findReleases();
    for (const release of releases) {
      if (!release.distribeatsReleaseId) continue;
      try {
        await syncRelease(release);
        emit(release);
        synced += 1;
      } catch (error) {
        failed += 1;
        log(`DistriBeats automatic sync warning for ${release._id}: ${error.message}`);
      }
    }
    return { skipped: false, synced, failed };
  } finally {
    running = false;
  }
};

const startDistributionSyncWorker = () => {
  if (workerTimer) return workerTimer;
  const configured = Number(process.env.DISTRIBEATS_SYNC_INTERVAL_MS || 120000);
  const intervalMs = Math.max(60000, Number.isFinite(configured) ? configured : 120000);
  const run = () => syncActiveReleases().catch(error => console.error(`DistriBeats automatic sync worker warning: ${error.message}`));
  const initialTimer = setTimeout(run, Math.min(15000, intervalMs));
  initialTimer.unref();
  workerTimer = setInterval(run, intervalMs);
  workerTimer.unref();
  return workerTimer;
};

module.exports = { ACTIVE_STATUSES, syncActiveReleases, startDistributionSyncWorker };
