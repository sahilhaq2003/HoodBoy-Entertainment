const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  item: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'blocked', 'skipped'],
    default: 'pending',
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: { type: Date },
  completedAt: { type: Date },
  notes: { type: String, default: '' },
  order: { type: Number, default: 0 },
}, { _id: true });

const releaseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  songs: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
    validate: { validator: value => Array.isArray(value) && value.length > 0, message: 'A release must include at least one song' },
  },
  releaseDate: { type: Date, required: true },
  type: {
    type: String,
    enum: ['album', 'ep', 'single', 'mixtape', 'compilation'],
    default: 'single',
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_preparation', 'submitted', 'approved', 'released', 'delayed', 'cancelled'],
    default: 'scheduled',
  },
  currentPhase: {
    type: String,
    enum: ['preparation', 'distribution', 'marketing', 'post_release', 'completed'],
    default: 'preparation',
  },
  phases: {
    preparation: {
      completed: { type: Boolean, default: false },
      startedAt: { type: Date },
      completedAt: { type: Date },
      checklist: [checklistItemSchema],
    },
    distribution: {
      completed: { type: Boolean, default: false },
      startedAt: { type: Date },
      completedAt: { type: Date },
      checklist: [checklistItemSchema],
    },
    marketing: {
      completed: { type: Boolean, default: false },
      startedAt: { type: Date },
      completedAt: { type: Date },
      checklist: [checklistItemSchema],
    },
    post_release: {
      completed: { type: Boolean, default: false },
      startedAt: { type: Date },
      completedAt: { type: Date },
      checklist: [checklistItemSchema],
    },
  },
  ownershipConfirmed: { type: Boolean, default: false },
  masterApproved: { type: Boolean, default: false },
  artworkApproved: { type: Boolean, default: false },
  metadataComplete: { type: Boolean, default: false },
  platforms: [{
    name: { type: String },
    status: { type: String, enum: ['pending', 'submitted', 'live', 'rejected'], default: 'pending' },
    link: { type: String, default: '' },
    submittedAt: { type: Date },
    liveAt: { type: Date },
  }],
  marketingBudget: { type: Number, default: 0 },
  coverArt: { type: String, default: '' },
  upc: { type: String, default: '' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  notes: { type: String, default: '' },
  genre: { type: String, default: '' },
  language: { type: String, default: 'English' },
  explicit: { type: Boolean, default: false },
  preSaveLink: { type: String, default: '' },
  pressReleaseUrl: { type: String, default: '' },
}, { timestamps: true });

releaseSchema.index({ artist: 1 });
releaseSchema.index({ status: 1 });
releaseSchema.index({ currentPhase: 1 });
releaseSchema.index({ releaseDate: 1 });
releaseSchema.index({ status: 1, releaseDate: 1 });
releaseSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Release', releaseSchema);
