const mongoose = require('../lib/mysql-orm');

const emailNotificationSchema = new mongoose.Schema({
  recipientEmail: { type: String, required: true, lowercase: true, trim: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notificationType: { type: String, required: true, trim: true },
  subject: { type: String, required: true },
  templateName: { type: String, required: true },
  templateData: { type: mongoose.Schema.Types.Mixed, default: {} },
  relatedEntityType: { type: String, default: '' },
  relatedEntityId: { type: String, default: '' },
  providerMessageId: { type: String, default: '' },
  deliveryStatus: { type: String, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending' },
  retryCount: { type: Number, min: 0, default: 0 },
  maxRetries: { type: Number, min: 0, default: 3 },
  nextAttemptAt: { type: Date, default: Date.now },
  lastError: { type: String, default: '' },
  dedupeKey: { type: String, required: true, unique: true, maxlength: 191 },
  acceptedAt: { type: Date },
  sentAt: { type: Date },
}, { timestamps: true, collection: 'email_notifications' });

emailNotificationSchema.index({ deliveryStatus: 1, nextAttemptAt: 1 });
emailNotificationSchema.index({ recipientEmail: 1, createdAt: -1 });

module.exports = mongoose.model('EmailNotification', emailNotificationSchema);
