const mongoose = require('mongoose');

const budgetItemSchema = new mongoose.Schema({
  category: { type: String, required: true },
  label: { type: String, required: true },
  budgeted: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  notes: { type: String, default: '' },
});

const budgetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  year: { type: Number, required: true },
  quarter: { type: Number },
  totalBudget: { type: Number, required: true },
  items: [budgetItemSchema],
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  release: { type: mongoose.Schema.Types.ObjectId, ref: 'Release' },
  department: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'approved', 'active', 'closed'],
    default: 'draft'
  },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

budgetSchema.pre('validate', function validateBudget(next) {
  if (this.items?.some(item => item.budgeted < 0 || item.spent < 0)) return next(new Error('Budget amounts cannot be negative'));
  if (this.items?.length) this.totalBudget = this.items.reduce((sum, item) => sum + (item.budgeted || 0), 0);
  next();
});

module.exports = mongoose.model('Budget', budgetSchema);
