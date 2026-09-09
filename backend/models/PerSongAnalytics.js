const mongoose = require('mongoose');

const perSongAnalyticsSchema = new mongoose.Schema({
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  release: { type: mongoose.Schema.Types.ObjectId, ref: 'Release' },
  period: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  // Streaming platforms breakdown
  platforms: [{
    name: { type: String, required: true },
    streams: { type: Number, default: 0 },
    listeners: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    playlistAdds: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    playlistReach: { type: Number, default: 0 },
  }],
  // Aggregate metrics
  totalStreams: { type: Number, default: 0 },
  monthlyListeners: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  playlistAdditions: { type: Number, default: 0 },
  videoViews: { type: Number, default: 0 },
  watchTime: { type: Number, default: 0 },
  followersGained: { type: Number, default: 0 },
  emailSubscribers: { type: Number, default: 0 },
  websiteVisits: { type: Number, default: 0 },
  merchandiseSales: { type: Number, default: 0 },
  ticketSales: { type: Number, default: 0 },
  adSpend: { type: Number, default: 0 },
  costPerResult: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  campaignProfitLoss: { type: Number, default: 0 },
  // Growth metrics
  streamsGrowth: { type: Number, default: 0 },
  listenersGrowth: { type: Number, default: 0 },
  savesGrowth: { type: Number, default: 0 },
}, { timestamps: true });

perSongAnalyticsSchema.index({ song: 1, period: 1 });
perSongAnalyticsSchema.index({ artist: 1 });
perSongAnalyticsSchema.index({ period: 1 });

module.exports = mongoose.model('PerSongAnalytics', perSongAnalyticsSchema);
