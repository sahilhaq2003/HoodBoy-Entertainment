const mongoose = require('mongoose');

const monthlyScorecardSchema = new mongoose.Schema({
  month: { type: String, required: true },
  year: { type: Number, required: true },

  skillRatings: {
    musicQuality: { type: Number, min: 1, max: 10, default: 5 },
    songwriting: { type: Number, min: 1, max: 10, default: 5 },
    vocalAbility: { type: Number, min: 1, max: 10, default: 5 },
    stagePerformance: { type: Number, min: 1, max: 10, default: 5 },
    branding: { type: Number, min: 1, max: 10, default: 5 },
    visualIdentity: { type: Number, min: 1, max: 10, default: 5 },
    socialMediaConsistency: { type: Number, min: 1, max: 10, default: 5 },
    interviewSkills: { type: Number, min: 1, max: 10, default: 5 },
    fanEngagement: { type: Number, min: 1, max: 10, default: 5 },
    professionalBehavior: { type: Number, min: 1, max: 10, default: 5 },
  },

  metricScores: {
    songsCompleted: { type: Number, default: 0 },
    contentPosted: { type: Number, default: 0 },
    engagementGrowth: { type: Number, default: 0 },
    rehearsalsCompleted: { type: Number, default: 0 },
    deadlinesMet: { type: Number, default: 0 },
    revenueGenerated: { type: Number, default: 0 },
    audienceGrowth: { type: Number, default: 0 },
    teamCooperation: { type: Number, min: 1, max: 10, default: 5 },
  },

  goals: [{
    title: { type: String, required: true },
    target: { type: String },
    completed: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  }],

  improvements: [{ type: String }],
  comments: { type: String, default: '' },
  overallScore: { type: Number, min: 1, max: 10, default: 5 },
  scoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const developmentPlanSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },

  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'archived'],
    default: 'active',
  },

  goals: [{
    category: {
      type: String,
      enum: [
        'musicQuality', 'songwriting', 'vocalAbility', 'stagePerformance',
        'branding', 'visualIdentity', 'socialMediaConsistency', 'interviewSkills',
        'fanEngagement', 'professionalBehavior',
      ],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    targetDate: { type: Date },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    notes: { type: String, default: '' },
    milestones: [{
      title: { type: String, required: true },
      dueDate: { type: Date },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date },
      notes: { type: String, default: '' },
    }],
  }],

  // Per-skill improvement plans
  improvementPlans: [{
    skill: {
      type: String,
      enum: [
        'musicQuality', 'songwriting', 'vocalAbility', 'stagePerformance',
        'branding', 'visualIdentity', 'socialMediaConsistency', 'interviewSkills',
        'fanEngagement', 'professionalBehavior',
      ],
      required: true,
    },
    currentLevel: { type: Number, min: 1, max: 10, default: 5 },
    targetLevel: { type: Number, min: 1, max: 10, default: 7 },
    actions: [{ type: String }],
    resources: [{ type: String }],
    coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deadline: { type: Date },
    status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
    notes: { type: String, default: '' },
  }],

  focusAreas: [{ type: String }],
  notes: { type: String, default: '' },

  scorecards: [monthlyScorecardSchema],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

developmentPlanSchema.index({ artistId: 1 });

module.exports = mongoose.model('ArtistDevelopment', developmentPlanSchema);
