const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const ctrl = require('../controllers/budgetController');

router.use(protect);
router.get('/stats', checkPermission('budgets', 'read'), ctrl.getBudgetStats);
router.route('/')
  .get(checkPermission('budgets', 'read'), ctrl.getBudgets)
  .post(checkPermission('budgets', 'write'), ctrl.createBudget);
router.route('/:id')
  .get(checkPermission('budgets', 'read'), ctrl.getBudgetById)
  .put(checkPermission('budgets', 'write'), ctrl.updateBudget)
  .delete(checkPermission('budgets', 'write'), ctrl.deleteBudget);
router.post('/:id/items', checkPermission('budgets', 'write'), ctrl.addItem);
router.put('/:id/items/:itemId', checkPermission('budgets', 'write'), ctrl.updateItem);
router.delete('/:id/items/:itemId', checkPermission('budgets', 'write'), ctrl.deleteItem);
router.get('/:id/actual', checkPermission('budgets', 'read'), ctrl.getBudgetVsActual);

module.exports = router;
