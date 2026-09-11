const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  type: {
    type: String,
    enum: ['document', 'image', 'audio', 'video', 'archive', 'other'],
    default: 'other',
  },
  category: {
    type: String,
    enum: [
      'master', 'instrumental', 'acapella', 'stems', 'mix', 'beat',
      'contract', 'invoice', 'receipt', 'legal', 'tax',
      'photo', 'artwork', 'video', 'content',
      'lyrics', 'metadata', 'split_sheet', 'producer_agreement',
      'marketing', 'press_kit', 'template', 'other',
    ],
    default: 'other',
  },
  tags: [{ type: String }],
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', default: null },
  songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', default: null },
  releaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Release', default: null },
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', default: null },
  financeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Finance', default: null },
  royaltyId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoyaltyLedger', default: null },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  version: { type: Number, default: 1 },
  versionNote: { type: String, default: '' },
  // Version history
  versionHistory: [{
    version: { type: Number, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    changeNote: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  }],
  // Backup tracking
  backup: {
    primary: { type: Boolean, default: true },
    cloud: { type: Boolean, default: false },
    external: { type: Boolean, default: false },
    checksum: { type: String, default: '' },
    primaryVerifiedAt: { type: Date },
    cloudVerifiedAt: { type: Date },
    externalVerifiedAt: { type: Date },
    lastBackupAt: { type: Date },
    lastError: { type: String, default: '' },
  },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  downloads: { type: Number, default: 0 },
  starred: { type: Boolean, default: false },
}, { timestamps: true });

fileSchema.index({ folderId: 1 });
fileSchema.index({ artistId: 1 });
fileSchema.index({ songId: 1 });
fileSchema.index({ releaseId: 1 });
fileSchema.index({ contractId: 1 });
fileSchema.index({ financeId: 1 });
fileSchema.index({ royaltyId: 1 });
fileSchema.index({ campaignId: 1 });
fileSchema.index({ contactId: 1 });
fileSchema.index({ projectId: 1 });
fileSchema.index({ name: 'text', tags: 'text' });
fileSchema.index({ category: 1 });

module.exports = mongoose.model('File', fileSchema);
