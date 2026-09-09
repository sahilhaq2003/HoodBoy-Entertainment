const mongoose = require('mongoose');

const artistBalanceSchema = new mongoose.Schema({
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  period: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  openingBalance: { type: Number, default: 0 },
  income: { type: Number, default: 0 },
  expenses: { type: Number, default: 0 },
  advances: { type: Number, default: 0 },
  royaltyPayments: { type: Number, default: 0 },
  closingBalance: { type: Number, default: 0 },
  transactions: [{
    description: { type: String, required: true },
    type: { type: String, enum: ['income', 'expense', 'advance', 'payment', 'adjustment'], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
  }],
  notes: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'reconciled', 'approved'], default: 'draft' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
}, { timestamps: true });

artistBalanceSchema.index({ artist: 1, period: 1 });
artistBalanceSchema.index({ artist: 1 });

module.exports = mongoose.model('ArtistBalance', artistBalanceSchema);
