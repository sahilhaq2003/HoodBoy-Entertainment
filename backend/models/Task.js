const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  editedAt: { type: Date },
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: {
    type: String,
    enum: ['created', 'assigned', 'unassigned', 'reassigned', 'status_changed', 'commented', 'updated'],
    required: true,
  },
  from: { type: String, default: '' },
  to: { type: String, default: '' },
  message: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

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
  comments: [commentSchema],
  activity: [activitySchema],
}, { timestamps: true });

taskSchema.index({ status: 1, deadline: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ deadline: 1 });

module.exports = mongoose.model('Task', taskSchema);
