const mongoose = require('../lib/mysql-orm');

const distribeatsWebhookEventSchema = new mongoose.Schema({
  deliveryId: { type: String, default: '', trim: true },
  event: { type: String, required: true, trim: true },
  status: { type: String, enum: ['processed', 'ignored', 'duplicate', 'failed'], default: 'processed' },
  release: { type: mongoose.Schema.Types.ObjectId, ref: 'DistributionRelease' },
  releaseTitle: { type: String, default: '' },
  remoteReleaseId: { type: String, default: '', trim: true },
  remoteStatus: { type: String, default: '' },
  message: { type: String, default: '' },
  receivedAt: { type: Date, default: Date.now },
}, { timestamps: true });

distribeatsWebhookEventSchema.index({ receivedAt: -1 });
distribeatsWebhookEventSchema.index({ deliveryId: 1 });
distribeatsWebhookEventSchema.index({ release: 1, receivedAt: -1 });

module.exports = mongoose.model('DistribeatsWebhookEvent', distribeatsWebhookEventSchema);
