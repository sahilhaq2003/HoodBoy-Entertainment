const ContractTemplate = require('../models/ContractTemplate');

const TEMPLATE_FIELDS = ['name', 'type', 'description', 'content', 'clauses', 'defaultTerms', 'isActive', 'tags'];
const pick = (obj, keys) => keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

const getTemplates = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const templates = await ContractTemplate.find(filter).populate('createdBy', 'name').sort({ usageCount: -1 });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTemplate = async (req, res) => {
  try {
    const template = await ContractTemplate.findById(req.params.id).populate('createdBy', 'name');
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    const template = await ContractTemplate.create({ ...pick(req.body, TEMPLATE_FIELDS), createdBy: req.user._id });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const template = await ContractTemplate.findByIdAndUpdate(req.params.id, pick(req.body, TEMPLATE_FIELDS), { new: true, runValidators: true });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await ContractTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate };
