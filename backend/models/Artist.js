const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'artist_agreement', 'tax_form', 'nda', 'image_release',
      'payment_instructions', 'code_of_conduct', 'social_media_expectations',
      'recording_delivery_requirements', 'existing_contract',
    ],
    required: true
  },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number },
  uploadedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  notes: { type: String, default: '' },
}, { _id: true });

const artistSchema = new mongoose.Schema({
  // Personal Information
  legalName: { type: String, trim: true },
  artistName: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  dateOfBirth: { type: Date },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  emergencyContact: {
    name: { type: String, default: '' },
    relationship: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },

  // Legacy fields (kept for backward compatibility)
  name: { type: String, trim: true },
  stageName: { type: String, trim: true },

  // Artist Profile
  bio: { type: String, default: '' },
  image: { type: String, default: '' },
  coverPhoto: { type: String, default: '' },
  socialLinks: {
    instagram: { type: String, default: '' },
    tiktok: { type: String, default: '' },
    youtube: { type: String, default: '' },
    spotify: { type: String, default: '' },
    twitter: { type: String, default: '' },
  },

  // Music Information
  genre: { type: String, default: '' },
  musicLinks: [{ type: String }],
  previousReleases: { type: String, default: '' },
  catalogOwnership: { type: String, default: '' },

  // Business Information
  proAffiliation: { type: String, default: '' },
  publisher: {
    name: { type: String, default: '' },
    contact: { type: String, default: '' },
  },
  paymentInfo: {
    method: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    routingNumber: { type: String, default: '' },
    paypalEmail: { type: String, default: '' },
  },
  taxInfo: {
    taxId: { type: String, default: '' },
    taxFormType: { type: String, default: '' },
    filingStatus: { type: String, default: '' },
  },

  // Documents
  documents: [documentSchema],

  // Status and Onboarding
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_hold', 'upcoming'],
    default: 'upcoming'
  },
  onboardingStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'pending_approval', 'approved', 'rejected'],
    default: 'not_started'
  },
  onboardingStep: {
    type: Number,
    enum: [1, 2, 3, 4],
    default: 1
  },
  onboardingNotes: { type: String, default: '' },
  onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  onboardingPackage: {
    version: { type: String, default: '1.0' },
    deliveredAt: { type: Date },
    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Contract and Business
  contractStart: { type: Date },
  contractEnd: { type: Date },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalStreams: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  royaltyRate: { type: Number, default: 15 },
}, { timestamps: true });

// Virtual for display name
artistSchema.virtual('displayName').get(function() {
  return this.artistName || this.stageName || this.legalName || this.name || 'Unknown';
});

// Pre-save hook to sync legacy fields
artistSchema.pre('save', function() {
  if (this.legalName && !this.name) this.name = this.legalName;
  if (this.artistName && !this.stageName) this.stageName = this.artistName;
});

artistSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Artist', artistSchema);
