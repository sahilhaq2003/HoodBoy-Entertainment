const Budget = require('../models/Budget');
const Finance = require('../models/Finance');

const BUDGET_FIELDS = ['name', 'year', 'quarter', 'artist', 'project', 'release', 'department', 'status', 'notes'];
const BUDGET_ITEM_FIELDS = ['category', 'label', 'budgeted', 'spent', 'notes'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getBudgets = async (req, res) => {
  try {
    const { year, quarter, artist, project, release, department, status } = req.query;
    const query = {};
    if (year) query.year = parseInt(year);
    if (quarter) query.quarter = parseInt(quarter);
    if (artist) query.artist = artist;
    if (project) query.project = project;
    if (release) query.release = release;
    if (department) query.department = department;
    if (status) query.status = status;
    const budgets = await Budget.find(query)
      .populate('artist', 'name stageName artistName')
      .populate('project', 'name')
      .populate('release', 'title')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort('-createdAt');
    res.json({ success: true, data: budgets });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getBudgetById = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id)
      .populate('artist', 'name stageName artistName')
      .populate('project', 'name')
      .populate('release', 'title')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    res.json({ success: true, data: budget });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createBudget = async (req, res) => {
  try {
    const budget = await Budget.create({ ...pick(req.body, BUDGET_FIELDS), createdBy: req.user._id });
    res.status(201).json({ success: true, data: budget });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const updateBudget = async (req, res) => {
  try {
    const budget = await Budget.findByIdAndUpdate(req.params.id, pick(req.body, BUDGET_FIELDS), { new: true, runValidators: true });
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    res.json({ success: true, data: budget });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findByIdAndDelete(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    res.json({ success: true, message: 'Budget deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const addItem = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    budget.items.push(pick(req.body, BUDGET_ITEM_FIELDS));
    await budget.save();
    res.status(201).json({ success: true, data: budget });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const updateItem = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    const item = budget.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Budget item not found' });
    Object.assign(item, pick(req.body, BUDGET_ITEM_FIELDS));
    await budget.save();
    res.json({ success: true, data: budget });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const deleteItem = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    budget.items.pull(req.params.itemId);
    await budget.save();
    res.json({ success: true, data: budget });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getBudgetVsActual = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id).populate('artist', 'name stageName');
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });

    const matchQuery = { year: budget.year, type: 'expense' };
    if (budget.quarter) matchQuery.quarter = budget.quarter;
    if (budget.artist) matchQuery.artist = budget.artist._id || budget.artist;
    if (budget.project) matchQuery.project = budget.project._id || budget.project;
    if (budget.release) matchQuery.release = budget.release._id || budget.release;
    if (budget.department) matchQuery.department = budget.department;

    const actuals = await Finance.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]);
    const actualMap = {};
    actuals.forEach(a => { actualMap[a._id] = a.total; });

    const comparison = budget.items.map(item => {
      const actual = actualMap[item.category] || 0;
      const remaining = item.budgeted - actual;
      const utilization = item.budgeted > 0 ? Math.round((actual / item.budgeted) * 10000) / 100 : 0;
      return {
        _id: item._id,
        category: item.category,
        label: item.label,
        budgeted: item.budgeted,
        actual,
        remaining,
        utilization,
        isOverBudget: actual > item.budgeted,
      };
    });

    res.json({ success: true, data: comparison });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getBudgetStats = async (req, res) => {
  try {
    const totalBudgets = await Budget.countDocuments();
    const activeBudgets = await Budget.countDocuments({ status: 'active' });
    const agg = await Budget.aggregate([
      { $group: { _id: null, totalBudgeted: { $sum: '$totalBudget' }, totalSpent: { $sum: { $sum: '$items.spent' } } } }
    ]);
    const { totalBudgeted = 0, totalSpent = 0 } = agg[0] || {};
    const utilization = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 10000) / 100 : 0;
    res.json({
      success: true,
      data: { totalBudgets, activeBudgets, totalBudgeted, totalSpent, utilization }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getBudgets, getBudgetById, createBudget, updateBudget, deleteBudget, addItem, updateItem, deleteItem, getBudgetVsActual, getBudgetStats };
