const TaxCalendar = require('../models/TaxCalendar');

const TAX_FIELDS = ['title', 'type', 'description', 'dueDate', 'status', 'completed', 'completedAt', 'priority', 'year', 'quarter', 'month', 'amount', 'notes', 'assignedTo', 'recurring', 'recurringFrequency', 'recurrencePattern', 'tags'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const syncStatusFlags = (doc) => {
  if (doc.status === 'completed') {
    doc.completed = true;
    if (!doc.completedAt) doc.completedAt = new Date();
  } else if (doc.status !== undefined) {
    doc.completed = false;
  }
  if (doc.recurringFrequency && !doc.recurrencePattern && doc.recurringFrequency !== 'semi_annual') {
    doc.recurrencePattern = doc.recurringFrequency;
  }
  return doc;
};

const getAll = async (req, res) => {
  try {
    const { year, quarter, completed, type } = req.query;
    const filter = {};
    if (year) filter.year = parseInt(year);
    if (quarter) filter.quarter = parseInt(quarter);
    if (completed !== undefined) filter.completed = completed === 'true';
    if (type) filter.type = type;
    const items = await TaxCalendar.find(filter).sort({ dueDate: 1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUpcoming = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + parseInt(days));
    const items = await TaxCalendar.find({
      dueDate: { $gte: now, $lte: future },
      completed: false,
    }).sort({ dueDate: 1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const create = async (req, res) => {
  try {
    const item = await TaxCalendar.create(syncStatusFlags(pick(req.body, TAX_FIELDS)));
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const update = async (req, res) => {
  try {
    const item = await TaxCalendar.findByIdAndUpdate(
      req.params.id,
      syncStatusFlags(pick(req.body, TAX_FIELDS)),
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const remove = async (req, res) => {
  try {
    await TaxCalendar.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getUpcoming, create, update, delete: remove };
