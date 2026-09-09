const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['call', 'email', 'meeting', 'message', 'event', 'other'], required: true },
  subject: { type: String, default: '' },
  notes: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  outcome: { type: String, enum: ['positive', 'neutral', 'negative', 'pending'], default: 'neutral' },
  whatWasSent: { type: String, default: '' },
  response: { type: String, default: '' },
  followUpRequired: { type: Boolean, default: false },
  followUpDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const reminderSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['follow_up', 'birthday', 'contract_renewal', 'meeting', 'payment', 'other'], default: 'follow_up' },
  notes: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  phone: { type: String, default: '' },
  company: { type: String, default: '' },
  role: { type: String, default: '' },
  category: {
    type: String,
    enum: [
      'a_and_r', 'manager', 'lawyer', 'accountant', 'producer', 'engineer',
      'publicist', 'radio_promoter', 'distribution', 'streaming', 'sync',
      'brand', 'media', 'studio', 'touring', 'other',
      // New categories from customer requirements
      'dj', 'playlist_curator', 'journalist', 'blogger', 'podcaster',
      'promoter', 'venue_owner', 'photographer', 'videographer',
      'sync_agent', 'music_supervisor', 'brand_representative',
    ],
    required: true
  },
  subcategory: { type: String, default: '' },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  socialLinks: {
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    twitter: { type: String, default: '' },
    tiktok: { type: String, default: '' },
    youtube: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  // Relationship tracking
  relationshipStatus: {
    type: String,
    enum: ['new', 'contacted', 'warm', 'strong', 'inactive', 'archived'],
    default: 'new',
  },
  relationshipStrength: { type: Number, min: 0, max: 10, default: 0 },
  lastContactedAt: { type: Date },
  lastContactNotes: { type: String, default: '' },
  followUpDate: { type: Date },
  whatWasSent: { type: String, default: '' },
  response: { type: String, default: '' },
  genrePreference: { type: String, default: '' },
  relatedArtists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }],
  relatedContracts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contract' }],
  interactions: [interactionSchema],
  reminders: [reminderSchema],
  isFavorite: { type: Boolean, default: false },
  tags: [{ type: String }],
  notes: { type: String, default: '' },
  source: { type: String, enum: ['referral', 'website', 'event', 'social_media', 'cold_outreach', 'existing', 'other'], default: 'other' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

contactSchema.index({ name: 'text', company: 'text', email: 'text' });
contactSchema.index({ category: 1 });
contactSchema.index({ relationshipStatus: 1 });
contactSchema.index({ followUpDate: 1 });

module.exports = mongoose.model('Contact', contactSchema);
