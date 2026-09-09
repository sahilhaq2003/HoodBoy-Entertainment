const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true },
  entityType: { type: String, enum: ['artist', 'song', 'project', 'release', 'contract', 'campaign', 'task', 'finance', 'contact', 'file', 'metadata', 'user', 'other'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  entityName: { type: String, default: '' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: '' },
  details: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

activitySchema.index({ entityType: 1, entityId: 1 });
activitySchema.index({ user: 1 });
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
