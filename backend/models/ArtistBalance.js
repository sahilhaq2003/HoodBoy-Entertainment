const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['royalty_payment', 'advance', 'recoupment', 'adjustment', 'expense', 'other'],
    required: true,
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, default: 0 },
  description: { type: String, default: '' },
  reference: { type: String, default: '' },
  date: { type: Date, required: true },
  notes: { type: String, default: '' },
}, { _id: true });

const artistBalanceSchema = new mongoose.Schema({
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  currentBalance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  totalAdvances: { type: Number, default: 0 },
  advanceRemaining: { type: Number, default: 0 },
  lastPaymentDate: { type: Date },
  lastStatementDate: { type: Date },
  transactions: [transactionSchema],
  notes: { type: String, default: '' },
}, { timestamps: true });

artistBalanceSchema.index({ artist: 1 });

module.exports = mongoose.model('ArtistBalance', artistBalanceSchema);