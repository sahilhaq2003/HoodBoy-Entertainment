/**
 * clearSampleData.js
 *
 * Removes ALL demo / sample data from every collection while preserving
 * real user accounts (admin, team members) and any data they created.
 *
 * What is removed:
 *  - Every document tracked in the _demomarkers collection (safe set seeded by seedDemo.js).
 *  - Known demo-account emails (the accounts created by seedDemo.js).
 *  - All DistributionRelease records whose provider is 'local_demo'
 *    (mock adapter records that must not reach the real LabelGrid API).
 *  - Uploads from the uploads/demo directory (stub WAV/JPG/PDF fixtures).
 *
 * What is NEVER removed:
 *  - Users that are not in the demo email list.
 *  - Any document not recorded in _demomarkers and not carrying a local_demo marker.
 *
 * Run:  node scripts/clearSampleData.js   (from the backend directory)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const DEMO_EMAILS = [
  // seedDemo.js demo accounts
  'admin@hbelabel.com',
  'manager@hbelabel.com',
  'artist@hbelabel.com',
  'finance@hbelabel.com',
  'marketing@hbelabel.com',
  // legacy local demo emails
  'demo.admin@hbe.local',
  'demo.manager@hbe.local',
  'demo.finance@hbe.local',
  'demo.marketing@hbe.local',
  'demo.ar@hbe.local',
  'demo.kalo@hbe.local',
  'demo.jae@hbe.local',
  'demo.lyrica@hbe.local',
  'demo.onaje@hbe.local',
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\n🔌 Connected to MongoDB');

  const db = mongoose.connection.db;

  // ── 1. Clear _demomarkers-tracked documents ─────────────────────────────────
  console.log('\n📋 Reading _demomarkers collection…');
  const markers = await db.collection('_demomarkers').find({}).toArray();
  let totalRemoved = 0;

  for (const marker of markers) {
    const collection = db.collection(marker.collection || marker.model?.toLowerCase() + 's');
    if (!collection) { console.log(`  ⚠ Unknown collection for model "${marker.model}", skipping`); continue; }
    if (!Array.isArray(marker.ids) || marker.ids.length === 0) continue;

    try {
      // Try the model name as a mongoose model first (handles exact casing).
      const Model = mongoose.models[marker.model];
      if (Model) {
        const res = await Model.deleteMany({ _id: { $in: marker.ids } });
        console.log(`  ✓ ${marker.model}: removed ${res.deletedCount} docs`);
        totalRemoved += res.deletedCount;
      } else {
        // Fall back to raw collection (no Mongoose model available at runtime).
        const objectIds = marker.ids.map(id => {
          try { return new mongoose.Types.ObjectId(id); } catch { return id; }
        });
        const res = await db.collection(marker.model.toLowerCase() + 's').deleteMany({ _id: { $in: objectIds } });
        console.log(`  ✓ ${marker.model} (raw): removed ${res.deletedCount} docs`);
        totalRemoved += res.deletedCount;
      }
    } catch (err) {
      console.log(`  ⚠ Could not remove from ${marker.model}: ${err.message}`);
    }
  }
  await db.collection('_demomarkers').deleteMany({});
  console.log('  ✓ _demomarkers collection cleared');

  // ── 2. Remove demo user accounts ────────────────────────────────────────────
  console.log('\n👤 Removing demo user accounts…');
  try {
    const User = require('../models/User');
    const userRes = await User.deleteMany({ email: { $in: DEMO_EMAILS } });
    console.log(`  ✓ Removed ${userRes.deletedCount} demo user account(s)`);
    totalRemoved += userRes.deletedCount;
  } catch (err) {
    console.log(`  ⚠ Could not delete demo users: ${err.message}`);
  }

  // ── 3. Remove local_demo distribution releases ───────────────────────────────
  console.log('\n📦 Removing local_demo distribution releases…');
  try {
    const DistributionRelease = require('../models/DistributionRelease');
    const distRes = await DistributionRelease.deleteMany({ provider: 'local_demo' });
    console.log(`  ✓ Removed ${distRes.deletedCount} local_demo distribution release(s)`);
    totalRemoved += distRes.deletedCount;
  } catch (err) {
    console.log(`  ⚠ Could not remove local_demo releases: ${err.message}`);
  }

  // ── 4. Remove demo artists with local placeholder email patterns ─────────────
  console.log('\n🎤 Removing demo artists linked to demo accounts…');
  try {
    const Artist = require('../models/Artist');
    const artistRes = await Artist.deleteMany({
      email: { $in: [...DEMO_EMAILS, 'demo.jae@hbe.local', 'demo.lyrica@hbe.local', 'demo.onaje@hbe.local'] }
    });
    console.log(`  ✓ Removed ${artistRes.deletedCount} demo artist(s)`);
    totalRemoved += artistRes.deletedCount;
  } catch (err) {
    console.log(`  ⚠ Could not remove demo artists: ${err.message}`);
  }

  // ── 5. Delete stub demo upload files ────────────────────────────────────────
  console.log('\n🗂  Removing stub upload fixtures…');
  const demoUploadsDir = path.resolve(__dirname, '..', 'uploads', 'demo');
  if (fs.existsSync(demoUploadsDir)) {
    try {
      fs.rmSync(demoUploadsDir, { recursive: true });
      console.log(`  ✓ Deleted uploads/demo directory`);
    } catch (err) {
      console.log(`  ⚠ Could not delete uploads/demo: ${err.message}`);
    }
  } else {
    console.log('  ℹ uploads/demo not found — skipping');
  }

  // ── 6. Reset LabelGrid fields on any remaining artists/releases ─────────────
  // These are safe to keep — they will not cause duplicate creation on retry.
  // We do NOT reset them as existing records with labelgridArtistId are harmless.

  console.log(`\n✅ Done. Total documents removed: ${totalRemoved}`);
  console.log('\n💡 Real user accounts and any data they created have been preserved.');
  console.log('   The system is now clean and ready for real LabelGrid operations.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
