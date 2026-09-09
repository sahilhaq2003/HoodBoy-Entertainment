const LnkUp = require('../models/LnkUp');

const LNKUP_FIELDS = ['title', 'season', 'episode', 'artist', 'guests', 'status', 'airDate', 'platform', 'description', 'thumbnail', 'featured', 'views', 'likes', 'watchTime', 'notes', 'tags'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getAll = async (req, res) => {
  try {
    const { status, artist, featured } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (artist) filter.artist = artist;
    if (featured !== undefined) filter.featured = featured === 'true';
    const episodes = await LnkUp.find(filter)
      .populate('artist', 'name stageName')
      .sort({ season: 1, episode: 1, createdAt: -1 });
    res.json({ success: true, data: episodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getById = async (req, res) => {
  try {
    const episode = await LnkUp.findById(req.params.id).populate('artist', 'name stageName');
    if (!episode) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: episode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const total = await LnkUp.countDocuments();
    const aired = await LnkUp.countDocuments({ status: 'aired' });
    const scheduled = await LnkUp.countDocuments({ status: 'scheduled' });
    const inProduction = await LnkUp.countDocuments({ status: { $in: ['casting', 'recorded', 'editing'] } });
    const planned = await LnkUp.countDocuments({ status: 'planned' });
    const [airAgg] = await LnkUp.aggregate([
      { $match: { status: 'aired' } },
      { $group: { _id: null, views: { $sum: '$views' }, likes: { $sum: '$likes' }, watchTime: { $sum: '$watchTime' } } }
    ]);
    const upcoming = await LnkUp.find({ status: 'scheduled', airDate: { $gte: new Date() } })
      .populate('artist', 'name stageName')
      .sort({ airDate: 1 })
      .limit(6);
    res.json({
      success: true,
      data: {
        total, aired, scheduled, inProduction, planned,
        views: airAgg?.views || 0,
        likes: airAgg?.likes || 0,
        watchTime: airAgg?.watchTime || 0,
        upcoming,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const episode = await LnkUp.create(pick(req.body, LNKUP_FIELDS));
    const populated = await LnkUp.findById(episode._id).populate('artist', 'name stageName');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const episode = await LnkUp.findByIdAndUpdate(req.params.id, pick(req.body, LNKUP_FIELDS), { new: true, runValidators: true })
      .populate('artist', 'name stageName');
    if (!episode) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: episode });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    await LnkUp.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getById, getStats, create, update: update, delete: remove };
