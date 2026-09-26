const mongoose = require('mongoose');

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
  compositionType: { type: String, enum: ['original_composition', 'cover_song', 'public_domain'], default: 'original_composition' },
  audioAiUsage: { type: String, enum: ['none', 'some', 'material', 'all'], default: 'none' },
  compositionAiUsage: { type: String, enum: ['none', 'some', 'material', 'all'], default: 'none' },
  commercialSamples: { type: String, enum: ['no', 'exclusive', 'non_exclusive'], default: 'no' },
  labelgridTrackId: { type: String, default: '' },
  labelgridUploadAttemptId: { type: String, default: '' },
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
  language: { type: String, default: 'English' },
  releaseDate: { type: Date, required: true },
  explicit: { type: Boolean, default: false },
  upc: { type: String, trim: true, uppercase: true, default: '' },
  copyright: { type: String, required: true },
  territories: [{ type: String, trim: true, uppercase: true }],
  excludedTerritories: [{ type: String, trim: true, uppercase: true }],
  coverArtUrl: { type: String, default: '' },
  coverArtFileName: { type: String, default: '' },
  tracks: {
    type: [distributionTrackSchema],
    validate: { validator: value => Array.isArray(value) && value.length > 0, message: 'At least one track is required' },
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'processing', 'approved', 'delivered', 'live', 'rejected', 'takedown_requested', 'removed', 'error'],
    default: 'draft',
  },
  provider: { type: String, default: 'labelgrid' },
  providerReleaseId: { type: String, default: '' },
  labelgridReleaseId: { type: String, default: '', index: true },
  
  // QC Fields
  qcStatus: {
    type: String,
    enum: ['pending_qc', 'qc_processing', 'action_required', 'manual_review', 'qc_passed', 'qc_failed', 'ready_for_labelgrid'],
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
  labelgridRawStatus: { type: String, default: '' },
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
distributionReleaseSchema.index({ title: 'text', upc: 'text', providerReleaseId: 'text' });

module.exports = mongoose.model('DistributionRelease', distributionReleaseSchema);
