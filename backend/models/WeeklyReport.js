const mongoose = require('mongoose');

const weeklyReportSchema = new mongoose.Schema({
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  completed: { type: String, default: '' },
  stillOpen: { type: String, default: '' },
  blocked: { type: String, default: '' },
  needsApproval: { type: String, default: '' },
  dueThisWeek: { type: String, default: '' },
  biggestRisk: { type: String, default: '' },
  nextActionOwner: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

weeklyReportSchema.index({ weekStart: -1 });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);
