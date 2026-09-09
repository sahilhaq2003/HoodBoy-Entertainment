const mongoose = require('mongoose');

const songMetadataSchema = new mongoose.Schema({
  songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true, unique: true },
  // Core metadata
  title: { type: String, required: true, trim: true },
  version: { type: String, default: 'Original' },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  album: { type: String, default: '' },
  genre: { type: String, default: '' },
  subgenre: { type: String, default: '' },
  mood: { type: String, default: '' },
  bpm: { type: Number, min: 0, max: 999 },
  key: { type: String, default: '' },
  language: { type: String, default: 'English' },
  label: { type: String, default: 'HoodBoy Entertainment' },
  releaseDate: { type: Date },
  lyrics: { type: String, default: '' },
  contactInformation: {
    name: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    phone: { type: String, default: '' },
  },
  // Rights & identifiers
  isrc: { type: String, default: '' },
  upc: { type: String, default: '' },
  iswc: { type: String, default: '' },
  copyright: { type: String, default: '' },
  copyrightOwner: { type: String, default: '' },
  copyrightYear: { type: Number },
  // Publishing
  publisher: { type: String, default: '' },
  proAffiliation: { type: String, default: '' },
  writerSplit: { type: String, default: '' },
  publishers: [{
    name: { type: String, required: true, trim: true },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    proAffiliation: { type: String, default: '' },
    ipi: { type: String, default: '' },
  }],
  // Streaming platform IDs
  streamingPlatforms: {
    spotifyUri: { type: String, default: '' },
    spotifyId: { type: String, default: '' },
    appleMusicId: { type: String, default: '' },
    appleMusicUri: { type: String, default: '' },
    youtubeMusicId: { type: String, default: '' },
    amazonMusicId: { type: String, default: '' },
    tidalId: { type: String, default: '' },
    deezerId: { type: String, default: '' },
    soundcloudId: { type: String, default: '' },
    tidalUrl: { type: String, default: '' },
  },
  // Pre-save link
  preSaveLink: { type: String, default: '' },
  // Distribution
  distributionDate: { type: Date },
  distributionPlatform: { type: String, default: '' },
  preSaveDate: { type: Date },
  // Technical
  audioFormat: { type: String, enum: ['wav', 'flac', 'mp3', 'aac', 'other', ''], default: '' },
  sampleRate: { type: String, default: '' },
  bitDepth: { type: String, default: '' },
  isExplicit: { type: Boolean, default: false },
  // Credits
  credits: [{
    name: { type: String, required: true },
    role: { type: String, enum: ['songwriter', 'composer', 'producer', 'engineer', 'mixer', 'masterer', 'featured_artist', 'vocalist', 'musician', 'other'], required: true },
    percentage: { type: Number, default: 0 },
  }],
  // Validation
  validationStatus: {
    type: String,
    enum: ['valid', 'incomplete', 'needs_review', 'unvalidated'],
    default: 'unvalidated'
  },
  validationErrors: [{ type: String }],
  lastValidatedAt: { type: Date },
  // Export
  exportFormats: [{ format: String, exportedAt: Date, fileUrl: String }],
  notes: { type: String, default: '' },
}, { timestamps: true });

// Validation method
songMetadataSchema.methods.validateMetadata = function () {
  const errors = [];
  const required = ['title', 'version', 'artist', 'genre', 'language', 'label', 'isrc', 'upc', 'copyrightOwner', 'releaseDate', 'lyrics'];
  for (const field of required) {
    if (!this[field]) errors.push(`Missing required field: ${field}`);
  }
  const normalizedIsrc = String(this.isrc || '').replace(/[-\s]/g, '').toUpperCase();
  if (this.isrc && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(normalizedIsrc)) errors.push('ISRC must contain a valid 12-character code');
  if (this.upc && !/^\d{12,13}$/.test(String(this.upc).replace(/\s/g, ''))) errors.push('UPC must contain 12 or 13 digits');
  if (!this.bpm || this.bpm <= 0) errors.push('BPM is required');
  if (!this.key) errors.push('Musical key is required');
  if (!this.contactInformation?.email) errors.push('Contact email is required');
  else if (!/^\S+@\S+\.\S+$/.test(this.contactInformation.email)) errors.push('Contact email is invalid');
  const credits = this.credits || [];
  if (!credits.some(c => c.role === 'songwriter' || c.role === 'composer')) errors.push('At least one writer is required');
  if (!credits.some(c => c.role === 'producer')) errors.push('At least one producer is required');
  const writers = credits.filter(c => c.role === 'songwriter' || c.role === 'composer');
  const writerTotal = writers.reduce((sum, credit) => sum + (credit.percentage || 0), 0);
  if (writers.length && writerTotal !== 100) errors.push(`Writer percentages total ${writerTotal}%, should be 100%`);
  const publisherTotal = (this.publishers || []).reduce((sum, publisher) => sum + (publisher.percentage || 0), 0);
  if (!this.publishers?.length) errors.push('At least one publisher is required (use self-published when applicable)');
  if (this.publishers?.length && publisherTotal !== 100) errors.push(`Publisher percentages total ${publisherTotal}%, should be 100%`);
  this.validationStatus = errors.length === 0 ? 'valid' : 'incomplete';
  this.validationErrors = errors;
  this.lastValidatedAt = new Date();
  return { valid: errors.length === 0, errors };
};

songMetadataSchema.index({ isrc: 1 });

module.exports = mongoose.model('SongMetadata', songMetadataSchema);
