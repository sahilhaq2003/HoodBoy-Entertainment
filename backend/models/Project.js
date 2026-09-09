const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['album', 'ep', 'single', 'mixtape', 'compilation'],
    default: 'single'
  },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'waiting_approval', 'completed', 'delayed', 'cancelled'],
    default: 'not_started'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  releaseDate: { type: Date },
  startDate: { type: Date },
  budget: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String, default: '' },
  coverArt: { type: String, default: '' },
  notes: { type: String, default: '' },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
