const DistributionRelease = require('../models/DistributionRelease');
const distribeats = require('./distribeats/distribeatsService');

const ACTIVE_STATUSES = ['submitted', 'processing', 'approved', 'delivered', 'rejected', 'error'];
const DEFAULT_SWEEP_MS = 15 * 60 * 1000;
const DEFAULT_STALE_MS = 30 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;
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
  findReleases = () => DistributionRelease.find({ status: { $in: ACTIVE_STATUSES } }).sort({ lastSyncedAt: 1 }),
  syncRelease = release => distribeats.syncReleaseStatus(release),
  emit = emitRelease,
  log = message => console.error(message),
  now = new Date(),
  staleAfterMs = DEFAULT_STALE_MS,
  batchSize = DEFAULT_BATCH_SIZE,
} = {}) => {
  if (running) return { skipped: true, synced: 0, failed: 0, fresh: 0, deferred: 0 };
  running = true;
  let synced = 0;
  let failed = 0;
  let fresh = 0;
  let deferred = 0;
  let requested = 0;
  try {
    const releases = await findReleases();
    for (const release of releases) {
      if (!release.distribeatsReleaseId) continue;
      const lastSyncTime = release.lastSyncedAt ? new Date(release.lastSyncedAt).getTime() : 0;
      const isFresh = Number.isFinite(lastSyncTime) && lastSyncTime > 0 && now.getTime() - lastSyncTime < staleAfterMs;
      if (isFresh) {
        fresh += 1;
        continue;
      }
      if (requested >= batchSize) {
        deferred += 1;
        continue;
      }
      requested += 1;
      try {
        await syncRelease(release);
        emit(release);
        synced += 1;
      } catch (error) {
        failed += 1;
        log(`DistriBeats automatic sync warning for ${release._id}: ${error.message}`);
      }
    }
    return { skipped: false, synced, failed, fresh, deferred };
  } finally {
    running = false;
  }
};

const startDistributionSyncWorker = () => {
  if (workerTimer) return workerTimer;
  const configuredSweep = Number(process.env.DISTRIBEATS_SYNC_SWEEP_MS || DEFAULT_SWEEP_MS);
  const configuredStale = Number(process.env.DISTRIBEATS_SYNC_STALE_MS || DEFAULT_STALE_MS);
  const configuredBatch = Number.parseInt(process.env.DISTRIBEATS_SYNC_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10);
  const intervalMs = Math.max(5 * 60 * 1000, Number.isFinite(configuredSweep) ? configuredSweep : DEFAULT_SWEEP_MS);
  const staleAfterMs = Math.max(intervalMs, Number.isFinite(configuredStale) ? configuredStale : DEFAULT_STALE_MS);
  const batchSize = Math.min(500, Math.max(1, Number.isFinite(configuredBatch) ? configuredBatch : DEFAULT_BATCH_SIZE));
  const run = () => syncActiveReleases({ staleAfterMs, batchSize }).catch(error => console.error(`DistriBeats automatic sync worker warning: ${error.message}`));
  const initialTimer = setTimeout(run, Math.min(15000, intervalMs));
  initialTimer.unref();
  workerTimer = setInterval(run, intervalMs);
  workerTimer.unref();
  return workerTimer;
};

module.exports = {
  ACTIVE_STATUSES, DEFAULT_SWEEP_MS, DEFAULT_STALE_MS, DEFAULT_BATCH_SIZE,
  syncActiveReleases, startDistributionSyncWorker,
};
