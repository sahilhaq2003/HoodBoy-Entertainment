const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema({
  file: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  versionNumber: { type: Number, required: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  changeNote: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

fileVersionSchema.index({ file: 1, versionNumber: -1 });

module.exports = mongoose.model('FileVersion', fileVersionSchema);
