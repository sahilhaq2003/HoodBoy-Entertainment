const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  path: { type: String, required: true },
  icon: { type: String, default: 'folder' },
  color: { type: String, default: '#F59E0B' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

folderSchema.index({ parentId: 1 });
folderSchema.index({ path: 1 });

module.exports = mongoose.model('Folder', folderSchema);
