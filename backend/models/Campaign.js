const mongoose = require('mongoose');

const contentItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  platform: { type: String, enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'spotify', 'email', 'radio', 'blog', 'other'], default: 'instagram' },
  contentType: { type: String, enum: ['post', 'story', 'reel', 'video', 'email', 'ad', 'article', 'interview', 'playlist', 'other'], default: 'post' },
  category: { type: String, enum: ['performance', 'lifestyle', 'behind_the_scenes', 'storytelling', 'educational', 'fan_interaction', 'promotional', 'personal_connection'], default: 'promotional' },
  scheduledDate: { type: Date },
  publishedDate: { type: Date },
  status: { type: String, enum: ['draft', 'scheduled', 'published', 'cancelled'], default: 'draft' },
  caption: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  link: { type: String, default: '' },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
}, { timestamps: true });

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['social_media', 'email', 'radio', 'pr', 'influencer', 'paid_ads', 'event', 'content', 'sync', 'brand', 'other'],
    default: 'social_media'
  },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  release: { type: mongoose.Schema.Types.ObjectId, ref: 'Release' },
  status: {
    type: String,
    enum: ['planned', 'active', 'paused', 'completed', 'cancelled'],
    default: 'planned'
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  budget: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  reach: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  engagement: { type: Number, default: 0 },
  costPerClick: { type: Number, default: 0 },
  costPerConversion: { type: Number, default: 0 },
  roi: { type: Number, default: 0 },
  attributedRevenue: { type: Number, min: 0, default: 0 },
  profit: { type: Number, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  goals: [{ type: String }],
  objective: { type: String, default: '' },
  targetAudience: { type: String, default: '' },
  mainStory: { type: String, default: '' },
  contentThemes: [{ type: String }],
  callsToAction: [{ type: String }],
  releaseDate: { type: Date },
  platforms: [{ type: String }],
  // Content category
  contentCategories: [{
    type: String,
    enum: ['performance', 'lifestyle', 'behind_the_scenes', 'storytelling', 'educational', 'fan_interaction', 'promotional', 'personal_connection'],
  }],
  // Content approval workflow
  approvalRequired: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  approvalNotes: { type: String, default: '' },
  contentItems: [contentItemSchema],
  contentTarget: { type: Number, min: 1, default: 20 },
  advertisingTests: [{
    name: { type: String, required: true, trim: true },
    platform: { type: String, default: '' },
    audience: { type: String, default: '' },
    creative: { type: String, default: '' },
    callToAction: { type: String, default: '' },
    budget: { type: Number, min: 0, default: 0 },
    spent: { type: Number, min: 0, default: 0 },
    impressions: { type: Number, min: 0, default: 0 },
    clicks: { type: Number, min: 0, default: 0 },
    conversions: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['planned', 'running', 'completed', 'stopped'], default: 'planned' },
    result: { type: String, default: '' },
  }],
  // Budget alerts
  budgetAlertThreshold: { type: Number, default: 80 }, // percentage
  budgetAlertTriggered: { type: Boolean, default: false },
  budgetAlertTriggeredAt: { type: Date },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  notes: { type: String, default: '' },
  tags: [{ type: String }],
}, { timestamps: true });

campaignSchema.index({ status: 1 });
campaignSchema.index({ artist: 1, status: 1 });
campaignSchema.index({ type: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });

campaignSchema.pre('validate', function validateCampaign(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) return next(new Error('Campaign end date must be on or after its start date'));
  this.profit = (this.attributedRevenue || 0) - (this.spent || 0);
  this.costPerClick = this.clicks > 0 ? this.spent / this.clicks : 0;
  this.costPerConversion = this.conversions > 0 ? this.spent / this.conversions : 0;
  this.roi = this.spent > 0 ? (this.profit / this.spent) * 100 : 0;
  const threshold = this.budget > 0 ? (this.spent / this.budget) * 100 : 0;
  if (threshold >= this.budgetAlertThreshold && !this.budgetAlertTriggered) this.budgetAlertTriggeredAt = new Date();
  this.budgetAlertTriggered = threshold >= this.budgetAlertThreshold;
  this.progress = Math.min(100, Math.round(((this.contentItems?.filter(item => item.status === 'published').length || 0) / Math.max(this.contentTarget || 20, 1)) * 100));
  next();
});

module.exports = mongoose.model('Campaign', campaignSchema);
