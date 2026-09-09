const ArtistBalance = require('../models/ArtistBalance');

const BALANCE_FIELDS = ['artist', 'period', 'periodStart', 'periodEnd', 'openingBalance', 'income', 'expenses', 'advances', 'royaltyPayments', 'closingBalance', 'notes', 'status'];
const TRANSACTION_FIELDS = ['description', 'type', 'amount', 'date', 'reference', 'notes'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getAll = async (req, res) => {
  try {
    const { artist, period } = req.query;
    const filter = {};
    if (artist) filter.artist = artist;
    if (period) filter.period = period;
    const balances = await ArtistBalance.find(filter).populate('artist', 'name stageName').sort({ periodStart: -1 });
    res.json({ success: true, data: balances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getArtistBalance = async (req, res) => {
  try {
    const balance = await ArtistBalance.findOne({ artist: req.params.artistId }).sort({ periodStart: -1 }).populate('artist', 'name stageName');
    if (!balance) return res.json({ success: true, data: null });
    res.json({ success: true, data: balance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getArtistBalanceHistory = async (req, res) => {
  try {
    const balances = await ArtistBalance.find({ artist: req.params.artistId }).sort({ periodStart: -1 }).limit(12).populate('artist', 'name stageName');
    res.json({ success: true, data: balances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const balance = await ArtistBalance.create(pick(req.body, BALANCE_FIELDS));
    res.status(201).json({ success: true, data: balance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const addTransaction = async (req, res) => {
  try {
    const balance = await ArtistBalance.findById(req.params.id);
    if (!balance) return res.status(404).json({ success: false, message: 'Balance not found' });
    balance.transactions.push(pick(req.body, TRANSACTION_FIELDS));
    const tx = balance.transactions[balance.transactions.length - 1];
    if (tx.type === 'income' || tx.type === 'payment') balance.income += tx.amount;
    else if (tx.type === 'expense') balance.expenses += tx.amount;
    else if (tx.type === 'advance') balance.advances += tx.amount;
    balance.closingBalance = balance.openingBalance + balance.income - balance.expenses - balance.advances - balance.royaltyPayments;
    await balance.save();
    res.status(201).json({ success: true, data: balance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const balance = await ArtistBalance.findByIdAndUpdate(req.params.id, pick(req.body, BALANCE_FIELDS), { new: true, runValidators: true });
    if (!balance) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: balance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    await ArtistBalance.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getArtistBalance, getArtistBalanceHistory, create, addTransaction, update, delete: remove };
