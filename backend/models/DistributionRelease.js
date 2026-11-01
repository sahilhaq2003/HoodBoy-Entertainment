const mongoose = require('../lib/mysql-orm');

const contributorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, enum: ['primary_artist', 'featured_artist', 'producer', 'songwriter', 'composer'], required: true },
}, { _id: false });

const distributionTrackSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  version: { type: String, default: 'Original' },
  audioUrl: { type: String, default: '' },
  audioFileName: { type: String, default: '' },
  isrc: { type: String, trim: true, uppercase: true, default: '' },
  explicit: { type: Boolean, default: false },
  language: { type: String, default: 'English' },
  genre: { type: String, default: '' },
  contributors: [contributorSchema],
  copyright: { type: String, default: '' },
  durationSeconds: { type: Number, min: 0, default: 0 },
  trackNumber: { type: Number, min: 1 },
  discNumber: { type: Number, min: 1, default: 1 },
  compositionType: { type: String, enum: ['Original', 'Cover', 'original_composition', 'cover_song', 'public_domain'], default: 'Original' },
  copyrightType: { type: String, enum: ['Original', 'Licensed'], default: 'Original' },
  instrumental: { type: Boolean, default: false },
  rightsProofUrl: { type: String, default: '' },
  writers: [{ type: String, trim: true }],
  composers: [{ type: String, trim: true }],
  producers: [{ type: String, trim: true }],
  mixingEngineers: [{ type: String, trim: true }],
  masteringEngineers: [{ type: String, trim: true }],
  // DistriBeats-documented per-track values (GET /catalogue: aiUsage, performerRoles).
  aiUsage: { type: String, enum: ['None', 'Partial', 'Full'], default: 'None' },
  iswc: { type: String, trim: true, uppercase: true, default: '' },
  previewStart: { type: String, default: '' },
  featuredArtists: [{ type: String, trim: true }],
  performers: [{ name: { type: String, trim: true }, role: { type: String, trim: true } }],
  // Catalog track this was imported from. The source Song record is never modified.
  sourceSong: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
  audioSizeBytes: { type: Number, min: 0, default: 0 },
  // Legacy AI fields kept so older drafts still load; aiUsage above is what is sent to DistriBeats.
  audioAiUsage: { type: String, enum: ['none', 'some', 'material', 'all'], default: 'none' },
  compositionAiUsage: { type: String, enum: ['none', 'some', 'material', 'all'], default: 'none' },
  commercialSamples: { type: String, enum: ['no', 'exclusive', 'non_exclusive'], default: 'no' },
  distribeatsTrackId: { type: String, default: '' },
  uploadStatus: { type: String, enum: ['preparing', 'uploading', 'processing', 'uploaded', 'failed'], default: 'preparing' },
  // QC Fields
  sampleStatus: { type: String, enum: ['no', 'yes_cleared', 'yes_clearance_required', 'unsure'], default: 'no' },
  audioQcResult: { type: mongoose.Schema.Types.Mixed },
  duplicateQcResult: { type: mongoose.Schema.Types.Mixed },
  fingerprintResult: { type: mongoose.Schema.Types.Mixed },
  audioStreamHash: { type: String, default: '' },
  internalFingerprint: { type: String, default: '' }
}, { timestamps: true });

const distributionReleaseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  type: { type: String, enum: ['single', 'ep', 'album'], default: 'single' },
  featuringArtists: [{ type: String, trim: true }],
  producer: { type: String, default: '' },
  songwriters: [{ type: String, trim: true }],
  composers: [{ type: String, trim: true }],
  genre: { type: String, required: true },
  subGenre: { type: String, default: '' },
  mixingEngineers: [{ type: String, trim: true }],
  masteringEngineers: [{ type: String, trim: true }],
  spotifyArtistUrl: { type: String, default: '' },
  aiDocumentUrl: { type: String, default: '' },
  attestations: {
    age: { type: Boolean, default: false },
    rights: { type: Boolean, default: false },
  },
  language: { type: String, default: 'English' },
  releaseDate: { type: Date, required: true },
  explicit: { type: Boolean, default: false },
  upc: { type: String, trim: true, uppercase: true, default: '' },
  copyright: { type: String, required: true },
  territories: [{ type: String, trim: true, uppercase: true }],
  excludedTerritories: [{ type: String, trim: true, uppercase: true }],
  // true = worldwide (minus excludedTerritories); false = only the listed territories.
  worldwide: { type: Boolean, default: true },
  originalReleaseDate: { type: Date },
  distributionMode: { type: String, enum: ['new_release', 'catalog_transfer'], default: 'new_release' },
  sourceDistributor: { type: String, trim: true, default: '' },
  sourceReleaseUrl: { type: String, trim: true, default: '' },
  transferAcknowledged: { type: Boolean, default: false },
  bulkImportKey: { type: String, trim: true, maxlength: 191, default: '', index: true },
  bulkReleaseKey: { type: String, trim: true, maxlength: 120, default: '' },
  coverArtUrl: { type: String, default: '' },
  coverArtFileName: { type: String, default: '' },
  coverArtMeta: { type: mongoose.Schema.Types.Mixed },
  tracks: {
    type: [distributionTrackSchema],
    validate: { validator: value => Array.isArray(value) && value.length > 0, message: 'At least one track is required' },
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'processing', 'approved', 'delivered', 'live', 'rejected', 'takedown_requested', 'removed', 'error'],
    default: 'draft',
  },
  provider: { type: String, default: 'distribeats' },
  providerReleaseId: { type: String, default: '' },
  distribeatsReleaseId: { type: String, default: '', index: true },
  
  // QC Fields
  qcStatus: {
    type: String,
    enum: ['pending_qc', 'qc_processing', 'action_required', 'manual_review', 'qc_passed', 'qc_failed', 'ready_for_distribution'],
    default: 'pending_qc'
  },
  rightsStatus: {
    type: String,
    enum: ['not_reviewed', 'documents_required', 'under_review', 'approved', 'rejected'],
    default: 'not_reviewed'
  },
  adminReviewNotes: { type: String, default: '' },
  qcHistory: [{
    action: String,
    status: String,
    notes: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }],
  distribeatsRawStatus: { type: String, default: '' },
  catalogNumber: { type: String, default: '', trim: true },
  publishingCopyright: { type: String, default: '' },
  artworkAiUsage: { type: String, enum: ['none', 'some', 'material', 'all'], default: 'none' },
  dspOutletIds: [{ type: String }],
  syncStatus: { type: String, enum: ['not_synced', 'syncing', 'synced', 'error'], default: 'not_synced' },
  lastSyncError: { type: String, default: '' },
  validationResult: { type: mongoose.Schema.Types.Mixed },
  uploadState: { artwork: { type: String, enum: ['preparing', 'uploading', 'uploaded', 'failed'], default: 'preparing' } },
  providerPayload: { type: mongoose.Schema.Types.Mixed },
  lastSyncedAt: { type: Date },
  submittedAt: { type: Date },
  deliveredAt: { type: Date },
  liveAt: { type: Date },
  rejectionReason: { type: String, default: '' },
  syncErrors: [{ message: String, code: String, occurredAt: { type: Date, default: Date.now }, resolvedAt: Date }],
  storeStatuses: [{ store: String, status: String, url: String, updatedAt: Date }],
  webhookEventKeys: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

distributionReleaseSchema.index({ artist: 1, createdAt: -1 });
distributionReleaseSchema.index({ status: 1, releaseDate: 1 });
distributionReleaseSchema.index({ syncStatus: 1, lastSyncedAt: 1 });
distributionReleaseSchema.index({ createdAt: -1 });
distributionReleaseSchema.index({ title: 'text', upc: 'text', providerReleaseId: 'text' });

module.exports = mongoose.model('DistributionRelease', distributionReleaseSchema);
