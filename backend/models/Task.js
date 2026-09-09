const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  relatedArtist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  deadline: { type: Date, required: true },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'waiting_approval', 'completed', 'delayed', 'blocked'],
    default: 'not_started',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  category: {
    type: String,
    enum: ['production', 'marketing', 'finance', 'legal', 'distribution', 'general'],
    default: 'general',
  },
  deliverable: { type: String, default: '' },
  tags: [{ type: String }],
  completedAt: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true });

taskSchema.index({ status: 1, deadline: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ deadline: 1 });

module.exports = mongoose.model('Task', taskSchema);
