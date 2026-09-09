const mongoose = require('mongoose');

const DEFAULT_PRODUCTION_WORKFLOW = [
  { step: 'beat_selected', label: 'Beat Selected', order: 1 },
  { step: 'beat_ownership_verified', label: 'Beat Ownership Verified', order: 2 },
  { step: 'concept_approved', label: 'Song Concept Approved', order: 3 },
  { step: 'lyrics_written', label: 'Lyrics Written', order: 4 },
  { step: 'demo_recorded', label: 'Demo Recorded', order: 5 },
  { step: 'final_vocals_recorded', label: 'Final Vocals Recorded', order: 6 },
  { step: 'editing_completed', label: 'Editing Completed', order: 7 },
  { step: 'mixing_completed', label: 'Mixing Completed', order: 8 },
  { step: 'mastering_completed', label: 'Mastering Completed', order: 9 },
  { step: 'alternate_versions_created', label: 'Alternate Versions Created', order: 10 },
  { step: 'files_backed_up', label: 'Files Backed Up', order: 11 },
  { step: 'credits_confirmed', label: 'Credits Confirmed', order: 12 },
];

const songVersionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['explicit_master', 'clean_master', 'instrumental', 'performance_version', 'acappella', 'radio_edit', 'stems', 'wav_high_quality', 'reference_mp3'],
    required: true,
  },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  format: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' },
}, { _id: true });

const productionStepSchema = new mongoose.Schema({
  step: {
    type: String,
    enum: [
      'beat_selected', 'beat_ownership_verified', 'concept_approved',
      'lyrics_written', 'demo_recorded', 'final_vocals_recorded',
      'editing_completed', 'mixing_completed', 'mastering_completed',
      'alternate_versions_created', 'files_backed_up', 'credits_confirmed',
    ],
    required: true,
  },
  label: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'blocked'],
    default: 'pending',
  },
  completedAt: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' },
  order: { type: Number, required: true },
}, { _id: true });

const songSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  album: { type: String, default: '' },
  genre: { type: String, default: '' },
  duration: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['demo', 'in_production', 'mixing', 'mastering', 'awaiting_approval', 'approved', 'released', 'shelved'],
    default: 'demo'
  },
  releaseDate: { type: Date },
  producedBy: { type: String, default: '' },
  writtenBy: { type: String, default: '' },
  isrc: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  coverArt: { type: String, default: '' },
  streams: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  // Music Creation System - 12-step production workflow
  productionWorkflow: [productionStepSchema],
  // Music Creation System - Required song versions
  versions: [songVersionSchema],
  // Credits
  credits: [{
    name: { type: String, required: true },
    role: { type: String, enum: ['songwriter', 'composer', 'producer', 'engineer', 'mixer', 'masterer', 'featured_artist', 'vocalist', 'musician', 'other'], required: true },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    notes: { type: String, default: '' },
  }],
  // Beat info
  beatInfo: {
    producer: { type: String, default: '' },
    beatPurchaseDate: { type: Date },
    licenseType: { type: String, enum: ['exclusive', 'non_exclusive', 'lease', 'work_for_hire', 'custom', ''], default: '' },
    licenseFile: { type: String, default: '' },
    ownershipVerified: { type: Boolean, default: false },
  },
}, { timestamps: true });

songSchema.statics.buildProductionWorkflow = () => DEFAULT_PRODUCTION_WORKFLOW.map(step => ({ ...step }));

songSchema.index({ artist: 1, status: 1 });
songSchema.index({ streams: -1 });

// Auto-initialize the production workflow on new and legacy songs.
songSchema.pre('validate', function () {
  if (this.isNew && this.productionWorkflow.length === 0) {
    this.productionWorkflow = DEFAULT_PRODUCTION_WORKFLOW.map(step => ({ ...step }));
  }
});

module.exports = mongoose.model('Song', songSchema);
