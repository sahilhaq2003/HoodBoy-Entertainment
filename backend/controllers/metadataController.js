const SongMetadata = require('../models/SongMetadata');
const Song = require('../models/Song');
const mongoose = require('mongoose');

const normalizeMetadata = (input = {}) => {
  const data = { ...input };
  if (typeof data.isrc === 'string') data.isrc = data.isrc.replace(/[-\s]/g, '').toUpperCase();
  if (typeof data.upc === 'string') data.upc = data.upc.replace(/\s/g, '');
  ['title', 'version', 'genre', 'language', 'label', 'copyrightOwner'].forEach(field => {
    if (typeof data[field] === 'string') data[field] = data[field].trim();
  });
  return data;
};

exports.getMetadata = async (req, res) => {
  try {
    const { search, validationStatus, genre, isExplicit, page = 1, limit = 20 } = req.query;
    const query = {};
    if (validationStatus) query.validationStatus = validationStatus;
    if (genre) query.genre = genre;
    if (isExplicit !== undefined) query.isExplicit = isExplicit === 'true';
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { isrc: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      SongMetadata.find(query)
        .populate('songId', 'title status streams')
        .populate('artist', 'name artistName stageName')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      SongMetadata.countDocuments(query),
    ]);
    res.json({
      success: true,
      data,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMetadataById = async (req, res) => {
  try {
    const metadata = await SongMetadata.findById(req.params.id)
      .populate('songId', 'title status streams')
      .populate('artist', 'name artistName stageName');
    if (!metadata) return res.status(404).json({ success: false, message: 'Metadata not found' });
    res.json({ success: true, data: metadata });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMetadataBySong = async (req, res) => {
  try {
    const metadata = await SongMetadata.findOne({ songId: req.params.songId })
      .populate('songId', 'title status streams')
      .populate('artist', 'name artistName stageName');
    if (!metadata) return res.status(404).json({ success: false, message: 'No metadata found for this song' });
    res.json({ success: true, data: metadata });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMetadata = async (req, res) => {
  try {
    const payload = normalizeMetadata(req.body);
    const song = await Song.findById(payload.songId).select('title artist');
    if (!song) return res.status(400).json({ success: false, message: 'Selected song does not exist' });
    payload.title = song.title;
    payload.artist = song.artist;
    const existing = await SongMetadata.findOne({ songId: payload.songId });
    if (existing) return res.status(400).json({ success: false, message: 'Metadata already exists for this song' });
    if (payload.isrc) {
      const duplicateIsrc = await SongMetadata.findOne({ isrc: payload.isrc });
      if (duplicateIsrc) return res.status(400).json({ success: false, message: 'This ISRC is already assigned to another song' });
    }
    const metadata = new SongMetadata(payload);
    metadata.validateMetadata();
    await metadata.save();
    const populated = await metadata.populate([
      { path: 'songId', select: 'title status streams' },
      { path: 'artist', select: 'name artistName stageName' },
    ]);
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateMetadata = async (req, res) => {
  try {
    const metadata = await SongMetadata.findById(req.params.id);
    if (!metadata) return res.status(404).json({ success: false, message: 'Metadata not found' });
    const payload = normalizeMetadata(req.body);
    const song = await Song.findById(metadata.songId).select('title artist');
    if (!song) return res.status(400).json({ success: false, message: 'Linked song does not exist' });
    payload.title = song.title;
    payload.artist = song.artist;
    if (payload.isrc) {
      const duplicateIsrc = await SongMetadata.findOne({ _id: { $ne: metadata._id }, isrc: payload.isrc });
      if (duplicateIsrc) return res.status(400).json({ success: false, message: 'This ISRC is already assigned to another song' });
    }
    Object.assign(metadata, payload);
    metadata.validateMetadata();
    await metadata.save();
    await metadata.populate([{ path: 'songId', select: 'title status streams' }, { path: 'artist', select: 'name artistName stageName' }]);
    res.json({ success: true, data: metadata });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteMetadata = async (req, res) => {
  try {
    const metadata = await SongMetadata.findByIdAndDelete(req.params.id);
    if (!metadata) return res.status(404).json({ success: false, message: 'Metadata not found' });
    res.json({ success: true, message: 'Metadata deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.validateMetadata = async (req, res) => {
  try {
    const metadata = await SongMetadata.findById(req.body.id);
    if (!metadata) return res.status(404).json({ success: false, message: 'Metadata not found' });
    const { errors } = metadata.validateMetadata();
    await metadata.save();
    const populated = await metadata.populate([
      { path: 'songId', select: 'title status streams' },
      { path: 'artist', select: 'name artistName stageName' },
    ]);
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkValidate = async (req, res) => {
  try {
    const entries = await SongMetadata.find({});
    let valid = 0;
    let invalid = 0;
    for (const entry of entries) {
      const { errors } = entry.validateMetadata();
      await entry.save();
      if (errors.length === 0) valid++;
      else invalid++;
    }
    res.json({ success: true, data: { total: entries.length, valid, invalid } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportMetadata = async (req, res) => {
  try {
    const { format = 'json' } = req.body;
    const entries = await SongMetadata.find({})
      .populate('songId', 'title status')
      .populate('artist', 'name artistName stageName');
    if (format === 'csv') {
      const headers = [
        'Title', 'Version', 'Artist', 'Featured Artists', 'Producers', 'Writers', 'Publishers', 'Label', 'Album', 'Genre', 'Subgenre', 'Mood', 'BPM', 'Key', 'Language',
        'ISRC', 'UPC', 'Copyright', 'Copyright Owner', 'Copyright Year', 'Publisher', 'PRO Affiliation', 'Writer Split', 'Release Date', 'Lyrics', 'Contact Name', 'Contact Email', 'Contact Phone',
        'Distribution Date', 'Distribution Platform', 'Pre-Save Date',
        'Audio Format', 'Sample Rate', 'Bit Depth', 'Explicit',
        'Validation Status', 'Notes',
      ];
      const rows = entries.map(e => [
        e.title, e.version, e.artist?.stageName || e.artist?.name || '',
        e.credits.filter(c => c.role === 'featured_artist').map(c => c.name).join('; '),
        e.credits.filter(c => c.role === 'producer').map(c => c.name).join('; '),
        e.credits.filter(c => c.role === 'songwriter' || c.role === 'composer').map(c => `${c.name} (${c.percentage}%)`).join('; '),
        e.publishers.map(p => `${p.name} (${p.percentage}%)`).join('; '), e.label, e.album, e.genre, e.subgenre, e.mood,
        e.bpm || '', e.key, e.language, e.isrc, e.upc, e.copyright, e.copyrightOwner, e.copyrightYear || '',
        e.publisher, e.proAffiliation, e.writerSplit,
        e.releaseDate ? new Date(e.releaseDate).toISOString().split('T')[0] : '', e.lyrics,
        e.contactInformation?.name, e.contactInformation?.email, e.contactInformation?.phone,
        e.distributionDate ? new Date(e.distributionDate).toISOString().split('T')[0] : '',
        e.distributionPlatform, e.preSaveDate ? new Date(e.preSaveDate).toISOString().split('T')[0] : '',
        e.audioFormat, e.sampleRate, e.bitDepth, e.isExplicit ? 'Yes' : 'No',
        e.validationStatus, e.notes,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
      res.json({ success: true, data: csv, format: 'csv' });
    } else {
      res.json({ success: true, data: entries, format: 'json' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [total, statusCounts, byGenre, byLanguage] = await Promise.all([
      SongMetadata.countDocuments(),
      SongMetadata.aggregate([{ $group: { _id: '$validationStatus', count: { $sum: 1 } } }]),
      SongMetadata.aggregate([{ $group: { _id: '$genre', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      SongMetadata.aggregate([{ $group: { _id: '$language', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);
    const statusMap = statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
    res.json({
      success: true,
      data: {
        total,
        valid: statusMap.valid || 0,
        incomplete: statusMap.incomplete || 0,
        needsReview: statusMap.needs_review || 0,
        unvalidated: statusMap.unvalidated || 0,
        byGenre: byGenre.filter(g => g._id),
        byLanguage: byLanguage.filter(l => l._id),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
