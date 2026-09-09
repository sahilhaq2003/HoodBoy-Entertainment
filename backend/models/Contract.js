const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  type: {
    type: String,
    enum: [
      'artist_agreement', 'producer_agreement', 'beat_license', 'split_sheet',
      'featured_artist', 'work_for_hire', 'video_release', 'photo_release',
      'contractor', 'nda', 'sync_license', 'merchandise',
      'recording', 'publishing', 'distribution', 'management', 'licensing', 'endorsement',
    ],
    default: 'artist_agreement',
  },
  status: {
    type: String,
    enum: ['draft', 'pending_signature', 'active', 'expired', 'terminated', 'renewed'],
    default: 'draft',
  },
  parties: [{
    name: { type: String },
    role: { type: String },
    entity: { type: String },
  }],
  signedDate: { type: Date },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  renewalDate: { type: Date },
  renewalDeadline: { type: Date },
  renewalNoticeDays: { type: Number, default: 30 },
  autoRenew: { type: Boolean, default: false },
  optionPeriods: [{
    label: { type: String, trim: true },
    durationMonths: { type: Number, min: 1, default: 12 },
    exerciseDeadline: { type: Date },
    exercised: { type: Boolean, default: false },
    exercisedAt: { type: Date },
    notes: { type: String, default: '' },
  }],
  value: { type: Number, default: 0 },
  royaltyRate: { type: Number, default: 0 },
  recoupment: {
    type: { type: String, enum: ['none', 'recoupable', 'partially_recoupable', 'cross_collateralized'], default: 'none' },
    advanceAmount: { type: Number, default: 0 },
    advancePaid: { type: Boolean, default: false },
    recoupmentRate: { type: Number, default: 100 },
    notes: { type: String, default: '' },
  },
  ownershipTerms: { type: String, default: '' },
  paymentObligations: {
    advanceAmount: { type: Number, default: 0 },
    advancePaid: { type: Boolean, default: false },
    royaltyFrequency: { type: String, enum: ['monthly', 'quarterly', 'semi_annual', 'annual'], default: 'quarterly' },
    minimumGuarantee: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  managedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  terms: { type: String, default: '' },
  notes: { type: String, default: '' },
  tags: [{ type: String }],
  // Expiration notification scheduling
  expirationNotifications: [{
    daysBefore: { type: Number, required: true },
    notifiedAt: { type: Date },
    notifiedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notified: { type: Boolean, default: false },
  }],
  renewalHistory: [{
    renewedAt: { type: Date, required: true },
    previousEndDate: { type: Date },
    newEndDate: { type: Date },
    renewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
  }],
}, { timestamps: true });

contractSchema.index({ artist: 1 });
contractSchema.index({ type: 1 });
contractSchema.index({ status: 1 });
contractSchema.index({ endDate: 1 });
contractSchema.index({ renewalDeadline: 1 });

contractSchema.pre('validate', function validateContractDates(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error('Expiration date must be on or after the start date'));
  }
  if (this.royaltyRate < 0 || this.royaltyRate > 100) {
    return next(new Error('Royalty percentage must be between 0 and 100'));
  }
  next();
});

module.exports = mongoose.model('Contract', contractSchema);
