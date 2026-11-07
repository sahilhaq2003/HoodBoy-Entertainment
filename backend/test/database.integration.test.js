const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const orm = require('../lib/mysql-orm');
const connectDB = require('../config/db');

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const Artist = require('../models/Artist');
const Finance = require('../models/Finance');
const RoyaltyLedger = require('../models/RoyaltyLedger');
const Ownership = require('../models/Ownership');
const SongMetadata = require('../models/SongMetadata');
const File = require('../models/File');
const EmailNotification = require('../models/EmailNotification');
const EmailSettings = require('../models/EmailSettings');
const emailService = require('../services/emailService');
const { LinkupEvent, LinkupSeating, LinkupBankAccount, LinkupPackage, LinkupBooking, LinkupFoodVendor, LinkupFoodItem } = require('../models/LinkupPlatform');
const { _priceBooking, _preparePackageCheckout } = require('../controllers/linkupPlatformController');

const runId = `AUTOMATED_TEST_${crypto.randomUUID()}`;
const createdIds = { artists: [], finances: [], royalties: [], ownerships: [], metadata: [], files: [], linkupEvents: [], linkupSeating: [], linkupBanks: [], linkupPackages: [], linkupVendors: [], linkupFood: [] };
const sourceTotal = (value) => ({ streaming: value, publishing: 0, mechanical: 0, performance: 0, sync: 0, merchandise: 0, other: 0 });
let testArtist;
let originalEmailSettings;
let originalEmailEnvironment;
const hasDb = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].every(key => process.env[key]);
const dbtest = hasDb ? test : test.skip;

test.before(async () => {
  if (!hasDb) return;
  await connectDB();
  originalEmailEnvironment = process.env.EMAIL_NOTIFICATIONS_ENABLED;
  const currentEmailSettings = await EmailSettings.findOne({ key: 'global' });
  originalEmailSettings = currentEmailSettings?.toObject() || null;
  testArtist = await Artist.create({ legalName: `${runId} Legal`, artistName: `${runId} Artist`, email: `${runId.toLowerCase()}@example.test`, status: 'active' });
  createdIds.artists.push(testArtist._id);
});

test.after(async () => {
  if (!hasDb) return;
  await Promise.all([
    Artist.deleteMany({ _id: { $in: createdIds.artists } }),
    Finance.deleteMany({ _id: { $in: createdIds.finances } }),
    RoyaltyLedger.deleteMany({ _id: { $in: createdIds.royalties } }),
    Ownership.deleteMany({ _id: { $in: createdIds.ownerships } }),
    SongMetadata.deleteMany({ _id: { $in: createdIds.metadata } }),
    File.deleteMany({ _id: { $in: createdIds.files } }),
    LinkupPackage.deleteMany({ _id: { $in: createdIds.linkupPackages } }),
    LinkupFoodItem.deleteMany({ _id: { $in: createdIds.linkupFood } }),
    LinkupFoodVendor.deleteMany({ _id: { $in: createdIds.linkupVendors } }),
  ]);
  await Promise.all([
    LinkupSeating.deleteMany({ _id: { $in: createdIds.linkupSeating } }),
    LinkupBankAccount.deleteMany({ _id: { $in: createdIds.linkupBanks } }),
    LinkupEvent.deleteMany({ _id: { $in: createdIds.linkupEvents } }),
    EmailNotification.deleteMany({ relatedEntityId: runId }),
  ]);
  process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailEnvironment;
  if (originalEmailSettings) {
    const settings = await EmailSettings.findOne({ key: 'global' });
    Object.assign(settings, originalEmailSettings);
    await settings.save();
  } else await EmailSettings.deleteMany({ key: 'global' });
  await orm.disconnect();
});

dbtest('MySQL artist CRUD persists and updates an isolated test artist', async () => {
  assert.equal(testArtist.name, `${runId} Legal`);
  assert.equal(testArtist.stageName, `${runId} Artist`);
  const updated = await Artist.findByIdAndUpdate(testArtist._id, { genre: 'Hip Hop' }, { returnDocument: 'after' });
  assert.equal(updated.genre, 'Hip Hop');
});

dbtest('MySQL finance records derive accounting period fields and reject invalid amounts', async () => {
  const finance = await Finance.create({ type: 'income', category: 'streaming_revenue', amount: 125.5, artist: testArtist._id, description: runId, date: new Date('2026-07-15') });
  createdIds.finances.push(finance._id);
  assert.equal(finance.month, 7);
  assert.equal(finance.quarter, 3);
  await assert.rejects(Finance.create({ type: 'expense', category: 'marketing_advertising', amount: 0, description: runId }), /greater than zero/);
});

dbtest('MySQL royalty ledger persists validated accounting data', async () => {
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

dbtest('MySQL stores relational links without requiring physical file access', async () => {
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

dbtest('Linkup package pricing is server-derived and package bank accounts persist relationally', async () => {
  const event = await LinkupEvent.create({ title: `${runId} Live`, eventDate: new Date('2027-01-20'), location: 'Test Venue', status: 'published', ageRestricted: true });
  createdIds.linkupEvents.push(event._id);
  const seating = await LinkupSeating.create({ event: event._id, name: 'Four Guest Table', seatingType: 'table', capacity: 4, price: 125, totalQuantity: 5, availableQuantity: 5 });
  createdIds.linkupSeating.push(seating._id);
  const bank = await LinkupBankAccount.create({ bankName: 'Test Bank', accountHolderName: runId, accountNumber: 'TEST-001', currency: 'USD' });
  createdIds.linkupBanks.push(bank._id);
  await LinkupBankAccount._ready();
  const storedBank = await LinkupBankAccount._sql.findByPk(String(bank._id), { raw: true });
  assert.match(storedBank.accountNumber, /^enc:/, 'bank account number must be encrypted at rest');
  const vendor = await LinkupFoodVendor.create({ name: `${runId} Catering`, events: [event._id] });
  createdIds.linkupVendors.push(vendor._id);
  const meal = await LinkupFoodItem.create({ vendor: vendor._id, events: [event._id], category: 'Chicken', name: 'Chicken Meal', price: 20, availableQuantity: 20 });
  createdIds.linkupFood.push(meal._id);
  const pkg = await LinkupPackage.create({ event: event._id, name: `${runId} Custom Table`, packageType: 'customizable', seating: seating._id, basePrice: 125, totalQuantity: 5, availableQuantity: 5, status: 'published', bankTransferEnabled: true, bankAccounts: ['', bank._id, ''], taxRate: 10, serviceFeeRate: 5, currency: 'USD' });
  createdIds.linkupPackages.push(pkg._id);

  const reloaded = await LinkupPackage.findById(pkg._id).populate('bankAccounts', 'bankName currency');
  assert.equal(reloaded.bankAccounts.length, 1);
  assert.equal(reloaded.bankAccounts[0].bankName, 'Test Bank');
  const bookingsBeforePayment = await LinkupBooking.countDocuments({ package: pkg._id });
  const prepared = await _preparePackageCheckout({ _id: '000000000000000000000001', role: 'customer' }, pkg._id, { phone: '555-0100', guestCount: 1, foodItems: [{ itemId: meal._id, quantity: 1 }] });
  assert.equal(prepared.quote.totalAmount, 166.75);
  assert.equal(await LinkupBooking.countDocuments({ package: pkg._id }), bookingsBeforePayment, 'preparing payment must not create a booking');
  assert.equal((await LinkupPackage.findById(pkg._id)).availableQuantity, 5, 'preparing payment must not deduct inventory');
  const quote = await _priceBooking(pkg, { foodItems: [{ itemId: meal._id, quantity: 2 }] });
  assert.equal(quote.subtotal, 165);
  assert.equal(quote.taxAmount, 16.5);
  assert.equal(quote.serviceFeeAmount, 8.25);
  assert.equal(quote.totalAmount, 189.75);
});

dbtest('email queue is idempotent and records SMTP acceptance without sending real email', async () => {
  process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
  process.env.SMTP_HOST ||= 'smtp.test.invalid';
  process.env.SMTP_USER ||= 'test@example.test';
  process.env.SMTP_PASSWORD ||= 'not-a-real-password';
  let settings = await EmailSettings.findOne({ key: 'global' });
  if (!settings) settings = new EmailSettings({ key: 'global' });
  settings.enabled = true;
  settings.bookingNotifications = true;
  settings.adminRecipients = ['admin@example.test'];
  await settings.save();
  let sendCount = 0;
  emailService._setTransporterForTest({
    verify: async () => true,
    sendMail: async () => { sendCount += 1; return { messageId: `mock-${runId}` }; },
  });
  const input = { recipientEmail: 'customer@example.test', notificationType: 'booking_created', templateName: 'booking_created', templateData: { customerName: 'Customer', bookingReference: runId }, relatedEntityType: 'booking', relatedEntityId: runId, dedupeKey: `email-test:${runId}`, category: 'booking' };
  const first = await emailService.queueEmail(input);
  const duplicate = await emailService.queueEmail(input);
  assert.equal(String(first._id), String(duplicate._id));
  await emailService.processQueue(5);
  let sent = await EmailNotification.findById(first._id);
  for (let attempt = 0; sent.deliveryStatus !== 'sent' && attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 20));
    sent = await EmailNotification.findById(first._id);
  }
  assert.equal(sent.deliveryStatus, 'sent');
  assert.equal(sendCount, 1);
  assert.match(sent.providerMessageId, /^mock-/);
});
