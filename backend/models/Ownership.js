const mongoose = require('mongoose');

const ownershipSchema = new mongoose.Schema({
  songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true, unique: true },
  masterOwner: { type: String, default: '' },
  writers: [{
    name: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    role: { type: String, enum: ['songwriter', 'composer', 'lyricist', 'arranger'], default: 'songwriter' },
  }],
  publishers: [{
    name: { type: String },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    type: { type: String, enum: ['admin', 'co_publishing', 'sub_publishing', 'mechanical'], default: 'admin' },
  }],
  producer: { type: String, default: '' },
  producerPercentage: { type: Number, default: 0, min: 0, max: 100 },
  featuredArtists: [{
    name: { type: String },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  }],
  beatLicense: {
    type: { type: String, enum: ['exclusive', 'non_exclusive', 'lease', 'work_for_hire', 'none'], default: 'none' },
    producer: { type: String, default: '' },
    cost: { type: Number, default: 0 },
    terms: { type: String, default: '' },
    expirationDate: { type: Date },
    purchaseDate: { type: Date },
    licenseNumber: { type: String, default: '' },
    territory: { type: String, default: '' },
    usageLimit: { type: String, default: '' },
    documentUrl: { type: String, default: '' },
  },
  samples: [{
    title: { type: String },
    originalArtist: { type: String },
    owner: { type: String },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    clearanceStatus: { type: String, enum: ['cleared', 'pending', 'denied', 'not_applicable'], default: 'not_applicable' },
    clearanceDocumentUrl: { type: String, default: '' },
    notes: { type: String, default: '' },
  }],
  signatures: [{
    partyName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['master_owner', 'songwriter', 'publisher', 'producer', 'featured_artist', 'sample_owner', 'other'],
      default: 'other',
    },
    status: { type: String, enum: ['pending', 'signed'], default: 'pending' },
    documentUrl: { type: String, default: '' },
    signedAt: { type: Date },
    notes: { type: String, default: '' },
  }],
  copyrightStatus: {
    type: String,
    enum: ['registered', 'pending', 'not_registered', 'disputed'],
    default: 'not_registered',
  },
  copyrightNumber: { type: String, default: '' },
  proStatus: {
    type: String,
    enum: ['registered', 'pending', 'not_registered'],
    default: 'not_registered',
  },
  proName: { type: String, default: '' },
  proIpi: { type: String, default: '' },
  distributionStatus: {
    type: String,
    enum: ['ready', 'pending_metadata', 'pending_approval', 'distributed', 'on_hold'],
    default: 'pending_metadata',
  },
  totalPercentage: { type: Number, default: 0 },
  isComplete: { type: Boolean, default: false },
  signaturesComplete: { type: Boolean, default: false },
  isReadyForRelease: { type: Boolean, default: false },
  validationErrors: [{ type: String }],
  releaseApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true });

ownershipSchema.methods.calculateTotal = function () {
  const writerTotal = this.writers.reduce((sum, w) => sum + (w.percentage || 0), 0);
  const publisherTotal = this.publishers.reduce((sum, p) => sum + (p.percentage || 0), 0);
  const featuredTotal = this.featuredArtists.reduce((sum, f) => sum + (f.percentage || 0), 0);
  const sampleTotal = this.samples.reduce((sum, s) => sum + (s.percentage || 0), 0);
  this.totalPercentage = writerTotal + this.producerPercentage + featuredTotal + publisherTotal + sampleTotal;
  this.isComplete = Math.abs(this.totalPercentage - 100) < 0.01;
  return this.totalPercentage;
};

module.exports = mongoose.model('Ownership', ownershipSchema);
