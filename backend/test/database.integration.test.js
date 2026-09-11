const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const Artist = require('../models/Artist');
const Finance = require('../models/Finance');
const RoyaltyLedger = require('../models/RoyaltyLedger');
const Ownership = require('../models/Ownership');
const SongMetadata = require('../models/SongMetadata');
const File = require('../models/File');

const runId = `AUTOMATED_TEST_${crypto.randomUUID()}`;
const createdIds = { artists: [], finances: [], royalties: [], ownerships: [], metadata: [], files: [] };
const sourceTotal = (value) => ({ streaming: value, publishing: 0, mechanical: 0, performance: 0, sync: 0, merchandise: 0, other: 0 });
let testArtist;

test.before(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for integration tests');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.db.admin().ping();
  testArtist = await Artist.create({ legalName: `${runId} Legal`, artistName: `${runId} Artist`, email: `${runId.toLowerCase()}@example.test`, status: 'active' });
  createdIds.artists.push(testArtist._id);
});

test.after(async () => {
  await Promise.all([
    Artist.deleteMany({ _id: { $in: createdIds.artists } }),
    Finance.deleteMany({ _id: { $in: createdIds.finances } }),
    RoyaltyLedger.deleteMany({ _id: { $in: createdIds.royalties } }),
    Ownership.deleteMany({ _id: { $in: createdIds.ownerships } }),
    SongMetadata.deleteMany({ _id: { $in: createdIds.metadata } }),
    File.deleteMany({ _id: { $in: createdIds.files } }),
  ]);
  await mongoose.disconnect();
});

test('MongoDB artist CRUD persists and updates an isolated test artist', async () => {
  assert.equal(testArtist.name, `${runId} Legal`);
  assert.equal(testArtist.stageName, `${runId} Artist`);
  const updated = await Artist.findByIdAndUpdate(testArtist._id, { genre: 'Hip Hop' }, { returnDocument: 'after' });
  assert.equal(updated.genre, 'Hip Hop');
});

test('MongoDB finance records derive accounting period fields and reject invalid amounts', async () => {
  const finance = await Finance.create({ type: 'income', category: 'streaming_revenue', amount: 125.5, artist: testArtist._id, description: runId, date: new Date('2026-07-15') });
  createdIds.finances.push(finance._id);
  assert.equal(finance.month, 7);
  assert.equal(finance.quarter, 3);
  await assert.rejects(Finance.create({ type: 'expense', category: 'marketing_advertising', amount: 0, description: runId }), /greater than zero/);
});

test('MongoDB royalty ledger persists validated accounting data', async () => {
  const royalty = await RoyaltyLedger.create({
    artist: testArtist._id, period: runId, periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31'),
    grossIncome: 200, incomeBySource: sourceTotal(200), artistPercentage: 60, labelPercentage: 40,
  });
  createdIds.royalties.push(royalty._id);
  assert.equal(royalty.period, runId);
  await assert.rejects(RoyaltyLedger.create({
    artist: testArtist._id, period: `${runId}_bad`, periodStart: new Date('2026-07-31'), periodEnd: new Date('2026-07-01'),
    grossIncome: 200, incomeBySource: sourceTotal(100), artistPercentage: 70, labelPercentage: 20,
  }));
});

test('MongoDB stores document relationships without requiring physical file access', async () => {
  const royalty = await RoyaltyLedger.create({
    artist: testArtist._id, period: `${runId}_file`, periodStart: new Date('2026-08-01'), periodEnd: new Date('2026-08-31'),
    grossIncome: 100, incomeBySource: sourceTotal(100), artistPercentage: 60, labelPercentage: 40,
  });
  createdIds.royalties.push(royalty._id);
  const file = await File.create({
    name: `${runId}.pdf`, originalName: `${runId}.pdf`, path: `/uploads/files/${runId}.pdf`,
    artistId: testArtist._id, royaltyId: royalty._id, category: 'legal',
  });
  createdIds.files.push(file._id);
  const loaded = await File.findById(file._id).populate('artistId', 'artistName');
  assert.equal(loaded.artistId.artistName, `${runId} Artist`);
  assert.equal(String(loaded.royaltyId), String(royalty._id));
});
