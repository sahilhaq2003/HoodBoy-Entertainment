const mongoose = require('mongoose');

const taxCalendarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['filing', 'payment', 'estimated', 'extension', 'other'], required: true },
  description: { type: String, default: '' },
  dueDate: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  amount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  year: { type: Number, required: true },
  quarter: { type: Number },
  recurring: { type: Boolean, default: false },
  recurrencePattern: { type: String, enum: ['monthly', 'quarterly', 'annual', ''], default: '' },
}, { timestamps: true });

taxCalendarSchema.index({ year: 1, dueDate: 1 });
taxCalendarSchema.index({ completed: 1 });

module.exports = mongoose.model('TaxCalendar', taxCalendarSchema);
