const express = require('express');
const router = express.Router();
const { getFinances, createFinance, updateFinance, deleteFinance, getFinanceSummary, getCashFlow, getCategoryBreakdown } = require('../controllers/financeController');
const { protect, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validate, commonValidations } = require('../middleware/validate');

router.use(protect);
router.get('/cashflow', checkPermission('finance', 'read'), getCashFlow);
router.get('/category-breakdown', checkPermission('finance', 'read'), getCategoryBreakdown);
router.get('/summary', checkPermission('finance', 'read'), getFinanceSummary);
router.route('/').get(checkPermission('finance', 'read'), getFinances).post(checkPermission('finance', 'write'), upload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'invoice', maxCount: 1 }]), validate(commonValidations.createFinance), createFinance);
router.route('/:id').put(checkPermission('finance', 'write'), upload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'invoice', maxCount: 1 }]), updateFinance).delete(checkPermission('finance', 'write'), deleteFinance);

module.exports = router;
