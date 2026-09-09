const PerSongAnalytics = require('../models/PerSongAnalytics');

const ANALYTICS_FIELDS = ['song', 'artist', 'release', 'period', 'periodStart', 'periodEnd', 'platforms', 'totalStreams', 'monthlyListeners', 'saves', 'playlistAdditions', 'videoViews', 'watchTime', 'followersGained', 'emailSubscribers', 'websiteVisits', 'merchandiseSales', 'ticketSales', 'adSpend', 'costPerResult', 'revenue', 'campaignProfitLoss', 'streamsGrowth', 'listenersGrowth', 'savesGrowth'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getAll = async (req, res) => {
  try {
    const { song, artist, period, release } = req.query;
    const filter = {};
    if (song) filter.song = song;
    if (artist) filter.artist = artist;
    if (period) filter.period = period;
    if (release) filter.release = release;
    const analytics = await PerSongAnalytics.find(filter)
      .populate('song', 'title artist')
      .populate('artist', 'name stageName')
      .populate('release', 'title')
      .sort({ periodStart: -1 });
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSongAnalytics = async (req, res) => {
  try {
    const analytics = await PerSongAnalytics.find({ song: req.params.songId })
      .populate('song', 'title artist')
      .populate('artist', 'name stageName')
      .sort({ periodStart: -1 });
    const totals = analytics.reduce((acc, a) => ({
      totalStreams: acc.totalStreams + a.totalStreams,
      totalRevenue: acc.totalRevenue + a.revenue,
      totalSaves: acc.totalSaves + a.saves,
      totalPlaylists: acc.totalPlaylists + a.playlistAdditions,
      totalVideoViews: acc.totalVideoViews + a.videoViews,
      periods: acc.periods + 1,
    }), { totalStreams: 0, totalRevenue: 0, totalSaves: 0, totalPlaylists: 0, totalVideoViews: 0, periods: 0 });
    res.json({ success: true, data: { analytics, totals } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const entry = await PerSongAnalytics.create(pick(req.body, ANALYTICS_FIELDS));
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const entry = await PerSongAnalytics.findByIdAndUpdate(req.params.id, pick(req.body, ANALYTICS_FIELDS), { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    await PerSongAnalytics.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getSongAnalytics, create, update, delete: remove };
