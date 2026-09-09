const mongoose = require('mongoose');

const lnkUpEpisodeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  season: { type: Number, default: 1 },
  episode: { type: Number, default: 1 },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  guests: [{ type: String }],
  status: {
    type: String,
    enum: ['planned', 'casting', 'recorded', 'editing', 'scheduled', 'aired', 'cancelled'],
    default: 'planned'
  },
  airDate: { type: Date },
  platform: {
    type: String,
    enum: ['youtube', 'tv', 'streaming', 'podcast', 'live', 'other'],
    default: 'youtube'
  },
  description: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  watchTime: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  tags: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('LnkUp', lnkUpEpisodeSchema);
