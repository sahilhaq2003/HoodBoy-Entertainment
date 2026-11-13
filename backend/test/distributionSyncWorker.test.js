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
  assert.deepEqual(result, { skipped: false, synced: 1, failed: 0 });
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
  assert.deepEqual(result, { skipped: false, synced: 1, failed: 1 });
});
