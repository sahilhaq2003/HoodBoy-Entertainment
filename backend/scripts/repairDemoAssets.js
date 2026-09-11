/**
 * Repairs physical demo fixtures and legacy demo File/Folder paths without
 * touching non-demo records. Safe scope comes from the _demomarkers collection.
 * Run from backend: node scripts/repairDemoAssets.js
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Folder = require('../models/Folder');
const File = require('../models/File');
const FileVersion = require('../models/FileVersion');
const Song = require('../models/Song');
const { ensureDemoAssets } = require('./seedDemo');

const fileConfig = {
  'no-days-off-explicit.wav': { folder: 'Demo Masters', path: '/uploads/files/Demo Masters/no-days-off-explicit.wav', mimeType: 'audio/wav', type: 'audio' },
  'pressure-ref.mp3': { rename: 'pressure-ref.wav', folder: 'Demo Masters', path: '/uploads/files/Demo Masters/pressure-ref.wav', mimeType: 'audio/wav', type: 'audio' },
  'kalo-agreement.pdf': { folder: 'Demo Contracts', path: '/uploads/files/Demo Contracts/kalo-agreement.pdf', mimeType: 'application/pdf', type: 'document' },
  'gbedu.wav': { folder: 'Demo Masters', path: '/uploads/files/Demo Masters/gbedu.wav', mimeType: 'audio/wav', type: 'audio' },
  'no-days-off-art.jpg': { folder: 'Demo Artwork', path: '/uploads/files/Demo Artwork/no-days-off-art.jpg', mimeType: 'image/jpeg', type: 'image' },
  'invoice-1001.pdf': { folder: 'Demo Contracts', path: '/uploads/files/Demo Contracts/invoice-1001.pdf', mimeType: 'application/pdf', type: 'document' },
  'no-days-off.csv': { folder: 'Demo Masters', path: '/uploads/files/Demo Masters/no-days-off.csv', mimeType: 'text/csv', type: 'document' },
};

const diskPath = publicPath => path.resolve(__dirname, '..', publicPath.replace(/^\/uploads\//, 'uploads/'));
const checksum = filePath => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hbe_label', { serverSelectionTimeoutMS: 10000 });
  try {
    ensureDemoAssets();
    const markers = await mongoose.connection.collection('_demomarkers').find({ model: { $in: ['Folder', 'File', 'FileVersion', 'Song'] } }).toArray();
    const idsFor = model => markers.find(marker => marker.model === model)?.ids || [];
    const folderIds = idsFor('Folder');
    const fileIds = idsFor('File');
    const versionIds = idsFor('FileVersion');
    const songIds = idsFor('Song');
    if (!fileIds.length) throw new Error('No tracked demo files found. Run node scripts/seedDemo.js first.');

    const folders = await Folder.find({ _id: { $in: folderIds }, name: { $in: ['Demo Masters', 'Demo Contracts', 'Demo Artwork'] } });
    const folderMap = {};
    for (const folder of folders) {
      folder.path = `/files/${folder.name}`;
      await folder.save();
      folderMap[folder.name] = folder._id;
    }

    const files = await File.find({ _id: { $in: fileIds } });
    for (const file of files) {
      const config = fileConfig[file.name];
      if (!config) continue;
      const physical = diskPath(config.path);
      file.name = config.rename || file.name;
      file.originalName = file.name;
      file.path = config.path;
      file.folderId = folderMap[config.folder];
      file.mimeType = config.mimeType;
      file.type = config.type;
      file.size = fs.statSync(physical).size;
      file.backup.primary = true;
      file.backup.cloud = false;
      file.backup.external = false;
      file.backup.checksum = checksum(physical);
      file.backup.primaryVerifiedAt = new Date();
      file.backup.cloudVerifiedAt = undefined;
      file.backup.externalVerifiedAt = undefined;
      file.backup.lastError = '';
      await file.save();
    }

    const versions = await FileVersion.find({ _id: { $in: versionIds } }).sort({ versionNumber: 1 });
    for (const version of versions) {
      const name = version.versionNumber === 1 ? 'no-days-off-mix1.wav' : 'no-days-off-explicit.wav';
      version.fileName = name;
      version.fileUrl = `/uploads/files/Demo Masters/${name}`;
      version.fileSize = fs.statSync(diskPath(version.fileUrl)).size;
      await version.save();
    }

    const pressure = await Song.findOne({ _id: { $in: songIds }, title: 'Pressure' });
    if (pressure) {
      pressure.versions.forEach(version => {
        if (['pressure-ref.mp3', 'pressure-ref.wav'].includes(version.fileName)) {
          version.fileName = 'pressure-ref.wav';
          version.fileUrl = '/uploads/demo/pressure-ref.wav';
          version.format = 'wav';
          version.type = 'wav_high_quality';
          version.fileSize = fs.statSync(path.resolve(__dirname, '..', 'uploads', 'demo', 'pressure-ref.wav')).size;
        }
      });
      await pressure.save();
    }

    console.log(`Repaired ${files.length} demo file records, ${folders.length} folders, and ${versions.length} versions.`);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) run().catch(error => { console.error(`Repair failed: ${error.message}`); process.exitCode = 1; });

module.exports = { run };
