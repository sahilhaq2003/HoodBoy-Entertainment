const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['task_deadline', 'task_assigned', 'task_update', 'task_comment', 'approval_needed', 'payment_due', 'contract_expiry', 'release_scheduled', 'campaign_update', 'mention', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: '' },
  read: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
