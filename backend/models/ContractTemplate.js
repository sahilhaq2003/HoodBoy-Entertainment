const mongoose = require('mongoose');

const contractTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: [
      'artist_agreement', 'producer_agreement', 'beat_license', 'split_sheet',
      'featured_artist', 'work_for_hire', 'video_release', 'photo_release',
      'contractor', 'nda', 'sync_license', 'merchandise',
    ],
    required: true,
  },
  description: { type: String, default: '' },
  content: { type: String, default: '' }, // Template body text or HTML
  clauses: [{
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: { type: String, enum: ['standard', 'optional', 'conditional'], default: 'standard' },
    order: { type: Number, default: 0 },
  }],
  defaultTerms: {
    duration: { type: Number, default: 12 }, // months
    renewalTerm: { type: Number, default: 12 },
    royaltyRate: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },
    recoupmentType: { type: String, enum: ['none', 'recoupable', 'partially_recoupable', 'cross_collateralized'], default: 'none' },
    notes: { type: String, default: '' },
  },
  isActive: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('ContractTemplate', contractTemplateSchema);
