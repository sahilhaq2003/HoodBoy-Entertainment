const test = require('node:test');
const assert = require('node:assert/strict');

const { syncActiveReleases } = require('../services/distributionSyncWorker');

test('automatic distribution sync updates provider releases and skips local drafts', async () => {
  const releases = [
    { _id: 'local_1', distribeatsReleaseId: 'api_1', status: 'processing' },
    { _id: 'local_draft', status: 'draft' },
  ];
  const synced = [];
  const emitted = [];
  const result = await syncActiveReleases({
    findReleases: async () => releases,
    syncRelease: async release => { synced.push(release._id); release.status = 'approved'; },
    emit: release => emitted.push(release._id),
  });

  assert.deepEqual(synced, ['local_1']);
  assert.deepEqual(emitted, ['local_1']);
  assert.deepEqual(result, { skipped: false, synced: 1, failed: 0, fresh: 0, deferred: 0 });
});

test('automatic distribution sync continues when one provider release fails', async () => {
  const releases = [
    { _id: 'bad', distribeatsReleaseId: 'api_bad' },
    { _id: 'good', distribeatsReleaseId: 'api_good' },
  ];
  const emitted = [];
  const warnings = [];
  const result = await syncActiveReleases({
    findReleases: async () => releases,
    syncRelease: async release => { if (release._id === 'bad') throw new Error('provider unavailable'); },
    emit: release => emitted.push(release._id),
    log: message => warnings.push(message),
  });

  assert.deepEqual(emitted, ['good']);
  assert.equal(warnings.length, 1);
  assert.deepEqual(result, { skipped: false, synced: 1, failed: 1, fresh: 0, deferred: 0 });
});

test('webhook-fresh releases are not polled until they become stale', async () => {
  const now = new Date('2026-11-13T12:00:00.000Z');
  const releases = [
    { _id: 'fresh', distribeatsReleaseId: 'api_fresh', lastSyncedAt: new Date('2026-11-13T11:45:00.000Z') },
    { _id: 'stale', distribeatsReleaseId: 'api_stale', lastSyncedAt: new Date('2026-11-13T11:29:59.000Z') },
  ];
  const synced = [];
  const result = await syncActiveReleases({
    findReleases: async () => releases,
    syncRelease: async release => synced.push(release._id),
    now,
    staleAfterMs: 30 * 60 * 1000,
  });

  assert.deepEqual(synced, ['stale']);
  assert.deepEqual(result, { skipped: false, synced: 1, failed: 0, fresh: 1, deferred: 0 });
});

test('fallback sync caps API traffic and defers overflow to later sweeps', async () => {
  const releases = Array.from({ length: 5 }, (_, index) => ({ _id: `local_${index}`, distribeatsReleaseId: `api_${index}` }));
  const synced = [];
  const result = await syncActiveReleases({
    findReleases: async () => releases,
    syncRelease: async release => synced.push(release._id),
    batchSize: 2,
  });

  assert.deepEqual(synced, ['local_0', 'local_1']);
  assert.deepEqual(result, { skipped: false, synced: 2, failed: 0, fresh: 0, deferred: 3 });
});
