/**
 * Demo data seeder for the Record Label Management System.
 *
 * Populates every module with realistic sample records so the whole app can be
 * reviewed end-to-end. Every inserted document's _id is recorded in the
 * `_demomarkers` collection so `clearDemo.js` can remove all demo data safely.
 *
 * Run:  node scripts/seedDemo.js   (from the backend directory)
 *
 * Demo logins use the password supplied through DEMO_PASSWORD.
 *   demo.admin@hbe.local      (admin)
 *   demo.manager@hbe.local    (manager)
 *   demo.finance@hbe.local    (finance)
 *   demo.marketing@hbe.local  (marketing)
 *   demo.kalo@hbe.local       (artist login for Kalo)
 *   demo.jae@hbe.local        (artist login for JaeDayo)
 *   demo.lyrica@hbe.local     (artist login for Lyrica)
 *   demo.onaje@hbe.local      (artist login for Onaje)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const User = require('../models/User');
const Artist = require('../models/Artist');
const Song = require('../models/Song');
const Release = require('../models/Release');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Finance = require('../models/Finance');
const Budget = require('../models/Budget');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const RoyaltyLedger = require('../models/RoyaltyLedger');
const ArtistBalance = require('../models/ArtistBalance');
const TaxCalendar = require('../models/TaxCalendar');
const Ownership = require('../models/Ownership');
const SongMetadata = require('../models/SongMetadata');
const PerSongAnalytics = require('../models/PerSongAnalytics');
const ArtistDevelopment = require('../models/ArtistDevelopment');
const WeeklyReport = require('../models/WeeklyReport');
const File = require('../models/File');
const Folder = require('../models/Folder');
const FileVersion = require('../models/FileVersion');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const LnkUp = require('../models/LnkUp');

const PASS = process.env.DEMO_PASSWORD;
const ids = {};
const track = (modelName, result) => {
  const arr = Array.isArray(result) ? result : [result];
  if (!ids[modelName]) ids[modelName] = [];
  for (const d of arr) if (d && d._id) ids[modelName].push(d._id);
};

const daysFromNow = (n) => new Date(Date.now() + n * 86400000);
const iso = (n) => daysFromNow(n).toISOString().slice(0, 10);

const makePdf = (label) => {
  const stream = `BT /F1 18 Tf 72 720 Td (${label.replace(/[()\\]/g, '\\$&')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
};

const makeSilentWav = () => {
  const sampleRate = 8000;
  const samples = sampleRate;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
};

const ensureDemoAssets = () => {
  const uploads = path.resolve(__dirname, '..', 'uploads');
  const legacy = path.join(uploads, 'demo');
  const managed = {
    masters: path.join(uploads, 'files', 'Demo Masters'),
    contracts: path.join(uploads, 'files', 'Demo Contracts'),
    artwork: path.join(uploads, 'files', 'Demo Artwork'),
  };
  [legacy, ...Object.values(managed)].forEach(directory => fs.mkdirSync(directory, { recursive: true }));
  const pdfFiles = ['kalo-agreement.pdf', 'kalo-w9.pdf', 'beat-license-nodays.pdf', 'invoice-1001.pdf'];
  pdfFiles.forEach(name => fs.writeFileSync(path.join(legacy, name), makePdf(`HoodBoy demo document: ${name}`)));
  ['kalo-agreement.pdf', 'invoice-1001.pdf'].forEach(name => fs.writeFileSync(path.join(managed.contracts, name), makePdf(`HoodBoy demo document: ${name}`)));
  const wav = makeSilentWav();
  ['no-days-off-explicit.wav', 'no-days-off-clean.wav', 'pressure-ref.wav', 'gbedu.wav', 'circles.wav'].forEach(name => fs.writeFileSync(path.join(legacy, name), wav));
  ['no-days-off-mix1.wav', 'no-days-off-explicit.wav', 'pressure-ref.wav', 'gbedu.wav'].forEach(name => fs.writeFileSync(path.join(managed.masters, name), wav));
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=', 'base64');
  ['no-days-off-art.jpg', 'state-of-mind-art.jpg', 'belly-room-art.jpg', 'runner-art.jpg', 'daydream-art.jpg'].forEach(name => fs.writeFileSync(path.join(legacy, name), jpeg));
  fs.writeFileSync(path.join(managed.artwork, 'no-days-off-art.jpg'), jpeg);
  const csv = 'title,artist,isrc,status\nNo Days Off,Kalo,US-HBE-26-00001,released\n';
  fs.writeFileSync(path.join(legacy, 'no-days-off.csv'), csv);
  fs.writeFileSync(path.join(managed.masters, 'no-days-off.csv'), csv);
};

async function createAll(Model, docs) {
  const out = [];
  for (const d of docs) {
    const doc = await Model.create(d);
    track(Model.modelName, doc);
    out.push(doc);
  }
  return out;
}

async function clearExistingDemo() {
  const markers = await mongoose.connection.collection('_demomarkers').find({}).toArray();
  if (!markers.length) return;
  for (const m of markers) {
    const Model = mongoose.models[m.model];
    if (!Model || !Array.isArray(m.ids) || !m.ids.length) continue;
    const res = await Model.deleteMany({ _id: { $in: m.ids } });
    console.log(`  cleaned ${m.model}: ${res.deletedCount} removed`);
  }
  await mongoose.connection.collection('_demomarkers').deleteMany({});
  console.log('Existing demo data removed.\n');
}

async function saveMarkers() {
  const col = mongoose.connection.collection('_demomarkers');
  for (const [model, docIds] of Object.entries(ids)) {
    await col.updateOne(
      { model },
      { $set: { ids: docIds } },
      { upsert: true }
    );
  }
}

async function seed() {
  ensureDemoAssets();
  const admin = await User.create({ name: 'Demo Admin', email: 'demo.admin@hbe.local', password: PASS, role: 'admin', department: 'executive', phone: '+1 (555) 000-0001' });
  const manager = await User.create({ name: 'Demo Manager', email: 'demo.manager@hbe.local', password: PASS, role: 'manager', department: 'operations', phone: '+1 (555) 000-0002' });
  const finUser = await User.create({ name: 'Demo Finance', email: 'demo.finance@hbe.local', password: PASS, role: 'finance', department: 'finance', phone: '+1 (555) 000-0003' });
  const mktUser = await User.create({ name: 'Demo Marketing', email: 'demo.marketing@hbe.local', password: PASS, role: 'marketing', department: 'marketing', phone: '+1 (555) 000-0004' });
  const aRUser = await User.create({ name: 'Demo A&R', email: 'demo.ar@hbe.local', password: PASS, role: 'manager', department: 'a_and_r', phone: '+1 (555) 000-0005' });
  track('User', [admin, manager, finUser, mktUser, aRUser]);

  // ---- Artists ----------------------------------------------------------
  const kalo = await Artist.create({
    legalName: 'Kalin Ogwulu', artistName: 'Kalo', name: 'Kalin Ogwulu', stageName: 'Kalo',
    email: 'demo.kalo@hbe.local', phone: '+1 (555) 111-0001', dateOfBirth: new Date('1998-03-14'),
    address: { street: '4120 Echo Park Ave', city: 'Los Angeles', state: 'CA', zipCode: '90026', country: 'USA' },
    emergencyContact: { name: 'Maya Ogwulu', relationship: 'Sister', phone: '+1 (555) 111-9999', email: 'maya@example.com' },
    bio: 'West Coast hip-hop artist signed to HoodBoy Entertainment. Known for sharp wordplay and late-night garage productions.',
    socialLinks: { instagram: 'https://instagram.com/kalo', tiktok: 'https://tiktok.com/@kalo', youtube: 'https://youtube.com/@kalo', spotify: 'https://open.spotify.com/artist/kalo', twitter: 'https://x.com/kalo' },
    genre: 'Hip-Hop', proAffiliation: 'ASCAP',
    publisher: { name: 'HoodBoy Publishing', contact: 'demo.finance@hbe.local' },
    paymentInfo: { method: 'Bank Transfer', bankName: 'Chase', accountNumber: '****4412', routingNumber: '****0021', paypalEmail: 'payments.kalo@example.com' },
    taxInfo: { taxId: '***-**-1234', taxFormType: 'W-9', filingStatus: 'Single' },
    status: 'active', onboardingStatus: 'approved', onboardingStep: 4, approvedAt: daysFromNow(-220),
    contractStart: new Date('2024-01-01'), contractEnd: new Date('2026-12-31'), manager: admin._id,
    royaltyRate: 50, totalStreams: 1842000, totalRevenue: 35600, musicLinks: ['https://open.spotify.com/artist/kalo'],
    documents: [
      { name: 'Artist Agreement', type: 'artist_agreement', fileUrl: '/uploads/demo/kalo-agreement.pdf', fileName: 'kalo-agreement.pdf', status: 'approved' },
      { name: 'Tax Form W-9', type: 'tax_form', fileUrl: '/uploads/demo/kalo-w9.pdf', fileName: 'kalo-w9.pdf', status: 'approved' },
    ],
  });

  const jae = await Artist.create({
    legalName: 'Daniel Okafor', artistName: 'JaeDayo', name: 'Daniel Okafor', stageName: 'JaeDayo',
    email: 'demo.jae@hbe.local', phone: '+1 (555) 222-0002', dateOfBirth: new Date('1996-08-22'),
    address: { street: '88 Marcy Gardens', city: 'Brooklyn', state: 'NY', zipCode: '11211', country: 'USA' },
    bio: 'Afrobeats and highlife singer bridging Lagos and New York.',
    socialLinks: { instagram: 'https://instagram.com/jaedayo', spotify: 'https://open.spotify.com/artist/jaedayo' },
    genre: 'Afrobeats', proAffiliation: 'BMI',
    paymentInfo: { method: 'PayPal', paypalEmail: 'payments.jae@example.com' },
    status: 'active', onboardingStatus: 'approved', onboardingStep: 4, approvedAt: daysFromNow(-350),
    contractStart: new Date('2023-05-01'), contractEnd: new Date('2026-04-30'), manager: manager._id,
    royaltyRate: 45, totalStreams: 2210000, totalRevenue: 29800,
  });

  const lyrica = await Artist.create({
    legalName: 'Alicia Brooks', artistName: 'Lyrica', name: 'Alicia Brooks', stageName: 'Lyrica',
    email: 'demo.lyrica@hbe.local', phone: '+1 (555) 333-0003', dateOfBirth: new Date('2001-01-09'),
    address: { street: '12 Peachtree St', city: 'Atlanta', state: 'GA', zipCode: '30303', country: 'USA' },
    bio: 'R&B and soul newcomer with a velvet tone and confessional songwriting.',
    socialLinks: { instagram: 'https://instagram.com/lyrica', youtube: 'https://youtube.com/@lyrica' },
    genre: 'R&B / Soul', proAffiliation: 'SESAC',
    paymentInfo: { method: 'Bank Transfer', bankName: 'Wells Fargo', accountNumber: '****7788', routingNumber: '****1199' },
    status: 'active', onboardingStatus: 'approved', onboardingStep: 4, approvedAt: daysFromNow(-60),
    contractStart: new Date('2026-01-01'), contractEnd: new Date('2028-12-31'), manager: aRUser._id,
    royaltyRate: 55, totalStreams: 456000, totalRevenue: 5200,
  });

  const onaje = await Artist.create({
    legalName: 'Onyeka Adeyemi', artistName: 'Onaje', name: 'Onyeka Adeyemi', stageName: 'Onaje',
    email: 'demo.onaje@hbe.local', phone: '+1 (555) 444-0004', dateOfBirth: new Date('1999-11-30'),
    address: { street: '4136 Austin Blvd', city: 'Houston', state: 'TX', zipCode: '77002', country: 'USA' },
    bio: 'Alternative R&B producer-artist. Tonal experiments and textured synths.',
    socialLinks: { instagram: 'https://instagram.com/onaje' },
    genre: 'Alternative R&B', proAffiliation: 'ASCAP',
    paymentInfo: { method: 'Bank Transfer', bankName: 'Bank of America', accountNumber: '****2210' },
    status: 'upcoming', onboardingStatus: 'in_progress', onboardingStep: 2,
    royaltyRate: 50, totalStreams: 0, totalRevenue: 0,
  });
  track('Artist', [kalo, jae, lyrica, onaje]);

  // Artist role logins (matching artist emails -> self-scoped dashboard)
  const kaloUser = await User.create({ name: 'Kalo', email: 'demo.kalo@hbe.local', password: PASS, role: 'artist', department: 'Artist' });
  const jaeUser = await User.create({ name: 'JaeDayo', email: 'demo.jae@hbe.local', password: PASS, role: 'artist', department: 'Artist' });
  const lyricaUser = await User.create({ name: 'Lyrica', email: 'demo.lyrica@hbe.local', password: PASS, role: 'artist', department: 'Artist' });
  const onajeUser = await User.create({ name: 'Onaje', email: 'demo.onaje@hbe.local', password: PASS, role: 'artist', department: 'Artist' });
  track('User', [kaloUser, jaeUser, lyricaUser, onajeUser]);

  // ---- Songs ------------------------------------------------------------
  const completedWf = Song.buildProductionWorkflow();
  completedWf.forEach((s) => { s.status = 'completed'; s.completedAt = daysFromNow(-30); s.completedBy = admin._id; });

  const s1 = await Song.create([{
    title: 'No Days Off', artist: kalo._id, album: 'Belly Room', genre: 'Hip-Hop', duration: 192,
    status: 'released', releaseDate: daysFromNow(-120), producedBy: 'Demo (Producer)', writtenBy: 'Kalo',
    isrc: 'US-HBE-26-00001', streams: 1240000, revenue: 8400, priority: 'high', assignedTo: manager._id,
    productionWorkflow: completedWf,
    versions: [
      { type: 'explicit_master', fileUrl: '/uploads/demo/no-days-off-explicit.wav', fileName: 'no-days-off-explicit.wav', format: 'wav', uploadedBy: admin._id },
      { type: 'clean_master', fileUrl: '/uploads/demo/no-days-off-clean.wav', fileName: 'no-days-off-clean.wav', format: 'wav', uploadedBy: admin._id },
    ],
    credits: [
      { name: 'Kalo', role: 'songwriter', percentage: 100 },
      { name: 'Demo (Producer)', role: 'producer', percentage: 50 },
      { name: 'Miles Carter', role: 'engineer', percentage: 0 },
      { name: 'Ada Obi', role: 'masterer', percentage: 0 },
    ],
    beatInfo: { producer: 'Demo (Producer)', beatPurchaseDate: daysFromNow(-150), licenseType: 'exclusive', ownershipVerified: true },
  }]);
  const [s1doc] = s1;

  const s2 = await Song.create([{
    title: 'Pressure', artist: kalo._id, album: 'Belly Room', genre: 'Hip-Hop', duration: 178,
    status: 'awaiting_approval', producedBy: 'Demo (Producer)', writtenBy: 'Kalo',
    isrc: 'US-HBE-26-00002', streams: 0, revenue: 0, priority: 'high', assignedTo: aRUser._id,
    productionWorkflow: completedWf,
    versions: [{ type: 'wav_high_quality', fileUrl: '/uploads/demo/pressure-ref.wav', fileName: 'pressure-ref.wav', format: 'wav', uploadedBy: admin._id, notes: 'Functional reference-audio demo fixture' }],
    credits: [
      { name: 'Kalo', role: 'songwriter', percentage: 100 },
      { name: 'Demo (Producer)', role: 'producer', percentage: 50 },
    ],
    beatInfo: { producer: 'Demo (Producer)', licenseType: 'exclusive', ownershipVerified: true },
  }]);
  const [s2doc] = s2;

  const s3 = await Song.create([{
    title: 'Back To Back', artist: kalo._id, genre: 'Hip-Hop', duration: 205,
    status: 'in_production', producedBy: 'Demo (Producer)', writtenBy: 'Kalo',
    isrc: 'US-HBE-26-00003', priority: 'medium', assignedTo: aRUser._id,
    credits: [
      { name: 'Kalo', role: 'songwriter', percentage: 100 },
      { name: 'Demo (Producer)', role: 'producer', percentage: 50 },
    ],
    beatInfo: { producer: 'Demo (Producer)', licenseType: 'lease', ownershipVerified: false },
  }]);
  const [s3doc] = s3;

  const s4 = await Song.create([{
    title: 'State of Mind', artist: kalo._id, genre: 'Hip-Hop', duration: 164,
    status: 'released', releaseDate: daysFromNow(-300), producedBy: 'Demo (Producer)', writtenBy: 'Kalo',
    isrc: 'US-HBE-25-00012', streams: 602000, revenue: 4200, priority: 'medium',
    credits: [
      { name: 'Kalo', role: 'songwriter', percentage: 100 },
      { name: 'Demo (Producer)', role: 'producer', percentage: 50 },
    ],
    beatInfo: { producer: 'Demo (Producer)', licenseType: 'exclusive', ownershipVerified: true },
  }]);
  const [s4doc] = s4;

  const s5 = await Song.create([{
    title: 'Gbedu', artist: jae._id, genre: 'Afrobeats', duration: 221,
    status: 'released', releaseDate: daysFromNow(-90), producedBy: 'Ian Tree', writtenBy: 'JaeDayo',
    isrc: 'US-HBE-26-00004', streams: 1390000, revenue: 9200, priority: 'high', assignedTo: mktUser._id,
    versions: [{ type: 'explicit_master', fileUrl: '/uploads/demo/gbedu.wav', fileName: 'gbedu.wav', format: 'wav', uploadedBy: admin._id }],
    credits: [
      { name: 'JaeDayo', role: 'songwriter', percentage: 100 },
      { name: 'Ian Tree', role: 'producer', percentage: 40 },
    ],
    beatInfo: { producer: 'Ian Tree', licenseType: 'exclusive', ownershipVerified: true },
  }]);
  const [s5doc] = s5;

  const s6 = await Song.create([{
    title: 'Slip Away', artist: jae._id, genre: 'Afrobeats', duration: 198,
    status: 'mixing', producedBy: 'Ian Tree', writtenBy: 'JaeDayo',
    isrc: 'US-HBE-26-00005', priority: 'medium', assignedTo: aRUser._id,
    credits: [
      { name: 'JaeDayo', role: 'songwriter', percentage: 100 },
      { name: 'Ian Tree', role: 'producer', percentage: 40 },
    ],
    beatInfo: { producer: 'Ian Tree', licenseType: 'exclusive', ownershipVerified: true },
  }]);
  const [s6doc] = s6;

  const s7 = await Song.create([{
    title: 'Circles', artist: lyrica._id, genre: 'R&B / Soul', duration: 214,
    status: 'released', releaseDate: daysFromNow(-45), producedBy: 'Neo Mae', writtenBy: 'Lyrica',
    isrc: 'US-HBE-26-00006', streams: 341000, revenue: 2900, priority: 'high', assignedTo: mktUser._id,
    versions: [{ type: 'explicit_master', fileUrl: '/uploads/demo/circles.wav', fileName: 'circles.wav', format: 'wav', uploadedBy: admin._id }],
    credits: [
      { name: 'Lyrica', role: 'songwriter', percentage: 100 },
      { name: 'Neo Mae', role: 'producer', percentage: 50 },
    ],
    beatInfo: { producer: 'Neo Mae', licenseType: 'exclusive', ownershipVerified: true },
  }]);
  const [s7doc] = s7;

  const s8 = await Song.create([{
    title: 'Golden', artist: lyrica._id, genre: 'R&B / Soul', duration: 187,
    status: 'awaiting_approval', producedBy: 'Neo Mae', writtenBy: 'Lyrica',
    isrc: 'US-HBE-26-00007', priority: 'medium', assignedTo: aRUser._id,
    credits: [
      { name: 'Lyrica', role: 'songwriter', percentage: 100 },
      { name: 'Neo Mae', role: 'producer', percentage: 50 },
    ],
    beatInfo: { producer: 'Neo Mae', licenseType: 'exclusive', ownershipVerified: true },
  }]);
  const [s8doc] = s8;

  const s9 = await Song.create([{
    title: 'Top Floor', artist: onaje._id, genre: 'Alternative R&B', duration: 233,
    status: 'mastering', producedBy: 'Keyson', writtenBy: 'Onaje',
    isrc: 'US-HBE-26-00008', priority: 'medium', assignedTo: aRUser._id,
    credits: [
      { name: 'Onaje', role: 'songwriter', percentage: 100 },
      { name: 'Keyson', role: 'producer', percentage: 40 },
    ],
    beatInfo: { producer: 'Keyson', licenseType: 'work_for_hire', ownershipVerified: true },
  }]);
  const [s9doc] = s9;

  const s10 = await Song.create([{
    title: 'Wavelength', artist: onaje._id, genre: 'Alternative R&B', duration: 246,
    status: 'demo', producedBy: 'Keyson', writtenBy: 'Onaje',
    isrc: 'US-HBE-26-00009', priority: 'low',
    credits: [
      { name: 'Onaje', role: 'songwriter', percentage: 100 },
      { name: 'Keyson', role: 'producer', percentage: 40 },
    ],
    beatInfo: { producer: 'Keyson', licenseType: 'lease', ownershipVerified: false },
  }]);
  const [s10doc] = s10;
  track('Song', [s1doc, s2doc, s3doc, s4doc, s5doc, s6doc, s7doc, s8doc, s9doc, s10doc]);

  // ---- Releases ---------------------------------------------------------
  const r1 = await Release.create([{
    title: 'No Days Off', artist: kalo._id, project: null, songs: [s1doc._id],
    releaseDate: daysFromNow(-120), type: 'single', status: 'released', currentPhase: 'post_release',
    phases: {
      preparation: { completed: true, startedAt: daysFromNow(-150), completedAt: daysFromNow(-130),
        checklist: [{ item: 'Master approved', status: 'completed', order: 1 }, { item: 'Artwork final', status: 'completed', order: 2 }] },
      distribution: { completed: true, startedAt: daysFromNow(-128), completedAt: daysFromNow(-118),
        checklist: [{ item: 'Deliver to distributor', status: 'completed', order: 1 }] },
      marketing: { completed: true, startedAt: daysFromNow(-125), completedAt: daysFromNow(-100),
        checklist: [{ item: 'Playlist pitching', status: 'completed', order: 1 }] },
      post_release: { completed: false, startedAt: daysFromNow(-118),
        checklist: [{ item: 'Report streams', status: 'in_progress', order: 1 }] },
    },
    ownershipConfirmed: true, masterApproved: true, artworkApproved: true, metadataComplete: true,
    platforms: [
      { name: 'Spotify', status: 'live', link: 'https://open.spotify.com/track/demos1', liveAt: daysFromNow(-120) },
      { name: 'Apple Music', status: 'live', link: 'https://music.apple.com/album/demos1', liveAt: daysFromNow(-120) },
      { name: 'YouTube Music', status: 'live', liveAt: daysFromNow(-119) },
    ],
    marketingBudget: 4000, coverArt: '/uploads/demo/no-days-off-art.jpg', upc: '0810011001234',
    assignedTo: mktUser._id, priority: 'high', notes: 'Flagship single. Exceeded 1M streams in 90 days.',
  }]);
  const [r1doc] = r1;

  const r2 = await Release.create([{
    title: 'State of Mind', artist: kalo._id, songs: [s4doc._id],
    releaseDate: daysFromNow(-300), type: 'single', status: 'released', currentPhase: 'post_release',
    ownershipConfirmed: true, masterApproved: true, artworkApproved: true, metadataComplete: true,
    platforms: [{ name: 'Spotify', status: 'live' }],
    coverArt: '/uploads/demo/state-of-mind-art.jpg', upc: '0810011001235',
    assignedTo: manager._id, priority: 'medium',
  }]);
  const [r2doc] = r2;

  const r3 = await Release.create([{
    title: 'Belly Room', artist: kalo._id, project: null, songs: [s2doc._id, s3doc._id],
    releaseDate: daysFromNow(28), type: 'ep', status: 'in_preparation', currentPhase: 'preparation',
    phases: {
      preparation: { completed: false, startedAt: daysFromNow(-14),
        checklist: [
          { item: 'Complete all masters', status: 'in_progress', order: 1, dueDate: daysFromNow(14) },
          { item: 'Finalize artwork', status: 'pending', order: 2, dueDate: daysFromNow(20) },
          { item: 'Confirm ownership splits', status: 'pending', order: 3, dueDate: daysFromNow(25) },
        ] },
    },
    ownershipConfirmed: false, masterApproved: false, artworkApproved: false, metadataComplete: false,
    marketingBudget: 6000, coverArt: '/uploads/demo/belly-room-art.jpg', upc: '0810011001236',
    assignedTo: mktUser._id, priority: 'high', notes: '5-track EP, 2 tracks remain in production.',
  }]);
  const [r3doc] = r3;

  const r4 = await Release.create([{
    title: 'Runner', artist: jae._id, songs: [s5doc._id],
    releaseDate: daysFromNow(-90), type: 'single', status: 'released', currentPhase: 'post_release',
    ownershipConfirmed: true, masterApproved: true, artworkApproved: true, metadataComplete: true,
    platforms: [{ name: 'Spotify', status: 'live' }, { name: 'Apple Music', status: 'live' }],
    marketingBudget: 2500, coverArt: '/uploads/demo/runner-art.jpg', upc: '0810011001237',
    assignedTo: mktUser._id, priority: 'high',
  }]);
  const [r4doc] = r4;

  const r5 = await Release.create([{
    title: 'Daydream', artist: lyrica._id, songs: [s7doc._id],
    releaseDate: daysFromNow(-45), type: 'single', status: 'released', currentPhase: 'marketing',
    ownershipConfirmed: true, masterApproved: true, artworkApproved: true, metadataComplete: true,
    platforms: [{ name: 'Spotify', status: 'live' }],
    marketingBudget: 1500, coverArt: '/uploads/demo/daydream-art.jpg', upc: '0810011001238',
    assignedTo: mktUser._id, priority: 'medium',
  }]);
  const [r5doc] = r5;

  const r6 = await Release.create([{
    title: 'Top Floor', artist: onaje._id, songs: [s9doc._id],
    releaseDate: daysFromNow(42), type: 'single', status: 'scheduled', currentPhase: 'preparation',
    ownershipConfirmed: false, masterApproved: false, artworkApproved: false, metadataComplete: false,
    marketingBudget: 2000, coverArt: '', upc: '0810011001239',
    assignedTo: aRUser._id, priority: 'medium',
  }]);
  const [r6doc] = r6;
  track('Release', [r1doc, r2doc, r3doc, r4doc, r5doc, r6doc]);

  // ---- Projects ---------------------------------------------------------
  const p1 = await Project.create([{
    name: 'Belly Room EP', type: 'ep', artist: kalo._id, songs: [s2doc._id, s3doc._id, s4doc._id],
    status: 'in_progress', priority: 'high', releaseDate: daysFromNow(28), startDate: daysFromNow(-60),
    budget: 30000, spent: 18500, assignedTo: manager._id, description: 'Flagship EP for Kalo.',
    completionPercentage: 60, notes: 'Masters for Pressure complete; Back To Back in production.',
  }]);
  const [p1doc] = p1;

  const p2 = await Project.create([{
    name: 'Single: Runner', type: 'single', artist: jae._id, songs: [s5doc._id],
    status: 'completed', priority: 'high', releaseDate: daysFromNow(-90), startDate: daysFromNow(-140),
    budget: 12000, spent: 9800, assignedTo: mktUser._id, description: 'Global Afrobeats single push.',
    completionPercentage: 100, notes: 'Delivered. Campaign wrapped.',
  }]);
  const [p2doc] = p2;

  const p3 = await Project.create([{
    name: 'Lyrica Debut EP', type: 'ep', artist: lyrica._id, songs: [s8doc._id],
    status: 'waiting_approval', priority: 'medium', releaseDate: daysFromNow(90), startDate: daysFromNow(-30),
    budget: 18000, spent: 4200, assignedTo: aRUser._id, description: 'Debut EP, currently in writing camp phase.',
    completionPercentage: 25,
  }]);
  const [p3doc] = p3;
  track('Project', [p1doc, p2doc, p3doc]);

  // ---- Budgets ----------------------------------------------------------
  const b1 = await Budget.create([{
    name: '2026 Annual Marketing Budget', year: 2026, totalBudget: 0,
    items: [
      { category: 'Digital Ads', label: 'Meta / TikTok advertising', budgeted: 18000, spent: 11300 },
      { category: 'Playlist Pitching', label: 'Editorial pitching services', budgeted: 6000, spent: 4800 },
      { category: 'Content Production', label: 'Reels / short-form shoots', budgeted: 9000, spent: 2100 },
      { category: 'PR & Press', label: 'Press kits and outreach', budgeted: 7000, spent: 3400 },
      { category: 'Radio', label: 'On-air and digital radio', budgeted: 5000, spent: 2250 },
    ],
    department: 'marketing', status: 'active', notes: 'Annual all-artist marketing allocation.', createdBy: admin._id,
  }]);
  const [b1doc] = b1;

  const b2 = await Budget.create([{
    name: 'Belly Room EP Budget', year: 2026, totalBudget: 0, project: p1doc._id, artist: kalo._id,
    items: [
      { category: 'Recording', label: 'Studio time', budgeted: 9000, spent: 8200 },
      { category: 'Mixing & Mastering', label: 'Mix/master fees', budgeted: 4000, spent: 3850 },
      { category: 'Marketing', label: 'Pre-save campaign', budgeted: 5000, spent: 3100 },
      { category: 'Artwork', label: 'Cover art & assets', budgeted: 1500, spent: 1200 },
      { category: 'Distribution', label: 'Fees & UPC', budgeted: 500, spent: 150 },
    ],
    department: 'production', status: 'active', notes: 'Tracks spend for the EP project.', createdBy: manager._id,
  }]);
  const [b2doc] = b2;
  track('Budget', [b1doc, b2doc]);

  // ---- Finances ---------------------------------------------------------
  const finDocs = await createAll(Finance, [
    { type: 'income', category: 'streaming_revenue', subcategory: 'Spotify', amount: 8420.5, description: 'No Days Off streaming royalties',
      artist: kalo._id, release: r1doc._id, department: 'distribution', counterparty: 'Spotify', date: daysFromNow(-25), paymentStatus: 'paid', paidAt: daysFromNow(-25), processedBy: finUser._id, accountLast4: '4412' },
    { type: 'income', category: 'advances_received', amount: 10000, description: 'Belly Room EP advance - tranche 1',
      artist: kalo._id, project: p1doc._id, department: 'executive', counterparty: 'HoodBoy Ops', date: daysFromNow(-55), paymentStatus: 'paid', paidAt: daysFromNow(-55), processedBy: finUser._id },
    { type: 'expense', category: 'recording', amount: 4700, description: 'Studio block booking - Sunset Sounds',
      artist: kalo._id, project: p1doc._id, department: 'production', counterparty: 'Sunset Sounds', date: daysFromNow(-20), paymentStatus: 'paid', paidAt: daysFromNow(-18), invoiceNumber: 'INV-1001', paymentMethod: 'bank_transfer', taxDeductible: true },
    { type: 'expense', category: 'marketing_advertising', amount: 2200, description: 'Meta ads - No Days Off',
      project: p1doc._id, artist: kalo._id, department: 'marketing', counterparty: 'Meta', date: daysFromNow(-15), paymentStatus: 'paid', paidAt: daysFromNow(-14), invoiceNumber: 'INV-1002', taxDeductible: true },
    { type: 'income', category: 'sync_licensing', amount: 3000, description: 'Gbedu sync placement (TV spot)',
      artist: jae._id, release: r4doc._id, department: 'publishing', counterparty: 'North Tower Media', date: daysFromNow(-35), paymentStatus: 'paid', paidAt: daysFromNow(-33), processedBy: finUser._id },
    { type: 'expense', category: 'mixing_mastering', amount: 750, description: 'Mix/master - Slip Away',
      artist: jae._id, department: 'production', counterparty: 'Ian Tree', date: daysFromNow(-5), paymentStatus: 'pending', paymentDue: daysFromNow(10), invoiceNumber: 'INV-1003', taxDeductible: true },
    { type: 'income', category: 'merchandise', amount: 1240, description: 'Circles merch drop (week 1)',
      artist: lyrica._id, release: r5doc._id, department: 'merchandise', counterparty: 'PrintShop Co', date: daysFromNow(-10), paymentStatus: 'paid', paidAt: daysFromNow(-9), processedBy: finUser._id },
    { type: 'expense', category: 'legal_fees', amount: 1200, description: 'Contract review - Lyrica endorsements',
      department: 'legal', counterparty: 'Baker & Cole LLP', date: daysFromNow(-7), paymentStatus: 'paid', paidAt: daysFromNow(-6), invoiceNumber: 'INV-1004', taxDeductible: true },
    { type: 'expense', category: 'salaries', amount: 4000, description: 'Ops payroll - weekly',
      department: 'operations', counterparty: 'Payroll', date: daysFromNow(-1), paymentStatus: 'pending', paymentDue: daysFromNow(6), invoiceNumber: 'INV-1005' },
    { type: 'income', category: 'brand_partnerships', amount: 5000, description: 'Onaje x audio-brand sponsorship (deposit)',
      artist: onaje._id, department: 'marketing', counterparty: 'Pulse Audio', date: daysFromNow(-2), paymentStatus: 'partial', processedBy: finUser._id, notes: 'Half paid upfront, balance on delivery.' },
    { type: 'expense', category: 'equipment', amount: 1850, description: 'Studio condenser microphone',
      department: 'production', counterparty: 'Sweetwater', date: daysFromNow(-40), paymentStatus: 'paid', paidAt: daysFromNow(-38), invoiceNumber: 'INV-1006', taxDeductible: true },
    { type: 'income', category: 'royalty_income', amount: 3600, description: 'Quarterly publishing royalties - Kalo',
      artist: kalo._id, department: 'publishing', counterparty: 'ASCAP', date: daysFromNow(-80), paymentStatus: 'paid', paidAt: daysFromNow(-79), processedBy: finUser._id },
  ]);

  // ---- Royalty ledger ---------------------------------------------------
  const rl1 = await RoyaltyLedger.create([{
    artist: kalo._id, release: r1doc._id, song: s1doc._id,
    period: '2026-Q2', periodStart: new Date('2026-04-01'), periodEnd: new Date('2026-06-30'),
    grossIncome: 12600,
    incomeBySource: { streaming: 9800, publishing: 1500, mechanical: 600, performance: 500, sync: 200, merchandise: 0, other: 0 },
    royaltyBreakdown: {
      mechanical: { domestic: 240, international: 360, digital: 800, physical: 0 },
      performance: { broadcast: 200, live: 100, digitalPerformance: 160, background: 40 },
      sync: { film: 0, tv: 200, advertising: 0, gaming: 0, other: 0 },
    },
    distributorFees: 756,
    approvedDeductions: [{ description: 'Cleared sample usage', amount: 500, category: 'recoupable' }],
    totalDeductions: 1256,
    recoupableExpenses: 12000, totalRecouped: 500, recoupedThisPeriod: 500, remainingRecoupable: 11500,
    artistPercentage: 50, labelPercentage: 50, producerPercentage: 5, featuredArtistPercentage: 3,
    producerRoyalty: 567.2, featuredArtistRoyalty: 340.32,
    netIncome: 11344, artistGrossShare: 5672, artistShare: 4764.48, labelShare: 5672,
    paymentsIssued: [{ amount: 2000, date: daysFromNow(-20), method: 'Bank Transfer', reference: 'RL-2026-Q2-001' }],
    totalPaid: 2000, remainingBalance: 2764.48,
    status: 'calculated', calculatedAt: daysFromNow(-21),
    notes: 'Demo royalty statement for review. Balance pending release of advance recoupment.', statementGenerated: true,
  }]);
  const [rl1doc] = rl1;

  const rl2 = await RoyaltyLedger.create([{
    artist: jae._id, release: r4doc._id, song: s5doc._id,
    period: '2026-Q2', periodStart: new Date('2026-04-01'), periodEnd: new Date('2026-06-30'),
    grossIncome: 9800,
    incomeBySource: { streaming: 7400, publishing: 1200, mechanical: 500, performance: 300, sync: 400, merchandise: 0, other: 0 },
    distributorFees: 588, totalDeductions: 588,
    artistPercentage: 45, labelPercentage: 55, producerPercentage: 4, featuredArtistPercentage: 2,
    producerRoyalty: 414.72, featuredArtistRoyalty: 207.36,
    netIncome: 9212, artistGrossShare: 4145.4, artistShare: 3523.32, labelShare: 6246.68,
    status: 'approved', calculatedAt: daysFromNow(-25), approvedAt: daysFromNow(-24), approvedBy: finUser._id,
  }]);
  const [rl2doc] = rl2;

  const rl3 = await RoyaltyLedger.create([{
    artist: lyrica._id, release: r5doc._id, song: s7doc._id,
    period: '2026-Q2', periodStart: new Date('2026-04-01'), periodEnd: new Date('2026-06-30'),
    grossIncome: 2400,
    incomeBySource: { streaming: 1800, publishing: 400, mechanical: 100, performance: 50, sync: 0, merchandise: 50, other: 0 },
    distributorFees: 144, totalDeductions: 144,
    artistPercentage: 55, labelPercentage: 45, producerPercentage: 5, featuredArtistPercentage: 0,
    producerRoyalty: 135.5,
    netIncome: 2256, artistGrossShare: 1240.8, artistShare: 1105.3, labelShare: 1015.2,
    status: 'draft',
  }]);
  const [rl3doc] = rl3;
  track('RoyaltyLedger', [rl1doc, rl2doc, rl3doc]);

  // ---- Artist balances --------------------------------------------------
  const ab1 = await ArtistBalance.create([{
    artist: kalo._id,
    currentBalance: 8720.5, totalEarned: 12020.5, totalPaid: 2000, totalAdvances: 0, advanceRemaining: 0,
    lastPaymentDate: new Date('2026-06-10'),
    transactions: [
      { description: 'Opening balance', type: 'adjustment', amount: 1200, balanceAfter: 1200, date: new Date('2026-04-01') },
      { description: 'Streaming royalties - No Days Off', type: 'other', amount: 8420.5, balanceAfter: 9620.5, date: new Date('2026-05-01') },
      { description: 'Studio time', type: 'expense', amount: -2500, balanceAfter: 7120.5, date: new Date('2026-05-10') },
      { description: 'Royalty payout', type: 'royalty_payment', amount: -2000, balanceAfter: 5120.5, date: new Date('2026-06-10'), reference: 'PAY-1001' },
      { description: 'Publishing royalties', type: 'other', amount: 3600, balanceAfter: 8720.5, date: new Date('2026-06-15') },
    ],
    notes: 'Quarterly artist ledger for demo review.',
  }]);
  const [ab1doc] = ab1;

  const ab2 = await ArtistBalance.create([{
    artist: lyrica._id,
    currentBalance: 1100, totalEarned: 1800, totalPaid: 0, totalAdvances: 1500, advanceRemaining: 1500,
    transactions: [
      { description: 'Streaming royalties - Circles', type: 'other', amount: 1800, balanceAfter: 1800, date: new Date('2026-06-05') },
      { description: 'Writer advance', type: 'advance', amount: 1500, balanceAfter: 3300, date: new Date('2026-05-20'), reference: 'ADV-4002' },
      { description: 'Singing coach sessions', type: 'expense', amount: -400, balanceAfter: 2900, date: new Date('2026-05-02') },
      { description: 'Merch materials', type: 'expense', amount: -500, balanceAfter: 2400, date: new Date('2026-06-12') },
      { description: 'Advance recoupment', type: 'recoupment', amount: -1300, balanceAfter: 1100, date: new Date('2026-06-20'), reference: 'REC-6001' },
    ],
    notes: 'Advance partially recouped against publishing split.',
  }]);
  const [ab2doc] = ab2;
  track('ArtistBalance', [ab1doc, ab2doc]);

  // ---- Campaigns --------------------------------------------------------
  const c1 = await Campaign.create([{
    name: 'No Days Off Single Campaign', type: 'social_media', artist: kalo._id, release: r1doc._id, project: p1doc._id,
    status: 'active', startDate: daysFromNow(-30), endDate: daysFromNow(5),
    budget: 5000, spent: 3200, reach: 1200000, impressions: 3800000, clicks: 45000, conversions: 2200, engagement: 8.4,
    attributedRevenue: 8400, assignedTo: mktUser._id,
    goals: ['Reach 1M streams', '3M impressions', '500 pre-saves', '5k followers gained'],
    objective: 'Drive streams and grow Kalo audience in the US and UK.',
    targetAudience: '18-34 hip-hop listeners, US / UK / Canada',
    mainStory: 'Back-to-the-basics garage recordings, midnight energy.',
    contentThemes: ['performance', 'behind_the_scenes', 'fan_interaction', 'promotional'],
    callsToAction: ['Link in bio', 'Pre-save', 'React share'],
    releaseDate: daysFromNow(-120), platforms: ['instagram', 'tiktok', 'youtube', 'spotify'],
    approvalRequired: true, approvedBy: admin._id, approvedAt: daysFromNow(-31), approvalNotes: 'Approved with clean edits only.',
    contentTarget: 20, notes: 'Budget alert triggers at 80% spend.',
    contentItems: [
      { title: 'Reaction teaser - IG', platform: 'instagram', contentType: 'reel', category: 'performance', scheduledDate: daysFromNow(-28), publishedDate: daysFromNow(-28), status: 'published', caption: 'No days off. New single out now.', impressions: 420000, likes: 18000, shares: 2400, comments: 920, conversions: 300 },
      { title: 'Behind the studio - TT', platform: 'tiktok', contentType: 'video', category: 'behind_the_scenes', scheduledDate: daysFromNow(-22), publishedDate: daysFromNow(-22), status: 'published', caption: 'The 2am version of this track..', impressions: 1100000, likes: 52000, shares: 6100, comments: 1400, conversions: 600 },
      { title: 'Lyric video', platform: 'youtube', contentType: 'video', category: 'storytelling', scheduledDate: daysFromNow(-14), publishedDate: daysFromNow(-13), status: 'published', impressions: 340000, likes: 9000, conversions: 200 },
      { title: 'Fan Q&A', platform: 'instagram', contentType: 'story', category: 'fan_interaction', scheduledDate: daysFromNow(-9), publishedDate: daysFromNow(-9), status: 'published', impressions: 180000, likes: 3000, shares: 400, comments: 700, conversions: 150 },
      { title: 'Animated ad - IG', platform: 'instagram', contentType: 'ad', category: 'promotional', scheduledDate: daysFromNow(-3), status: 'scheduled', impressions: 0 },
      { title: 'Radio spot', platform: 'radio', contentType: 'ad', category: 'promotional', scheduledDate: daysFromNow(2), status: 'scheduled' },
    ],
    advertisingTests: [
      { name: 'Test A - Bold hook', platform: 'Meta / Instagram', audience: '18-24 US', creative: 'Hook-first cut', callToAction: 'Stream now', budget: 1200, spent: 980, impressions: 650000, clicks: 12000, conversions: 480, status: 'running' },
      { name: 'Test B - Story led', platform: 'TikTok Promo', audience: '18-34 US/UK', creative: 'Studio docu-style', callToAction: 'Pre-save', budget: 800, spent: 640, impressions: 720000, clicks: 15000, conversions: 520, status: 'completed', result: 'Higher save rate' },
    ],
    budgetAlertThreshold: 80, budgetAlertTriggered: false, progress: 30,
  }]);
  const [c1doc] = c1;

  const c2 = await Campaign.create([{
    name: 'Runner Radio Push', type: 'radio', artist: jae._id, release: r4doc._id, project: p2doc._id,
    status: 'completed', startDate: daysFromNow(-95), endDate: daysFromNow(-70),
    budget: 2500, spent: 2350, reach: 800000, impressions: 900000, clicks: 0, conversions: 0, engagement: 0,
    attributedRevenue: 4600, assignedTo: mktUser._id,
    goals: ['12 radio adds', '30 spins'],
    objective: 'Build US radio presence for Runner.',
    targetAudience: 'Rhythmic and CHR stations, US metros',
    platforms: ['radio'],
    contentTarget: 5,
  }]);
  const [c2doc] = c2;
  track('Campaign', [c1doc, c2doc]);

  // ---- Contacts ---------------------------------------------------------
  const ct1 = await Contact.create([{
    name: 'Tobi Adesanya', email: 'tobi.ade@example.com', phone: '+1 (555) 300-1001', company: 'Brightside Management',
    role: 'Day-to-day manager', category: 'manager', relationshipStatus: 'strong', relationshipStrength: 9,
    lastContactedAt: daysFromNow(-3), lastContactNotes: 'Discussed Q3 tour support.',
    socialLinks: { linkedin: 'https://linkedin.com/in/tobi-ade' },
    relatedArtists: [kalo._id], isFavorite: true, tags: ['management', 'key'],
    notes: 'Manages Kalo outside of label operations.', source: 'existing', assignedTo: admin._id,
    interactions: [{ type: 'meeting', subject: 'Q3 roadmap', notes: 'Alignment on single plan.', date: daysFromNow(-3), outcome: 'positive', followUpRequired: true, followUpDate: daysFromNow(4) }],
    reminders: [{ title: 'Follow up re: tour support', date: daysFromNow(4), type: 'follow_up' }],
  }]);
  const [ct1doc] = ct1;

  const ct2 = await Contact.create([{
    name: 'Demo (Producer)', email: 'demo.producer@example.com', phone: '+1 (555) 300-1002', company: 'Independent',
    role: 'Producer', category: 'producer', relationshipStatus: 'strong', relationshipStrength: 8,
    lastContactedAt: daysFromNow(-7), lastContactNotes: 'Delivered 3 new beats.',
    relatedArtists: [kalo._id], tags: ['production', 'exclusive'], notes: 'Primary producer for Kalo EP.', source: 'existing', assignedTo: aRUser._id,
    interactions: [{ type: 'email', subject: 'Beat pack', notes: 'Sent label exclusive beats.', date: daysFromNow(-7), outcome: 'positive' }],
  }]);
  const [ct2doc] = ct2;

  const ct3 = await Contact.create([{
    name: 'Rebecca Lin', email: 'rebecca.lin@northtower.com', phone: '+1 (555) 300-1003', company: 'North Tower Media',
    role: 'Sync agent', category: 'sync_agent', relationshipStatus: 'warm', relationshipStrength: 6,
    lastContactedAt: daysFromNow(-12), lastContactNotes: 'Pitched Back To Back for TV spot.',
    relatedArtists: [kalo._id, jae._id], relatedContracts: [], tags: ['sync', 'tv', 'licensing'],
    notes: 'Handles placements for TV and advertising.', source: 'referral', assignedTo: manager._id,
    interactions: [{ type: 'call', subject: 'TV spot pitch', notes: 'Placement pending client approval.', date: daysFromNow(-12), outcome: 'pending', followUpRequired: true, followUpDate: daysFromNow(6) }],
    reminders: [{ title: 'Check placement status', date: daysFromNow(6), type: 'follow_up' }],
  }]);
  const [ct3doc] = ct3;

  const ct4 = await Contact.create([{
    name: 'Nia Okonkwo', email: 'nia@playlistco.com', phone: '+1 (555) 300-1004', company: 'Playlist Co.',
    role: 'Editorial curator', category: 'playlist_curator', subcategory: 'hip-hop',
    relationshipStatus: 'warm', relationshipStrength: 5,
    lastContactedAt: daysFromNow(-20), lastContactNotes: 'Sent pre-release of No Days Off.',
    genrePreference: 'Hip-Hop, Drill', tags: ['playlists', 'spotify', 'editorial'],
    notes: 'Curates flagship hip-hop playlists.', source: 'social_media', assignedTo: mktUser._id,
    interactions: [{ type: 'email', subject: 'Pre-release submission', notes: 'Awaiting feedback.', date: daysFromNow(-20), outcome: 'neutral', followUpRequired: true, followUpDate: daysFromNow(9) }],
  }]);
  const [ct4doc] = ct4;

  const ct5 = await Contact.create([{
    name: 'Marcus Webb', email: 'marcus@radio-one.com', phone: '+1 (555) 300-1005', company: 'Radio One',
    role: 'Radio promoter', category: 'radio_promoter', relationshipStatus: 'strong', relationshipStrength: 8,
    lastContactedAt: daysFromNow(-40), lastContactNotes: 'Adds for Runner: 5 stations.',
    relatedArtists: [jae._id], tags: ['radio', 'urban'], notes: 'Primary radio contact.', source: 'existing', assignedTo: mktUser._id,
    interactions: [{ type: 'call', subject: 'Runner campaign', notes: '5 adds confirmed.', date: daysFromNow(-40), outcome: 'positive' }],
  }]);
  const [ct5doc] = ct5;
  track('Contact', [ct1doc, ct2doc, ct3doc, ct4doc, ct5doc]);

  // ---- Contracts --------------------------------------------------------
  const con1 = await Contract.create([{
    title: 'Kalo Exclusive Recording Agreement', artist: kalo._id, type: 'artist_agreement', status: 'active',
    parties: [
      { name: 'Kalo', role: 'Artist', entity: 'Individual' },
      { name: 'HoodBoy Entertainment', role: 'Label', entity: 'LLC' },
    ],
    signedDate: daysFromNow(-220), startDate: new Date('2024-01-01'), endDate: new Date('2026-12-31'),
    renewalDate: new Date('2026-12-31'), renewalDeadline: new Date('2026-10-31'), renewalNoticeDays: 60, autoRenew: false,
    optionPeriods: [
      { label: 'Option 3', durationMonths: 24, exerciseDeadline: new Date('2026-11-15'), exercised: false },
    ],
    value: 120000, royaltyRate: 50,
    recoupment: { type: 'recoupable', advanceAmount: 25000, advancePaid: true, recoupmentRate: 100, notes: 'Advance recoupable against artist royalties.' },
    ownershipTerms: 'Masters owned by label; publishing retained by artist, administered via HoodBoy Publishing.',
    paymentObligations: { advanceAmount: 25000, advancePaid: true, royaltyFrequency: 'quarterly', minimumGuarantee: 10000 },
    fileUrl: '/uploads/demo/kalo-agreement.pdf', fileName: 'kalo-agreement.pdf',
    managedBy: manager._id, terms: 'Standard terms per recoupment schedule.',
    notes: 'Demo contract for review workflows.', tags: ['recording', 'exclusive', 'active'],
    expirationNotifications: [
      { daysBefore: 90, notified: false }, { daysBefore: 30, notified: false }, { daysBefore: 7, notified: false },
    ],
  }]);
  const [con1doc] = con1;

  const con2 = await Contract.create([{
    title: 'Beat License - No Days Off', artist: kalo._id, type: 'beat_license', status: 'active',
    parties: [
      { name: 'Demo (Producer)', role: 'Producer', entity: 'Individual' },
      { name: 'HoodBoy Entertainment', role: 'Licensee', entity: 'LLC' },
    ],
    signedDate: daysFromNow(-150), startDate: daysFromNow(-150), endDate: daysFromNow(215),
    value: 3000, royaltyRate: 50,
    recoupment: { type: 'none' },
    paymentObligations: { advanceAmount: 1500, advancePaid: true, royaltyFrequency: 'quarterly' },
    fileUrl: '/uploads/demo/beat-license-nodays.pdf', fileName: 'beat-license-nodays.pdf',
    managedBy: aRUser._id, notes: 'Exclusive worldwide license.', tags: ['beat', 'license'],
  }]);
  const [con2doc] = con2;

  const con3 = await Contract.create([{
    title: 'Lyrica Development Agreement', artist: lyrica._id, type: 'artist_agreement', status: 'draft',
    parties: [
      { name: 'Lyrica', role: 'Artist', entity: 'Individual' },
      { name: 'HoodBoy Entertainment', role: 'Label', entity: 'LLC' },
    ],
    startDate: new Date('2026-01-01'), endDate: new Date('2028-12-31'),
    value: 60000, royaltyRate: 55,
    recoupment: { type: 'recoupable', advanceAmount: 12000, advancePaid: false, recoupmentRate: 100 },
    terms: 'Draft terms pending signatures.', notes: 'Awaiting artist and legal review.', tags: ['development', 'draft'],
  }]);
  const [con3doc] = con3;
  track('Contract', [con1doc, con2doc, con3doc]);

  // ---- Contract templates ----------------------------------------------
  const tpl1 = await ContractTemplate.create([{
    name: 'Standard Artist Agreement', type: 'artist_agreement',
    description: 'Default exclusive recording agreement.',
    clauses: [
      { title: 'Grant of Rights', body: 'Artist grants label exclusive recording rights for the term.', category: 'standard', order: 1 },
      { title: 'Royalties', body: 'Royalty rate defaults to 50% of label net receipts.', category: 'standard', order: 2 },
      { title: 'Recoupment', body: 'Advances recoupable at the recoupment rate set below.', category: 'standard', order: 3 },
      { title: 'Option Periods', body: 'Label may exercise options by the deadline specified.', category: 'conditional', order: 4 },
    ],
    defaultTerms: { duration: 36, renewalTerm: 12, royaltyRate: 50, advanceAmount: 25000, recoupmentType: 'recoupable' },
    isActive: true, usageCount: 3, lastUsedAt: daysFromNow(-40), createdBy: admin._id, tags: ['standard', 'artist'],
  }]);
  const [tpl1doc] = tpl1;

  const tpl2 = await ContractTemplate.create([{
    name: 'Beat License (Exclusive)', type: 'beat_license',
    description: 'Exclusive worldwide beat license template.',
    clauses: [
      { title: 'Grant', body: 'Exclusive license for unlimited commercial use.', category: 'standard', order: 1 },
      { title: 'Fee', body: 'Upfront license fee as specified in advance amount.', category: 'standard', order: 2 },
    ],
    defaultTerms: { duration: 12, royaltyRate: 50, advanceAmount: 1500 },
    isActive: true, usageCount: 5, lastUsedAt: daysFromNow(-15), createdBy: aRUser._id, tags: ['beat'],
  }]);
  const [tpl2doc] = tpl2;
  track('ContractTemplate', [tpl1doc, tpl2doc]);

  // ---- Tasks ------------------------------------------------------------
  const tasks = await createAll(Task, [
    { title: 'Finalize Belly Room EP artwork', description: 'Collect final cover art from designer and route for approval.',
      assignedTo: mktUser._id, assignedBy: manager._id, relatedProject: p1doc._id, relatedArtist: kalo._id,
      deadline: daysFromNow(10), status: 'in_progress', priority: 'high', category: 'marketing', deliverable: 'Final cover art files', tags: ['artwork', 'ep'] },
    { title: 'Master "Slip Away"', description: 'Send final vocal mix to mastering engineer.',
      assignedTo: aRUser._id, assignedBy: manager._id, relatedArtist: jae._id,
      deadline: daysFromNow(7), status: 'in_progress', priority: 'high', category: 'production', deliverable: 'Mastered WAV', tags: ['mastering'] },
    { title: 'Draft Lyrica press release', description: 'Prepare announcement copy for debut single.',
      assignedTo: mktUser._id, assignedBy: admin._id, relatedArtist: lyrica._id,
      deadline: daysFromNow(5), status: 'not_started', priority: 'medium', category: 'marketing', deliverable: 'Press release draft', tags: ['pr'] },
    { title: 'Reconcile Q2 royalty statements', description: 'Cross-check distributor statements vs ledger.',
      assignedTo: finUser._id, assignedBy: admin._id,
      deadline: daysFromNow(12), status: 'not_started', priority: 'high', category: 'finance', deliverable: 'Reconciled statements', tags: ['royalties', 'finance'] },
    { title: 'Book studio sessions for Back To Back', description: 'Reserve 2 sessions at Sunset Sounds.',
      assignedTo: manager._id, assignedBy: aRUser._id, relatedProject: p1doc._id, relatedArtist: kalo._id,
      deadline: daysFromNow(14), status: 'in_progress', priority: 'medium', category: 'production', deliverable: 'Studio bookings', tags: ['studio'] },
    { title: 'Review Kalo renewal terms', description: 'Prepare option 3 draft for negotiation.',
      assignedTo: manager._id, assignedBy: admin._id, relatedArtist: kalo._id,
      deadline: daysFromNow(30), status: 'blocked', priority: 'critical', category: 'legal', deliverable: 'Renewal memo', tags: ['contract', 'renewal'],
      notes: 'Awaiting lawyer input on publishing clause.' },
    { title: 'Pitch "Gbedu" to editorial playlists', description: 'Submit to Spotify editorial through distributor.',
      assignedTo: mktUser._id, assignedBy: admin._id, relatedRelease: r4doc._id, relatedArtist: jae._id,
      deadline: daysFromNow(3), status: 'in_progress', priority: 'high', category: 'distribution', deliverable: 'Pitch report', tags: ['playlists', 'spotify'] },
    { title: 'Collect W-9 from new contacts', description: 'Request tax forms for 2026 vendor onboarding.',
      assignedTo: finUser._id, assignedBy: manager._id,
      deadline: daysFromNow(21), status: 'not_started', priority: 'medium', category: 'finance', deliverable: 'Tax forms on file', tags: ['tax', 'vendors'] },
    { title: 'Overlap deadline test', description: 'Sample completed task for dashboard demo.',
      assignedTo: admin._id, assignedBy: admin._id, deadline: daysFromNow(-2), status: 'completed', priority: 'low', category: 'general',
      deliverable: 'None', completedAt: daysFromNow(-3) },
  ]);

  // ---- Artist development ----------------------------------------------
  const dev1 = await ArtistDevelopment.create([{
    artistId: kalo._id,
    title: 'Kalo 2026 Development Plan', description: 'Focus on live performance and vocal consistency.',
    status: 'active', createdBy: admin._id,
    goals: [
      { category: 'stagePerformance', title: 'Headline a 300-cap venue', description: 'Close out Q3 with a headline show.', targetDate: daysFromNow(75), completed: false, progress: 40, notes: 'Venue booked for October.' },
      { category: 'songwriting', title: 'Finish 5 demo-quality tracks', description: 'Ship demos for the Q4 project.', targetDate: daysFromNow(45), completed: false, progress: 60 },
      { category: 'socialMediaConsistency', title: 'Post 3x per week', description: 'Content calendar commitment.', targetDate: daysFromNow(30), completed: true, completedAt: daysFromNow(-10), progress: 100 },
      { category: 'vocalAbility', title: 'Weekly vocal coaching', description: '12 sessions with coach.', targetDate: daysFromNow(60), completed: false, progress: 25,
        milestones: [
          { title: 'Session 1-4 completed', dueDate: daysFromNow(-10), completed: true },
          { title: 'Session 5-8', dueDate: daysFromNow(20), completed: false },
        ] },
    ],
    improvementPlans: [
      { skill: 'stagePerformance', currentLevel: 5, targetLevel: 8,
        actions: ['Book small venue shows monthly', 'Stage rehearsal twice per week'],
        resources: ['Movement coach'], coach: manager._id, deadline: daysFromNow(90), status: 'in_progress' },
      { skill: 'socialMediaConsistency', currentLevel: 6, targetLevel: 8,
        actions: ['Pre-produce monthly content days'], coach: mktUser._id, deadline: daysFromNow(30), status: 'completed' },
    ],
    focusAreas: ['Live readiness', 'Vocal stamina', 'Fan funnel'],
    notes: 'Reviewed monthly; scorecard attached.',
    scorecards: [
      { month: '2026-08', year: 2026,
        skillRatings: { musicQuality: 8, songwriting: 8, vocalAbility: 6, stagePerformance: 5, branding: 7, visualIdentity: 7, socialMediaConsistency: 8, interviewSkills: 6, fanEngagement: 8, professionalBehavior: 9 },
        metricScores: { songsCompleted: 3, contentPosted: 14, engagementGrowth: 12, rehearsalsCompleted: 2, deadlinesMet: 5, revenueGenerated: 12000, audienceGrowth: 15400, teamCooperation: 8 },
        goals: [{ title: 'Grow IG to 50k', target: '50k', completed: true, notes: 'Hit 52k.' }],
        improvements: ['Stage presence', 'Vocal control'],
        comments: 'Strong month on content. Live reps needed.',
        overallScore: 8, scoredBy: admin._id },
    ],
  }]);
  const [dev1doc] = dev1;

  const dev2 = await ArtistDevelopment.create([{
    artistId: lyrica._id,
    title: 'Lyrica Breakout Plan', description: 'Prepare for debut EP rollout.', status: 'active', createdBy: aRUser._id,
    goals: [
      { category: 'songwriting', title: 'Complete EP tracklist', description: 'Lock 6 tracks.', targetDate: daysFromNow(40), completed: false, progress: 50 },
      { category: 'branding', title: 'Design visual identity', description: 'Moodboard + art direction.', targetDate: daysFromNow(25), completed: false, progress: 30 },
    ],
    improvementPlans: [
      { skill: 'interviewSkills', currentLevel: 4, targetLevel: 7, actions: ['3 mock interviews'], coach: admin._id, deadline: daysFromNow(60), status: 'not_started' },
    ],
    focusAreas: ['Identity', 'Catalog'],
    scorecards: [
      { month: '2026-08', year: 2026,
        skillRatings: { musicQuality: 7, songwriting: 7, vocalAbility: 7, stagePerformance: 4, branding: 6, visualIdentity: 6, socialMediaConsistency: 6, interviewSkills: 4, fanEngagement: 6, professionalBehavior: 8 },
        metricScores: { songsCompleted: 2, contentPosted: 8, engagementGrowth: 9, rehearsalsCompleted: 1, deadlinesMet: 3, revenueGenerated: 2900, audienceGrowth: 6400, teamCooperation: 8 },
        comments: 'On track for EP delivery.',
        overallScore: 7, scoredBy: aRUser._id },
    ],
  }]);
  const [dev2doc] = dev2;
  track('ArtistDevelopment', [dev1doc, dev2doc]);

  // ---- Ownership --------------------------------------------------------
  const o1 = await Ownership.create([{
    songId: s1doc._id, masterOwner: 'HoodBoy Entertainment',
    writers: [{ name: 'Kalo', percentage: 100, role: 'songwriter' }],
    publishers: [],
    producer: 'Demo (Producer)', producerPercentage: 0,
    featuredArtists: [],
    beatLicense: { type: 'exclusive', producer: 'Demo (Producer)', cost: 3000, terms: 'Exclusive worldwide', expirationDate: daysFromNow(215), purchaseDate: daysFromNow(-150), licenseNumber: 'BL-10001', territory: 'Worldwide', usageLimit: 'Unlimited' },
    samples: [{ title: 'Night Drive', originalArtist: 'Demo Sample', owner: 'Cleared Sample Co', percentage: 0, clearanceStatus: 'cleared' }],
    signatures: [
      { partyName: 'Kalo', role: 'master_owner', status: 'signed', signedAt: daysFromNow(-149) },
      { partyName: 'Demo (Producer)', role: 'producer', status: 'signed', signedAt: daysFromNow(-148) },
    ],
    copyrightStatus: 'registered', copyrightNumber: 'PA-1-234-567',
    proStatus: 'registered', proName: 'ASCAP', proIpi: '006543210',
    distributionStatus: 'distributed', releaseApproved: true, approvedBy: admin._id, approvedAt: daysFromNow(-149),
    totalPercentage: 100, isComplete: true, signaturesComplete: true, isReadyForRelease: true,
    notes: 'Fully cleared for release.',
  }]);
  const [o1doc] = o1;

  const o2 = await Ownership.create([{
    songId: s5doc._id, masterOwner: 'HoodBoy Entertainment',
    writers: [{ name: 'JaeDayo', percentage: 100, role: 'songwriter' }],
    publishers: [],
    producer: 'Ian Tree', producerPercentage: 0,
    featuredArtists: [],
    beatLicense: { type: 'exclusive', producer: 'Ian Tree', cost: 2400, purchaseDate: daysFromNow(-160) },
    signatures: [{ partyName: 'JaeDayo', role: 'master_owner', status: 'signed', signedAt: daysFromNow(-159) }],
    copyrightStatus: 'registered', copyrightNumber: 'PA-1-321-098',
    proStatus: 'registered', proName: 'BMI', proIpi: '005123456',
    distributionStatus: 'distributed', releaseApproved: true, approvedBy: admin._id, approvedAt: daysFromNow(-159),
    totalPercentage: 100, isComplete: true, signaturesComplete: true, isReadyForRelease: true,
  }]);
  const [o2doc] = o2;

  const o3 = await Ownership.create([{
    songId: s2doc._id, masterOwner: 'HoodBoy Entertainment',
    writers: [{ name: 'Kalo', percentage: 70, role: 'songwriter' }],
    publishers: [],
    producer: 'Demo (Producer)', producerPercentage: 0,
    beatLicense: { type: 'exclusive', producer: 'Demo (Producer)', cost: 1800, purchaseDate: daysFromNow(-20) },
    signatures: [{ partyName: 'Kalo', role: 'master_owner', status: 'signed', signedAt: daysFromNow(-19) }],
    copyrightStatus: 'pending', copyrightNumber: '',
    proStatus: 'pending', proName: 'ASCAP',
    distributionStatus: 'pending_approval', releaseApproved: false,
    totalPercentage: 70, isComplete: false, signaturesComplete: false, isReadyForRelease: false,
    notes: 'Writer split still being finalized (second writer to be added).',
  }]);
  const [o3doc] = o3;
  track('Ownership', [o1doc, o2doc, o3doc]);

  // ---- Song metadata ----------------------------------------------------
  const sm1 = await SongMetadata.create([{
    songId: s1doc._id, title: 'No Days Off', version: 'Original', artist: kalo._id, album: 'Belly Room',
    genre: 'Hip-Hop', subgenre: 'West Coast', mood: 'Bold', bpm: 94, key: 'Cm', language: 'English',
    releaseDate: daysFromNow(-120), lyrics: 'No days off, we run it back...',
    isrc: 'US-HBE-26-00001', upc: '0810011001234', iswc: 'T-001234567-8',
    copyright: '© 2026 HoodBoy Entertainment', copyrightOwner: 'HoodBoy Entertainment', copyrightYear: 2026,
    publisher: 'HoodBoy Publishing', proAffiliation: 'ASCAP', writerSplit: 'Kalo 100%',
    publishers: [{ name: 'HoodBoy Publishing', percentage: 100, proAffiliation: 'ASCAP', ipi: '000567890' }],
    contactInformation: { name: 'Demo Finance', email: 'demo.finance@hbe.local', phone: '+1 (555) 000-0003' },
    streamingPlatforms: { spotifyUri: 'spotify:track:demos1', spotifyId: 'demos1', appleMusicId: 'demos1' },
    preSaveLink: 'https://presave.example/no-days-off',
    distributionDate: daysFromNow(-120), distributionPlatform: 'DistroKid', preSaveDate: daysFromNow(-135),
    audioFormat: 'wav', sampleRate: '48kHz', bitDepth: '24-bit', isExplicit: true,
    credits: [
      { name: 'Kalo', role: 'songwriter', percentage: 100 },
      { name: 'Demo (Producer)', role: 'producer', percentage: 50 },
      { name: 'Miles Carter', role: 'engineer', percentage: 0 },
      { name: 'Ada Obi', role: 'masterer', percentage: 0 },
    ],
    exportFormats: [{ format: 'csv', exportedAt: daysFromNow(-1), fileUrl: '/uploads/demo/no-days-off.csv' }],
    validationStatus: 'valid', lastValidatedAt: daysFromNow(-1),
    notes: 'Metadata complete and valid.',
  }]);
  const [sm1doc] = sm1;

  const sm2 = await SongMetadata.create([{
    songId: s5doc._id, title: 'Gbedu', version: 'Original', artist: jae._id,
    genre: 'Afrobeats', subgenre: 'Amapiano', mood: 'Euphoric', bpm: 110, key: 'Ebm', language: 'English / Yoruba',
    releaseDate: daysFromNow(-90), isrc: 'US-HBE-26-00004', upc: '0810011001237', iswc: 'T-001765432-1',
    copyright: '© 2026 HoodBoy Entertainment', copyrightOwner: 'HoodBoy Entertainment', copyrightYear: 2026,
    publisher: 'HoodBoy Publishing', proAffiliation: 'BMI', writerSplit: 'JaeDayo 100%',
    publishers: [{ name: 'HoodBoy Publishing', percentage: 100, proAffiliation: 'BMI', ipi: '000654321' }],
    contactInformation: { name: 'Demo Finance', email: 'demo.finance@hbe.local' },
    streamingPlatforms: { spotifyUri: 'spotify:track:demos2', spotifyId: 'demos2' },
    distributionDate: daysFromNow(-90), distributionPlatform: 'DistroKid',
    audioFormat: 'wav', sampleRate: '44.1kHz', bitDepth: '24-bit', isExplicit: false,
    credits: [
      { name: 'JaeDayo', role: 'songwriter', percentage: 100 },
      { name: 'Ian Tree', role: 'producer', percentage: 40 },
    ],
    validationStatus: 'valid', lastValidatedAt: daysFromNow(-2),
    notes: 'Distributed across all major DSPs.',
  }]);
  const [sm2doc] = sm2;

  const sm3 = await SongMetadata.create([{
    songId: s2doc._id, title: 'Pressure', version: 'Original', artist: kalo._id, album: 'Belly Room',
    genre: 'Hip-Hop', mood: 'Tense', bpm: 98, key: 'Dm', language: 'English',
    releaseDate: daysFromNow(28), isrc: 'US-HBE-26-00002', upc: '0810011001236', iswc: 'T-001876543-9',
    copyright: '© 2026 HoodBoy Entertainment', copyrightOwner: 'HoodBoy Entertainment', copyrightYear: 2026,
    publisher: 'HoodBoy Publishing', proAffiliation: 'ASCAP', writerSplit: 'Kalo 100%',
    publishers: [{ name: 'HoodBoy Publishing', percentage: 100, proAffiliation: 'ASCAP', ipi: '000567890' }],
    contactInformation: { name: 'Demo Finance', email: 'demo.finance@hbe.local' },
    preSaveLink: 'https://presave.example/pressure',
    audioFormat: 'mp3', sampleRate: '44.1kHz', bitDepth: '16-bit', isExplicit: true,
    credits: [
      { name: 'Kalo', role: 'songwriter', percentage: 100 },
      { name: 'Demo (Producer)', role: 'producer', percentage: 50 },
    ],
    validationStatus: 'needs_review', validationErrors: ['Release date before distribution date', 'Pre-save link not confirmed'], lastValidatedAt: daysFromNow(-1),
    notes: 'Pending final metadata approval pre-release.',
  }]);
  const [sm3doc] = sm3;
  track('SongMetadata', [sm1doc, sm2doc, sm3doc]);

  // ---- Per-song analytics ----------------------------------------------
  const psa = await createAll(PerSongAnalytics, [
    {
      song: s1doc._id, artist: kalo._id, release: r1doc._id,
      period: '2026-07', periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31'),
      platforms: [
        { name: 'Spotify', streams: 410000, listeners: 94000, saves: 7200, playlistAdds: 3100, revenue: 2870, playlistReach: 1800000 },
        { name: 'Apple Music', streams: 98000, listeners: 21000, saves: 1400, playlistAdds: 600, revenue: 686, playlistReach: 420000 },
        { name: 'YouTube Music', streams: 52000, listeners: 11000, saves: 500, playlistAdds: 250, revenue: 364, playlistReach: 150000 },
      ],
      totalStreams: 560000, monthlyListeners: 126000, saves: 9100, playlistAdditions: 3950,
      videoViews: 88000, watchTime: 2840000, followersGained: 4100, emailSubscribers: 900,
      websiteVisits: 32000, merchandiseSales: 2100, ticketSales: 0, adSpend: 1600, costPerResult: 0.31,
      revenue: 3920, campaignProfitLoss: 2320,
      streamsGrowth: 14.2, listenersGrowth: 9.8, savesGrowth: 11.5,
    },
    {
      song: s5doc._id, artist: jae._id, release: r4doc._id,
      period: '2026-07', periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31'),
      platforms: [
        { name: 'Spotify', streams: 510000, listeners: 118000, saves: 8800, playlistAdds: 4200, revenue: 3570, playlistReach: 2200000 },
        { name: 'Apple Music', streams: 142000, listeners: 31000, saves: 2100, playlistAdds: 900, revenue: 994, playlistReach: 600000 },
        { name: 'YouTube Music', streams: 88000, listeners: 19000, saves: 800, playlistAdds: 350, revenue: 616, playlistReach: 240000 },
      ],
      totalStreams: 740000, monthlyListeners: 168000, saves: 11700, playlistAdditions: 5450,
      videoViews: 121000, watchTime: 4100000, followersGained: 5200, emailSubscribers: 700,
      websiteVisits: 28000, merchandiseSales: 0, ticketSales: 0, adSpend: 800, costPerResult: 0.22,
      revenue: 5180, campaignProfitLoss: 4380,
      streamsGrowth: 21.0, listenersGrowth: 12.4, savesGrowth: 18.2,
    },
    {
      song: s7doc._id, artist: lyrica._id, release: r5doc._id,
      period: '2026-08', periodStart: new Date('2026-08-01'), periodEnd: new Date('2026-08-31'),
      platforms: [
        { name: 'Spotify', streams: 178000, listeners: 41000, saves: 2900, playlistAdds: 1400, revenue: 1246, playlistReach: 760000 },
        { name: 'Apple Music', streams: 44000, listeners: 9500, saves: 600, playlistAdds: 200, revenue: 308, playlistReach: 180000 },
      ],
      totalStreams: 222000, monthlyListeners: 50500, saves: 3500, playlistAdditions: 1600,
      videoViews: 31000, watchTime: 890000, followersGained: 1800, emailSubscribers: 400,
      websiteVisits: 12000, merchandiseSales: 1240, ticketSales: 0, adSpend: 500, costPerResult: 0.28,
      revenue: 1680, campaignProfitLoss: 1180,
      streamsGrowth: 33.4, listenersGrowth: 24.1, savesGrowth: 30.0,
    },
  ]);

  // ---- Lnk-Up episodes --------------------------------------------------
  const lnk1 = await LnkUp.create([{
    title: 'Session 1: Kalo in the Garage', season: 1, episode: 1, artist: kalo._id, guests: ['Demo (Producer)', 'Miles Carter'],
    status: 'aired', airDate: daysFromNow(-30), platform: 'youtube',
    description: 'Unfiltered session recording of "No Days Off" plus an interview.',
    featured: true, views: 184000, likes: 12400, watchTime: 940000, tags: ['session', 'interview'],
  }]);
  const [lnk1doc] = lnk1;

  const lnk2 = await LnkUp.create([{
    title: 'Session 2: Off the Cuff', season: 1, episode: 2, artist: jae._id, guests: ['Ian Tree'],
    status: 'editing', platform: 'youtube',
    description: 'JaeDayo breaks down Gbedu and plays a new demo.',
    featured: false, views: 0, likes: 0, watchTime: 0, tags: ['session', 'new music'],
  }]);
  const [lnk2doc] = lnk2;
  track('LnkUp', [lnk1doc, lnk2doc]);

  // ---- Tax calendar -----------------------------------------------------
  const tax = await createAll(TaxCalendar, [
    { title: 'Q3 2026 Estimated Tax Payment', type: 'estimated_tax', description: 'Federal estimated payment - Q3.', dueDate: new Date('2026-09-15'), amount: 12500, year: 2026, quarter: 3, status: 'upcoming', priority: 'high', recurring: true, recurringFrequency: 'quarterly', assignedTo: 'Ava Finance', tags: ['federal', 'quarterly'] },
    { title: 'Q4 2026 Estimated Tax Payment', type: 'estimated_tax', description: 'Federal estimated payment - Q4.', dueDate: new Date('2027-01-15'), amount: 14000, year: 2026, quarter: 4, status: 'upcoming', priority: 'high', recurring: true, recurringFrequency: 'quarterly', assignedTo: 'Ava Finance', tags: ['federal', 'quarterly'] },
    { title: '2025 Annual Corporate Return', type: 'tax_return', description: 'Entity annual filing.', dueDate: new Date('2026-04-15'), amount: 0, year: 2025, status: 'completed', completedAt: new Date('2026-04-10'), priority: 'medium', assignedTo: 'Ava Finance', tags: ['annual', 'completed'] },
    { title: 'Sales Tax Filing - September', type: 'tax_filing', description: 'Merchandise sales tax.', dueDate: new Date('2026-10-20'), amount: 380, year: 2026, status: 'upcoming', priority: 'low', recurring: true, recurringFrequency: 'monthly', assignedTo: 'Ava Finance', tags: ['sales', 'merch'] },
  ]);

  // ---- Weekly reports ---------------------------------------------------
  const wr1 = await WeeklyReport.create([{
    weekStart: new Date('2026-09-07'), weekEnd: new Date('2026-09-13'),
    completed: 'Delivered pre-save link for Pressure. Reconciled May finance entries. Recorded demo vocals for Back To Back.',
    stillOpen: 'Slip Away mastering. Lyrica press release draft.',
    blocked: 'Kalo renewal terms - awaiting lawyer input.',
    needsApproval: 'Belly Room EP artwork v2. Lyrica endorsement draft.',
    dueThisWeek: 'Gbedu playlist pitch report (Jul). Send chest sheets to curators.',
    biggestRisk: 'EP timeline slipping 2 weeks if masters not delivered by Friday.',
    nextActionOwner: 'a&r/demo.manager',
    notes: 'Three check-ins completed; no escalations.',
    createdBy: admin._id,
  }]);
  const [wr1doc] = wr1;

  const wr2 = await WeeklyReport.create([{
    weekStart: new Date('2026-08-31'), weekEnd: new Date('2026-09-06'),
    completed: 'Published 3 reels. Onboarded Onaje to step 2. Paid invoiced studio fees.',
    stillOpen: 'Tax info collection from 2 vendors.',
    blocked: 'None.',
    needsApproval: 'Predictive Q3 budget re-forecast.',
    dueThisWeek: 'Confirm EP tracklist.',
    biggestRisk: 'None.',
    notes: 'Solid week.',
    createdBy: manager._id,
  }]);
  const [wr2doc] = wr2;
  track('WeeklyReport', [wr1doc, wr2doc]);

  // ---- Files & folders --------------------------------------------------
  const fMasters = await Folder.create([{ name: 'Demo Masters', parentId: null, path: '/files/Demo Masters', icon: 'masters', color: '#8B5CF6', createdBy: admin._id }]);
  const fContracts = await Folder.create([{ name: 'Demo Contracts', parentId: null, path: '/files/Demo Contracts', icon: 'contract', color: '#EF4444', createdBy: admin._id }]);
  const fArtwork = await Folder.create([{ name: 'Demo Artwork', parentId: null, path: '/files/Demo Artwork', icon: 'art', color: '#F59E0B', createdBy: admin._id }]);
  const [fMastersDoc] = fMasters;
  const [fContractsDoc] = fContracts;
  const [fArtworkDoc] = fArtwork;
  track('Folder', [fMastersDoc, fContractsDoc, fArtworkDoc]);

  const files = await createAll(File, [
    { name: 'no-days-off-explicit.wav', originalName: 'no-days-off-explicit.wav', path: '/uploads/files/Demo Masters/no-days-off-explicit.wav', folderId: fMastersDoc._id, mimeType: 'audio/wav', size: 16044, type: 'audio', category: 'master', tags: ['master', 'explicit'], artistId: kalo._id, songId: s1doc._id, releaseId: r1doc._id, version: 2, versionNote: 'Functional silent demo fixture', uploadedBy: admin._id, downloads: 0, starred: true },
    { name: 'pressure-ref.wav', originalName: 'pressure-ref.wav', path: '/uploads/files/Demo Masters/pressure-ref.wav', folderId: fMastersDoc._id, mimeType: 'audio/wav', size: 16044, type: 'audio', category: 'mix', tags: ['mix', 'reference'], artistId: kalo._id, songId: s2doc._id, uploadedBy: manager._id },
    { name: 'kalo-agreement.pdf', originalName: 'kalo-agreement.pdf', path: '/uploads/files/Demo Contracts/kalo-agreement.pdf', folderId: fContractsDoc._id, mimeType: 'application/pdf', size: 700, type: 'document', category: 'contract', tags: ['contract', 'artist'], artistId: kalo._id, contractId: con1doc._id, uploadedBy: admin._id, downloads: 0, starred: true },
    { name: 'gbedu.wav', originalName: 'gbedu.wav', path: '/uploads/files/Demo Masters/gbedu.wav', folderId: fMastersDoc._id, mimeType: 'audio/wav', size: 16044, type: 'audio', category: 'master', tags: ['master'], artistId: jae._id, songId: s5doc._id, releaseId: r4doc._id, version: 1, uploadedBy: admin._id },
    { name: 'no-days-off-art.jpg', originalName: 'no-days-off-art.jpg', path: '/uploads/files/Demo Artwork/no-days-off-art.jpg', folderId: fArtworkDoc._id, mimeType: 'image/jpeg', size: 631, type: 'image', category: 'artwork', tags: ['artwork', 'single'], artistId: kalo._id, releaseId: r1doc._id, uploadedBy: mktUser._id },
    { name: 'invoice-1001.pdf', originalName: 'invoice-1001.pdf', path: '/uploads/files/Demo Contracts/invoice-1001.pdf', folderId: fContractsDoc._id, mimeType: 'application/pdf', size: 700, type: 'document', category: 'invoice', tags: ['invoice', 'studio'], financeId: finDocs[2]._id, uploadedBy: finUser._id },
    { name: 'no-days-off.csv', originalName: 'no-days-off.csv', path: '/uploads/files/Demo Masters/no-days-off.csv', folderId: fMastersDoc._id, mimeType: 'text/csv', size: 70, type: 'document', category: 'metadata', tags: ['metadata', 'export'], songId: s1doc._id, uploadedBy: admin._id },
  ]);

  const fv = await createAll(FileVersion, [
    { file: files[0]._id, versionNumber: 1, fileName: 'no-days-off-mix1.wav', fileUrl: '/uploads/files/Demo Masters/no-days-off-mix1.wav', fileSize: 16044, changeNote: 'Reference mix', uploadedBy: manager._id },
    { file: files[0]._id, versionNumber: 2, fileName: 'no-days-off-explicit.wav', fileUrl: '/uploads/files/Demo Masters/no-days-off-explicit.wav', fileSize: 16044, changeNote: 'Functional silent demo fixture', uploadedBy: admin._id },
  ]);

  // ---- Notifications ----------------------------------------------------
  const notif = await createAll(Notification, [
    { userId: admin._id, type: 'payment_due', title: 'Invoice proceeds due', message: 'Sunset Sounds invoice INV-1003 becomes due on ' + iso(10) + '.', link: '/finance', read: false, priority: 'high' },
    { userId: admin._id, type: 'contract_expiry', title: 'Kalo renewal deadline approaching', message: 'Renewal deadline 2026-10-31. Prepare option terms.', link: '/contracts', read: false, priority: 'high' },
    { userId: manager._id, type: 'task_deadline', title: 'Master "Slip Away" due in 7 days', message: 'Submit the final mix for mastering.', link: '/tasks', read: false, priority: 'medium' },
    { userId: mktUser._id, type: 'campaign_update', title: 'Budget alert', message: 'No Days Off campaign has spent 64% of budget.', link: '/campaigns', read: false, priority: 'low' },
    { userId: kaloUser._id, type: 'release_scheduled', title: 'Belly Room EP scheduled', message: 'Your EP is scheduled for ' + iso(28) + '.', link: '/my-releases', read: false, priority: 'medium' },
    { userId: finUser._id, type: 'approval_needed', title: 'Royalty statement awaiting review', message: 'Q2 statement for Kalo needs approval.', link: '/royalties', read: false, priority: 'high' },
    { userId: aRUser._id, type: 'mention', title: 'A&R: song review', message: 'Pressure awaits approval before EP polish.', link: '/songs', read: true, priority: 'medium' },
  ]);

  // ---- Activity ---------------------------------------------------------
  const act = await createAll(Activity, [
    { action: 'created', entityType: 'artist', entityId: kalo._id, entityName: 'Kalo', user: admin._id, userName: 'Demo Admin', details: 'Created artist profile' },
    { action: 'approved', entityType: 'release', entityId: r1doc._id, entityName: 'No Days Off', user: admin._id, userName: 'Demo Admin', details: 'Release approved for distribution' },
    { action: 'created', entityType: 'finance', entityId: finDocs[2]._id, entityName: 'INV-1001', user: finUser._id, userName: 'Demo Finance', details: 'Recorded studio expense' },
    { action: 'updated', entityType: 'project', entityId: p1doc._id, entityName: 'Belly Room EP', user: manager._id, userName: 'Demo Manager', details: 'Set completion to 60%' },
    { action: 'published', entityType: 'campaign', entityId: c1doc._id, entityName: 'No Days Off Single Campaign', user: mktUser._id, userName: 'Demo Marketing', details: 'Published campaign content' },
    { action: 'signed', entityType: 'contract', entityId: con1doc._id, entityName: 'Kalo Exclusive Recording Agreement', user: manager._id, userName: 'Demo Manager', details: 'Signed contract on file' },
  ]);

  await saveMarkers();

  console.log('=== DEMO SEED COMPLETE ===');
  console.log(`Total demo documents: ${Object.values(ids).reduce((s, a) => s + a.length, 0)}`);
  for (const [model, arr] of Object.entries(ids)) console.log(`  ${model}: ${arr.length}`);
  console.log('\nDemo logins (password: ' + PASS + ')');
  console.log('  admin:    demo.admin@hbe.local');
  console.log('  manager:  demo.manager@hbe.local');
  console.log('  finance:  demo.finance@hbe.local');
  console.log('  marketing:demo.marketing@hbe.local');
  console.log('  artist:   demo.kalo@hbe.local (also demo.jae / demo.lyrica / demo.onaje)');
  console.log('\nTo remove all demo data:  node scripts/clearDemo.js');
}

const run = async () => {
  try {
    if (!PASS || PASS.length < 12) {
      throw new Error('DEMO_PASSWORD must be set to at least 12 characters before seeding demo accounts');
    }
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hbe_label', {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('Connected to MongoDB.\n');
    console.log('Removing any prior demo data...');
    await clearExistingDemo();
    await seed();
  } catch (err) {
    console.error('Seed failed:', err.message);
    console.error(err.stack);
    if (err.errors) {
      for (const [k, v] of Object.entries(err.errors)) console.error(`  [${k}] ${v.message}`);
    }
    await saveMarkers().catch(() => {});
    console.error('Partial markers flushed; re-running the seed will clean up safely.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) run();

module.exports = { ensureDemoAssets, makePdf, makeSilentWav };
