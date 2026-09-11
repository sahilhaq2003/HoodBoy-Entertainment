const test = require('node:test');
const assert = require('node:assert/strict');

const { checkPermission } = require('../middleware/rbac');
const { ROLE_ACCESS } = require('../middleware/rbac');
const upload = require('../middleware/fileManagerUpload');
const RoyaltyLedger = require('../models/RoyaltyLedger');
const { _calculateEntry } = require('../controllers/royaltyController');
const File = require('../models/File');
const Ownership = require('../models/Ownership');
const SongMetadata = require('../models/SongMetadata');
const Task = require('../models/Task');
const { validateOwnershipRecord } = require('../services/ownershipValidationService');
const { errorHandler } = require('../middleware/errorHandler');

const validSources = (amount) => ({
  streaming: amount, publishing: 0, mechanical: 0, performance: 0,
  sync: 0, merchandise: 0, other: 0,
});

const callPermission = (role, action) => new Promise((resolve) => {
  const middleware = checkPermission('artists', action);
  const req = { user: { role } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ next: false, status: this.statusCode, body }); } };
  middleware(req, res, () => resolve({ next: true, status: 200 }));
});

test('RBAC maps CRUD route actions to the configured write permission', async () => {
  for (const action of ['create', 'update', 'delete']) {
    const result = await callPermission('manager', action);
    assert.equal(result.next, true, `manager should be able to ${action} artists`);
  }
  const denied = await callPermission('artist', 'create');
  assert.equal(denied.next, false);
  assert.equal(denied.status, 403);
});

test('RBAC enforces every configured resource permission for each role', async () => {
  for (const [role, resources] of Object.entries(ROLE_ACCESS)) {
    for (const [resource, access] of Object.entries(resources)) {
      if (access === true || typeof access !== 'object') continue;
      for (const action of ['read', 'write']) {
        const middleware = checkPermission(resource, action);
        const result = await new Promise((resolve) => {
          const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ allowed: false, status: this.statusCode, body }); } };
          middleware({ user: { role } }, res, () => resolve({ allowed: true, status: 200 }));
        });
        assert.equal(result.allowed, Boolean(access[action]), `${role}:${resource}:${action}`);
      }
    }
  }
});

test('task participants have read-only module access while managers retain full control', () => {
  for (const role of ['artist', 'finance', 'marketing']) {
    assert.equal(ROLE_ACCESS[role].tasks.read, true);
    assert.equal(ROLE_ACCESS[role].tasks.write, false);
  }
  assert.equal(ROLE_ACCESS.manager.tasks.write, true);
  assert.equal(ROLE_ACCESS.admin.tasks.write, true);
});

test('task collaboration stores messages and auditable activity', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const task = new Task({
    title: 'Review campaign assets', deadline: new Date('2026-09-30'), assignedTo: userId,
    comments: [{ author: userId, message: 'The first draft is ready for review.' }],
    activity: [{ actor: userId, action: 'commented', message: 'Added a message' }],
  });
  await task.validate();
  assert.equal(task.comments[0].message, 'The first draft is ready for review.');
  assert.equal(task.activity[0].action, 'commented');

  task.comments.push({ author: userId, message: 'x'.repeat(2001) });
  await assert.rejects(task.validate(), /longer than the maximum allowed length/);
});

const runFileFilter = (originalname, mimetype) => new Promise((resolve) => {
  upload.fileFilter({}, { fieldname: 'file', originalname, mimetype }, (error, accepted) => resolve({ error, accepted }));
});

test('managed file upload allowlist accepts required formats and rejects dangerous or mismatched files', async () => {
  const pdf = await runFileFilter('statement.pdf', 'application/pdf');
  assert.equal(pdf.error, null);
  assert.equal(pdf.accepted, true);
  const executable = await runFileFilter('malware.exe', 'application/x-msdownload');
  assert.ok(executable.error);
  const mismatch = await runFileFilter('document.pdf', 'application/javascript');
  assert.ok(mismatch.error);
  assert.ok(upload.maxFileSize <= 500 * 1024 * 1024);
});

test('royalty validation requires a valid period, 100% label split, and reconciled income sources', async () => {
  const invalid = new RoyaltyLedger({
    artist: '507f1f77bcf86cd799439011', period: '2026-01',
    periodStart: new Date('2026-01-31'), periodEnd: new Date('2026-01-01'),
    grossIncome: 100, incomeBySource: validSources(90), artistPercentage: 60, labelPercentage: 30,
  });
  let errors;
  try { await invalid.validate(); } catch (error) { errors = error.errors; }
  assert.ok(errors, 'validation should fail');
  assert.ok(errors.periodEnd);
  assert.ok(errors.labelPercentage);
  assert.ok(errors.grossIncome);
});

test('royalty calculation deducts fees, participant royalties, and recoupment before artist payment', () => {
  const entry = new RoyaltyLedger({
    artist: '507f1f77bcf86cd799439011', period: '2026-01',
    periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    grossIncome: 1000, incomeBySource: validSources(1000), distributorFees: 100,
    approvedDeductions: [{ description: 'Approved artwork', amount: 50, category: 'recoupable' }],
    recoupableExpenses: 100, artistPercentage: 60, labelPercentage: 40,
    producerPercentage: 5, featuredArtistPercentage: 5,
    paymentsIssued: [{ amount: 100, date: new Date(), method: 'bank' }],
  });
  _calculateEntry(entry);
  assert.equal(entry.totalDeductions, 150);
  assert.equal(entry.netIncome, 850);
  assert.equal(entry.artistGrossShare, 510);
  assert.equal(entry.producerRoyalty, 42.5);
  assert.equal(entry.featuredArtistRoyalty, 42.5);
  assert.equal(entry.recoupedThisPeriod, 100);
  assert.equal(entry.artistShare, 325);
  assert.equal(entry.totalPaid, 100);
  assert.equal(entry.remainingBalance, 225);
  assert.equal(entry.remainingRecoupable, 0);
});

test('participant royalties cannot exceed the artist percentage', async () => {
  const entry = new RoyaltyLedger({
    artist: '507f1f77bcf86cd799439011', period: '2026-01',
    periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'),
    grossIncome: 100, incomeBySource: validSources(100), artistPercentage: 20, labelPercentage: 80,
    producerPercentage: 15, featuredArtistPercentage: 10,
  });
  let errors;
  try { await entry.validate(); } catch (error) { errors = error.errors; }
  assert.ok(errors?.producerPercentage);
});

test('file records support all required business-record links', async () => {
  const file = new File({
    name: 'statement.pdf', originalName: 'statement.pdf', path: '/uploads/files/Accounting/statement.pdf',
    artistId: '507f1f77bcf86cd799439011', releaseId: '507f1f77bcf86cd799439012',
    contractId: '507f1f77bcf86cd799439013', financeId: '507f1f77bcf86cd799439014',
    royaltyId: '507f1f77bcf86cd799439015', campaignId: '507f1f77bcf86cd799439016',
    contactId: '507f1f77bcf86cd799439017', projectId: '507f1f77bcf86cd799439018',
  });
  await file.validate();
  assert.ok(file.releaseId);
  assert.ok(file.royaltyId);
});

test('ownership readiness blocks incomplete splits and unsigned required parties', () => {
  const ownership = new Ownership({
    songId: '507f1f77bcf86cd799439011', masterOwner: 'Label',
    writers: [{ name: 'Writer', percentage: 80 }], producer: 'Producer', producerPercentage: 20,
    beatLicense: { type: 'work_for_hire', producer: 'Producer', terms: 'Signed terms', documentUrl: '/license.pdf' },
    signatures: [{ partyName: 'Label', role: 'master_owner', status: 'signed', signedAt: new Date(), documentUrl: '/label.pdf' }],
  });
  const result = validateOwnershipRecord(ownership);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('Writer signature is required')));
  assert.ok(result.errors.some((message) => message.includes('Producer signature is required')));
  assert.equal(ownership.totalPercentage, 100);
  assert.equal(ownership.isReadyForRelease, false);
});

test('metadata validation requires valid identifiers, credits, and complete publishing splits', () => {
  const metadata = new SongMetadata({
    songId: '507f1f77bcf86cd799439011', artist: '507f1f77bcf86cd799439012', title: 'Test Song',
    isrc: 'bad', upc: '123', bpm: 0, credits: [{ name: 'Writer', role: 'songwriter', percentage: 50 }],
    publishers: [{ name: 'Publisher', percentage: 50 }], contactInformation: { email: 'invalid' },
  });
  const result = metadata.validateMetadata();
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('ISRC')));
  assert.ok(result.errors.some((message) => message.includes('UPC')));
  assert.ok(result.errors.some((message) => message.includes('At least one producer')));
  assert.ok(result.errors.some((message) => message.includes('Writer percentages')));
  assert.equal(metadata.validationStatus, 'incomplete');
});

test('API error handler returns safe client errors for oversized and rejected uploads', () => {
  const invoke = (error) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    errorHandler(error, {}, response, () => {});
    return response;
  };
  const tooLarge = invoke({ code: 'LIMIT_FILE_SIZE', message: 'File too large' });
  assert.equal(tooLarge.statusCode, 413);
  const rejected = invoke({ code: 'LIMIT_UNEXPECTED_FILE', message: 'Unsupported or mismatched file type: .exe' });
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.body.message, /mismatched/);
});
