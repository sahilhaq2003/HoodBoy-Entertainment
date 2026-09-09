const RoyaltyLedger = require('../models/RoyaltyLedger');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const derivedFields = ['totalDeductions', 'netIncome', 'artistGrossShare', 'artistShare', 'labelShare',
  'producerRoyalty', 'featuredArtistRoyalty', 'totalRecouped', 'recoupedThisPeriod',
  'remainingRecoupable', 'totalPaid', 'remainingBalance', 'calculatedAt'];
const safePayload = (body) => {
  const payload = { ...body };
  derivedFields.forEach((field) => delete payload[field]);
  ['paymentsIssued', 'statementGenerated', 'statementUrl'].forEach((field) => delete payload[field]);
  return payload;
};
const calculateEntry = (entry) => {
  const approved = (entry.approvedDeductions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalDeductions = Math.min(Number(entry.grossIncome || 0), Number(entry.distributorFees || 0) + approved);
  const netIncome = Math.max(0, Number(entry.grossIncome || 0) - totalDeductions);
  const artistGrossShare = netIncome * Number(entry.artistPercentage || 0) / 100;
  const producerRoyalty = netIncome * Number(entry.producerPercentage || 0) / 100;
  const featuredArtistRoyalty = netIncome * Number(entry.featuredArtistPercentage || 0) / 100;
  const artistBeforeRecoupment = Math.max(0, artistGrossShare - producerRoyalty - featuredArtistRoyalty);
  const recoupedThisPeriod = Math.min(Number(entry.recoupableExpenses || 0), artistBeforeRecoupment);
  const artistShare = Math.max(0, artistBeforeRecoupment - recoupedThisPeriod);
  const totalPaid = (entry.paymentsIssued || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  entry.totalDeductions = roundMoney(totalDeductions);
  entry.netIncome = roundMoney(netIncome);
  entry.artistGrossShare = roundMoney(artistGrossShare);
  entry.producerRoyalty = roundMoney(producerRoyalty);
  entry.featuredArtistRoyalty = roundMoney(featuredArtistRoyalty);
  entry.recoupedThisPeriod = roundMoney(recoupedThisPeriod);
  entry.totalRecouped = roundMoney(recoupedThisPeriod);
  entry.remainingRecoupable = roundMoney(Math.max(0, Number(entry.recoupableExpenses || 0) - recoupedThisPeriod));
  entry.artistShare = roundMoney(artistShare);
  entry.labelShare = roundMoney(netIncome - artistGrossShare + recoupedThisPeriod);
  entry.totalPaid = roundMoney(totalPaid);
  entry.remainingBalance = roundMoney(Math.max(0, artistShare - totalPaid));
  entry.calculatedAt = new Date();
};

// @desc    Get all royalty entries
// @route   GET /api/royalties
const getRoyalties = async (req, res) => {
  try {
    const { artist, period, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (artist) filter.artist = artist;
    if (period) filter.period = period;
    if (status) filter.status = status;
    const entries = await RoyaltyLedger.find(filter)
      .populate('artist', 'name stageName')
      .populate('release', 'title')
      .populate('song', 'title')
      .sort({ periodStart: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await RoyaltyLedger.countDocuments(filter);
    res.json({ success: true, data: entries, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get royalty summary per artist
// @route   GET /api/royalties/summary/:artistId
const getArtistRoyaltySummary = async (req, res) => {
  try {
    const entries = await RoyaltyLedger.find({ artist: req.params.artistId }).sort({ periodStart: -1 });
    const summary = entries.reduce((acc, e) => ({
      totalGross: acc.totalGross + e.grossIncome,
      totalDeductions: acc.totalDeductions + e.totalDeductions,
      totalNet: acc.totalNet + e.netIncome,
      totalArtistShare: acc.totalArtistShare + e.artistShare,
      totalPaid: acc.totalPaid + e.totalPaid,
      totalOwed: acc.totalOwed + e.remainingBalance,
      entryCount: acc.entryCount + 1,
    }), { totalGross: 0, totalDeductions: 0, totalNet: 0, totalArtistShare: 0, totalPaid: 0, totalOwed: 0, entryCount: 0 });
    res.json({ success: true, data: summary, entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create royalty entry
// @route   POST /api/royalties
const createRoyaltyEntry = async (req, res) => {
  try {
    const entry = new RoyaltyLedger(safePayload(req.body));
    calculateEntry(entry);
    entry.status = 'calculated';
    await entry.save();
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Calculate royalties for an entry
// @route   POST /api/royalties/:id/calculate
const calculateRoyalties = async (req, res) => {
  try {
    const entry = await RoyaltyLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });

    calculateEntry(entry);
    entry.status = 'calculated';
    await entry.save();

    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update royalty entry
// @route   PUT /api/royalties/:id
const updateRoyaltyEntry = async (req, res) => {
  try {
    const entry = await RoyaltyLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (['approved', 'paid'].includes(entry.status)) return res.status(409).json({ success: false, message: 'Approved or paid entries cannot be edited' });
    Object.assign(entry, safePayload(req.body));
    calculateEntry(entry);
    entry.status = 'calculated';
    await entry.save();
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete royalty entry
// @route   DELETE /api/royalties/:id
const deleteRoyaltyEntry = async (req, res) => {
  try {
    const entry = await RoyaltyLedger.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate royalty statement
// @route   POST /api/royalties/:id/statement
const generateStatement = async (req, res) => {
  try {
    const entry = await RoyaltyLedger.findById(req.params.id)
      .populate('artist', 'name stageName email')
      .populate('release', 'title')
      .populate('song', 'title');
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });

    calculateEntry(entry);
    entry.statementGenerated = true;
    await entry.save();

    const statement = {
      period: entry.period,
      artist: entry.artist,
      release: entry.release,
      song: entry.song,
      grossIncome: entry.grossIncome,
      incomeBySource: entry.incomeBySource,
      deductions: { distributorFees: entry.distributorFees, approved: entry.approvedDeductions, total: entry.totalDeductions },
      recoupment: { expenses: entry.recoupableExpenses, recouped: entry.totalRecouped, remaining: entry.remainingRecoupable },
      splits: { artistPercentage: entry.artistPercentage, labelPercentage: entry.labelPercentage, producerPercentage: entry.producerPercentage, featuredArtistPercentage: entry.featuredArtistPercentage },
      calculation: { formula: 'Gross income - fees - approved deductions = net income; apply splits; subtract participant royalties and recoupment from the artist pool', netIncome: entry.netIncome, artistGrossShare: entry.artistGrossShare, producerRoyalty: entry.producerRoyalty, featuredArtistRoyalty: entry.featuredArtistRoyalty, recoupedThisPeriod: entry.recoupedThisPeriod, artistShare: entry.artistShare, labelShare: entry.labelShare },
      payments: { totalPaid: entry.totalPaid, remaining: entry.remainingBalance, history: entry.paymentsIssued },
    };

    res.json({ success: true, data: statement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const approveRoyaltyEntry = async (req, res) => {
  try {
    const entry = await RoyaltyLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    calculateEntry(entry);
    entry.status = 'approved';
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    await entry.save();
    res.json({ success: true, data: entry });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const recordPayment = async (req, res) => {
  try {
    const entry = await RoyaltyLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (!['approved', 'paid'].includes(entry.status)) return res.status(409).json({ success: false, message: 'Approve the statement before issuing payment' });
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > entry.remainingBalance) return res.status(400).json({ success: false, message: 'Payment must be positive and cannot exceed the remaining balance' });
    entry.paymentsIssued.push({ amount, date: req.body.date || new Date(), method: req.body.method || '', reference: req.body.reference || '', notes: req.body.notes || '' });
    calculateEntry(entry);
    entry.status = entry.remainingBalance === 0 ? 'paid' : 'approved';
    await entry.save();
    res.json({ success: true, data: entry });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getRoyalties, getArtistRoyaltySummary, createRoyaltyEntry, calculateRoyalties, updateRoyaltyEntry, deleteRoyaltyEntry, generateStatement, approveRoyaltyEntry, recordPayment };
