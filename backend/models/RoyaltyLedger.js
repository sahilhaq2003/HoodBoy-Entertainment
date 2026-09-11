const mongoose = require('mongoose');

const royaltyEntrySchema = new mongoose.Schema({
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  release: { type: mongoose.Schema.Types.ObjectId, ref: 'Release' },
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
  contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', default: null },
  ownership: { type: mongoose.Schema.Types.ObjectId, ref: 'Ownership', default: null },
  financeTransactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Finance' }],
  supportingFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  period: { type: String, required: true }, // e.g. "2026-Q2", "2026-06"
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  // Income breakdown
  grossIncome: { type: Number, default: 0, min: 0 },
  incomeBySource: {
    streaming: { type: Number, default: 0 },
    publishing: { type: Number, default: 0 },
    mechanical: { type: Number, default: 0 },
    performance: { type: Number, default: 0 },
    sync: { type: Number, default: 0 },
    merchandise: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  // Detailed royalty type breakdown
  royaltyBreakdown: {
    mechanical: {
      domestic: { type: Number, default: 0 },
      international: { type: Number, default: 0 },
      digital: { type: Number, default: 0 },
      physical: { type: Number, default: 0 },
    },
    performance: {
      broadcast: { type: Number, default: 0 },
      live: { type: Number, default: 0 },
      digitalPerformance: { type: Number, default: 0 },
      background: { type: Number, default: 0 },
    },
    sync: {
      film: { type: Number, default: 0 },
      tv: { type: Number, default: 0 },
      advertising: { type: Number, default: 0 },
      gaming: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
  },
  // Deductions
  distributorFees: { type: Number, default: 0, min: 0 },
  approvedDeductions: [{
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, enum: ['recoupable', 'non_recoupable', 'tax', 'other'], default: 'recoupable' },
    date: { type: Date, default: Date.now },
  }],
  totalDeductions: { type: Number, default: 0 },
  // Recoupment tracking
  recoupableExpenses: { type: Number, default: 0, min: 0 },
  totalRecouped: { type: Number, default: 0 },
  recoupedThisPeriod: { type: Number, default: 0 },
  remainingRecoupable: { type: Number, default: 0 },
  // Splits
  artistPercentage: { type: Number, default: 0, min: 0, max: 100 },
  labelPercentage: { type: Number, default: 0, min: 0, max: 100 },
  producerPercentage: { type: Number, default: 0, min: 0, max: 100 },
  featuredArtistPercentage: { type: Number, default: 0, min: 0, max: 100 },
  producerRoyalty: { type: Number, default: 0 },
  featuredArtistRoyalty: { type: Number, default: 0 },
  // Calculations
  netIncome: { type: Number, default: 0 },
  artistGrossShare: { type: Number, default: 0 },
  artistShare: { type: Number, default: 0 },
  labelShare: { type: Number, default: 0 },
  // Payments
  paymentsIssued: [{
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    method: { type: String, default: '' },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
  }],
  totalPaid: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 },
  // Status
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'paid', 'disputed'],
    default: 'draft',
  },
  calculatedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  notes: { type: String, default: '' },
  statementGenerated: { type: Boolean, default: false },
  statementUrl: { type: String, default: '' },
}, { timestamps: true });

royaltyEntrySchema.index({ artist: 1, period: 1 });
royaltyEntrySchema.index({ period: 1 });
royaltyEntrySchema.index({ status: 1 });
royaltyEntrySchema.index({ release: 1 });
royaltyEntrySchema.index({ contract: 1 });

royaltyEntrySchema.pre('validate', function validatePeriod() {
  if (this.periodStart && this.periodEnd && this.periodStart > this.periodEnd) {
    this.invalidate('periodEnd', 'Period end must be on or after period start');
  }
  if ((this.artistPercentage || 0) + (this.labelPercentage || 0) !== 100) {
    this.invalidate('labelPercentage', 'Artist and label percentages must total 100');
  }
  if ((this.producerPercentage || 0) + (this.featuredArtistPercentage || 0) > (this.artistPercentage || 0)) {
    this.invalidate('producerPercentage', 'Producer and featured artist percentages cannot exceed the artist percentage');
  }
  const sourceTotal = Object.values(this.incomeBySource?.toObject?.() || this.incomeBySource || {})
    .reduce((sum, amount) => sum + Number(amount || 0), 0);
  if (sourceTotal > 0 && Math.abs(sourceTotal - Number(this.grossIncome || 0)) > 0.01) {
    this.invalidate('grossIncome', 'Gross income must equal the income-by-source total');
  }
});

module.exports = mongoose.model('RoyaltyLedger', royaltyEntrySchema);
