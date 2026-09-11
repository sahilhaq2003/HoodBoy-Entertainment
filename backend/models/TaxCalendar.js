const mongoose = require('mongoose');

const taxCalendarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ['filing', 'payment', 'estimated', 'extension', 'tax_filing', 'estimated_tax', 'tax_deadline', 'tax_return', 'audit', 'compliance', 'other'],
    required: true,
  },
  description: { type: String, default: '' },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['upcoming', 'completed', 'overdue', 'extended'], default: 'upcoming' },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  year: { type: Number, required: true },
  quarter: { type: Number },
  month: { type: Number },
  amount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  assignedTo: { type: String, default: '' },
  recurring: { type: Boolean, default: false },
  recurringFrequency: { type: String, enum: ['monthly', 'quarterly', 'semi_annual', 'annual', ''], default: '' },
  recurrencePattern: { type: String, enum: ['monthly', 'quarterly', 'annual', ''], default: '' },
  tags: { type: [String], default: [] },
}, { timestamps: true });

taxCalendarSchema.index({ year: 1, dueDate: 1 });
taxCalendarSchema.index({ completed: 1 });

module.exports = mongoose.model('TaxCalendar', taxCalendarSchema);
