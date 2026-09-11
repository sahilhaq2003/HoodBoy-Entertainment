/**
 * Removes all demo data that was created by scripts/seedDemo.js.
 *
 * Safe: only deletes documents whose _ids were recorded in the `_demomarkers`
 * collection at seed time. Real records are never touched.
 *
 * Run:  node scripts/clearDemo.js   (from the backend directory)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

require('../models/User');
require('../models/Artist');
require('../models/Song');
require('../models/Release');
require('../models/Project');
require('../models/Task');
require('../models/Finance');
require('../models/Budget');
require('../models/Contract');
require('../models/ContractTemplate');
require('../models/Campaign');
require('../models/Contact');
require('../models/RoyaltyLedger');
require('../models/ArtistBalance');
require('../models/TaxCalendar');
require('../models/Ownership');
require('../models/SongMetadata');
require('../models/PerSongAnalytics');
require('../models/ArtistDevelopment');
require('../models/WeeklyReport');
require('../models/File');
require('../models/Folder');
require('../models/FileVersion');
require('../models/Notification');
require('../models/Activity');
require('../models/LnkUp');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hbe_label', {
      serverSelectionTimeoutMS: 10000,
    });

    const col = mongoose.connection.collection('_demomarkers');
    const markers = await col.find({}).toArray();

    if (!markers.length) {
      console.log('No demo data found. Nothing to remove.');
      await mongoose.disconnect();
      return;
    }

    let total = 0;
    for (const m of markers) {
      const Model = mongoose.models[m.model];
      if (!Model || !Array.isArray(m.ids) || !m.ids.length) continue;
      const res = await Model.deleteMany({ _id: { $in: m.ids } });
      total += res.deletedCount;
      console.log(`  ${m.model}: ${res.deletedCount} removed`);
    }

    await col.deleteMany({});
    console.log(`\nDone. ${total} demo documents removed and markers cleared.`);
  } catch (err) {
    console.error('Clear failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();