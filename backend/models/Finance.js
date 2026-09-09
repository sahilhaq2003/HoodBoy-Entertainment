const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'streaming_revenue', 'royalty_income', 'sync_licensing', 'merchandise', 'touring_live',
      'brand_partnerships', 'publishing_income', 'mechanical_rights', 'performance_rights',
      'digital_sales', 'physical_sales', 'advances_received', 'other_income',
      'sound_recording_royalties', 'beat_sales', 'studio_services', 'shows',
      'features', 'sponsorships', 'youtube', 'direct_fan_sales',
      'production', 'recording', 'mixing_mastering', 'marketing_advertising', 'distribution',
      'legal_fees', 'studio_rental', 'equipment', 'salaries', 'touring_expenses',
      'travel', 'office', 'software_subscriptions', 'insurance', 'taxes',
      'artist_advances', 'consulting', 'contractor_payments', 'other_expense'
    ],
    required: true
  },
  subcategory: { type: String, default: '' },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  release: { type: mongoose.Schema.Types.ObjectId, ref: 'Release' },
  department: { type: String, enum: ['executive', 'a_and_r', 'production', 'marketing', 'distribution', 'publishing', 'legal', 'finance', 'touring', 'merchandise', 'operations', 'other', ''], default: '' },
  counterparty: { type: String, default: '', trim: true },
  date: { type: Date, default: Date.now },
  month: { type: Number },
  year: { type: Number },
  quarter: { type: Number },
  invoiceNumber: { type: String, default: '' },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'credit_card', 'cash', 'check', 'paypal', 'stripe', 'wire', 'other', ''],
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled', 'partial'],
    default: 'paid'
  },
  paymentDue: { type: Date },
  paidAt: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  receiptUrl: { type: String, default: '' },
  receiptFileName: { type: String, default: '' },
  invoiceUrl: { type: String, default: '' },
  invoiceFileName: { type: String, default: '' },
  accountName: { type: String, default: '' },
  accountLast4: { type: String, default: '' },
  taxDeductible: { type: Boolean, default: false },
  tags: [{ type: String }],
  notes: { type: String, default: '' },
  isRecurring: { type: Boolean, default: false },
  recurringFrequency: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'annual', ''], default: '' },
}, { timestamps: true });

financeSchema.pre('save', function () {
  if (!Number.isFinite(this.amount) || this.amount <= 0) throw new Error('Transaction amount must be greater than zero');
  if (this.date) {
    this.month = this.date.getMonth() + 1;
    this.year = this.date.getFullYear();
    this.quarter = Math.ceil(this.month / 3);
  }
});

financeSchema.index({ year: 1, type: 1 });
financeSchema.index({ type: 1, category: 1 });
financeSchema.index({ artist: 1, type: 1 });
financeSchema.index({ date: 1 });
financeSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Finance', financeSchema);
