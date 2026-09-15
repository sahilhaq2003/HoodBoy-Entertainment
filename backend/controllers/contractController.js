const Contract = require('../models/Contract');
const { uploadDocument, removeCloudinaryDocument } = require('../services/cloudinaryArtistImages');

const parseJsonFields = (body = {}) => {
  const data = { ...body };
  ['parties', 'optionPeriods', 'recoupment', 'paymentObligations', 'tags'].forEach(field => {
    if (typeof data[field] === 'string') {
      try { data[field] = JSON.parse(data[field]); } catch { throw new Error(`Invalid ${field} data`); }
    }
  });
  ['autoRenew'].forEach(field => {
    if (typeof data[field] === 'string') data[field] = data[field] === 'true';
  });
  return data;
};

const contractPayload = async (req) => {
  const data = parseJsonFields(req.body);
  if (req.file) {
    data.fileUrl = await uploadDocument(req.file);
    data.fileName = req.file.originalname;
  }
  return data;
};

exports.getAll = async (req, res) => {
  try {
    const { status, type, artist, search, expiring } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (artist) query.artist = artist;
    if (expiring === 'true') {
      const days = parseInt(req.query.days || '90');
      const future = new Date();
      future.setDate(future.getDate() + days);
      query.endDate = { $lte: future, $gte: new Date() };
      query.status = 'active';
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }
    const contracts = await Contract.find(query)
      .populate('artist', 'name artistName stageName image')
      .populate('managedBy', 'name')
      .sort(req.query.sort === 'endDate' ? 'endDate' : '-createdAt');
    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('artist', 'name artistName stageName image email')
      .populate('managedBy', 'name');
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = await contractPayload(req);
    if (!payload.managedBy) payload.managedBy = req.user._id;
    const contract = await Contract.create(payload);
    res.status(201).json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    const previousFileUrl = contract.fileUrl;
    const payload = await contractPayload(req);
    Object.assign(contract, payload);
    await contract.save();
    if (payload.fileUrl && payload.fileUrl !== previousFileUrl) await removeCloudinaryDocument(previousFileUrl);
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const contract = await Contract.findByIdAndDelete(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    await removeCloudinaryDocument(contract.fileUrl);
    res.json({ success: true, message: 'Contract deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExpiring = async (req, res) => {
  try {
    const days = parseInt(req.query.days || '90');
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const contracts = await Contract.find({ status: 'active', endDate: { $lte: future, $gte: now } })
      .populate('artist', 'name artistName stageName image')
      .sort('endDate');
    const renewalDue = await Contract.find({
      status: 'active',
      renewalDeadline: { $lte: future, $gte: now },
    }).populate('artist', 'name artistName stageName image').sort('renewalDeadline');
    const expired = await Contract.find({
      status: 'active',
      endDate: { $lt: now },
    }).populate('artist', 'name artistName stageName image');
    res.json({ success: true, data: { expiring: contracts, expired, renewalDue, expiringCount: contracts.length, expiredCount: expired.length, renewalDueCount: renewalDue.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [total, byStatus, byType, totalValue, expiringSoon] = await Promise.all([
      Contract.countDocuments(),
      Contract.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Contract.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Contract.aggregate([{ $group: { _id: null, total: { $sum: '$value' } } }]),
      Contract.countDocuments({ status: 'active', $or: [
        { endDate: { $lte: new Date(Date.now() + 90 * 86400000), $gte: new Date() } },
        { renewalDeadline: { $lte: new Date(Date.now() + 90 * 86400000), $gte: new Date() } },
      ] }),
    ]);
    res.json({
      success: true,
      data: {
        total,
        byStatus: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        byType,
        totalValue: totalValue[0]?.total || 0,
        expiringSoon,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
