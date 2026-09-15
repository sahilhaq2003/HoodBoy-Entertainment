const Finance = require('../models/Finance');
const { uploadDocument } = require('../services/cloudinaryArtistImages');

const financePayload = async (req) => {
  const payload = { ...req.body };
  ['taxDeductible', 'isRecurring'].forEach(field => {
    if (typeof payload[field] === 'string') payload[field] = payload[field] === 'true';
  });
  const receipt = req.files?.receipt?.[0];
  const invoice = req.files?.invoice?.[0];
  if (receipt) { payload.receiptUrl = await uploadDocument(receipt); payload.receiptFileName = receipt.originalname; }
  if (invoice) { payload.invoiceUrl = await uploadDocument(invoice); payload.invoiceFileName = invoice.originalname; }
  return payload;
};

const getFinances = async (req, res) => {
  try {
    const { type, category, status, year, quarter, month, artist, dateFrom, dateTo, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.paymentStatus = status;
    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (quarter) query.quarter = parseInt(quarter);
    if (artist) query.artist = artist;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }
    const finances = await Finance.find(query)
      .populate('artist', 'name stageName artistName')
      .populate('project', 'name')
      .populate('release', 'title')
      .populate('processedBy', 'name')
      .sort('-date').limit(limit * 1).skip((page - 1) * limit);
    const total = await Finance.countDocuments(query);
    res.json({ success: true, data: finances, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createFinance = async (req, res) => {
  try {
    const finance = await Finance.create({ ...await financePayload(req), processedBy: req.user._id });
    res.status(201).json({ success: true, data: finance });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const updateFinance = async (req, res) => {
  try {
    const finance = await Finance.findById(req.params.id);
    if (!finance) return res.status(404).json({ success: false, message: 'Finance record not found' });
    Object.assign(finance, await financePayload(req));
    await finance.save();
    res.json({ success: true, data: finance });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const deleteFinance = async (req, res) => {
  try {
    const finance = await Finance.findByIdAndDelete(req.params.id);
    if (!finance) return res.status(404).json({ success: false, message: 'Finance record not found' });
    res.json({ success: true, message: 'Finance record deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getFinanceSummary = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const monthlyAgg = await Finance.aggregate([
      { $match: { year } },
      { $group: { _id: { month: '$month', type: '$type' }, total: { $sum: '$amount' } } },
    ]);
    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) monthlyMap[m] = { revenue: 0, expenses: 0 };
    monthlyAgg.forEach(d => {
      if (d._id.month && monthlyMap[d._id.month]) {
        if (d._id.type === 'income') monthlyMap[d._id.month].revenue = d.total;
        else monthlyMap[d._id.month].expenses = d.total;
      }
    });
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyBreakdown = Object.entries(monthlyMap).map(([m, v]) => ({
      month: parseInt(m), name: monthNames[parseInt(m) - 1], revenue: v.revenue, expenses: v.expenses, profit: v.revenue - v.expenses
    }));

    const categoryAgg = await Finance.aggregate([
      { $match: { year } },
      { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    const quarterAgg = await Finance.aggregate([
      { $match: { year } },
      { $group: { _id: { quarter: '$quarter', type: '$type' }, total: { $sum: '$amount' } } },
      { $sort: { '_id.quarter': 1 } }
    ]);
    const quarterMap = { 1: { revenue: 0, expenses: 0 }, 2: { revenue: 0, expenses: 0 }, 3: { revenue: 0, expenses: 0 }, 4: { revenue: 0, expenses: 0 } };
    quarterAgg.forEach(d => {
      if (d._id.quarter && quarterMap[d._id.quarter]) {
        if (d._id.type === 'income') quarterMap[d._id.quarter].revenue = d.total;
        else quarterMap[d._id.quarter].expenses = d.total;
      }
    });
    const quarterBreakdown = Object.entries(quarterMap).map(([q, v]) => ({
      quarter: parseInt(q), revenue: v.revenue, expenses: v.expenses, profit: v.revenue - v.expenses
    }));

    const topArtists = await Finance.aggregate([
      { $match: { year, type: 'income', artist: { $ne: null } } },
      { $group: { _id: '$artist', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);
    const artistIds = topArtists.map(a => a._id);
    const Artist = require('../models/Artist');
    const artistDocs = await Artist.find({ _id: { $in: artistIds } }).select('name stageName artistName');
    const artistMap = {};
    artistDocs.forEach(a => { artistMap[a._id.toString()] = a.stageName || a.artistName || a.name; });
    const topArtistsFormatted = topArtists.map(a => ({
      artist: a._id, name: artistMap[a._id.toString()] || 'Unknown', total: a.total
    }));

    const topExpenses = await Finance.aggregate([
      { $match: { year, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);

    const totalRevenue = monthlyBreakdown.reduce((s, m) => s + m.revenue, 0);
    const totalExpenses = monthlyBreakdown.reduce((s, m) => s + m.expenses, 0);
    const pendingCount = await Finance.countDocuments({ year, paymentStatus: 'pending' });

    res.json({
      success: true,
      data: {
        totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses, pendingCount,
        monthlyBreakdown, categoryBreakdown: categoryAgg, quarterBreakdown,
        topArtists: topArtistsFormatted, topExpenses,
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCashFlow = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const agg = await Finance.aggregate([
      { $match: { year } },
      { $group: { _id: { month: '$month', type: '$type' }, total: { $sum: '$amount' } } },
    ]);
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = { income: 0, expenses: 0 };
    agg.forEach(d => {
      if (d._id.month && map[d._id.month]) {
        if (d._id.type === 'income') map[d._id.month].income = d.total;
        else map[d._id.month].expenses = d.total;
      }
    });
    let runningBalance = 0;
    const data = [];
    for (let m = 1; m <= 12; m++) {
      runningBalance += map[m].income - map[m].expenses;
      data.push({
        month: monthNames[m - 1],
        income: map[m].income,
        expenses: map[m].expenses,
        balance: runningBalance,
      });
    }
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getCategoryBreakdown = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const agg = await Finance.aggregate([
      { $match: { year } },
      { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    const totalAll = agg.reduce((s, d) => s + d.total, 0);
    const data = agg.map(d => ({
      category: d._id.category,
      type: d._id.type,
      total: d.total,
      count: d.count,
      percentage: totalAll > 0 ? Math.round((d.total / totalAll) * 10000) / 100 : 0,
    }));
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getFinances, createFinance, updateFinance, deleteFinance, getFinanceSummary, getCashFlow, getCategoryBreakdown };
