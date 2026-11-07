const mongoose = require('../lib/mysql-orm');

const emailSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  enabled: { type: Boolean, default: true },
  bookingNotifications: { type: Boolean, default: true },
  distributionNotifications: { type: Boolean, default: true },
  systemAlerts: { type: Boolean, default: true },
  adminRecipients: [{ type: String }],
  reminderHours: { type: Number, min: 1, max: 168, default: 24 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, collection: 'email_settings' });

module.exports = mongoose.model('EmailSettings', emailSettingsSchema);
