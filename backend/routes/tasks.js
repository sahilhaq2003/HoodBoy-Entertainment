const express = require('express');
const router = express.Router();
const { getTasks, getTask, createTask, updateTask, deleteTask, getKanban, getTeamPerformance, getStats } = require('../controllers/taskController');
const { protect, checkPermission } = require('../middleware/auth');
const { validate, commonValidations } = require('../middleware/validate');

router.use(protect);
router.get('/kanban', checkPermission('tasks', 'read'), getKanban);
router.get('/team', checkPermission('tasks', 'read'), getTeamPerformance);
router.get('/stats', checkPermission('tasks', 'read'), getStats);
router.route('/').get(checkPermission('tasks', 'read'), getTasks).post(checkPermission('tasks', 'create'), validate(commonValidations.createTask), createTask);
router.route('/:id').get(checkPermission('tasks', 'read'), getTask).put(checkPermission('tasks', 'update'), updateTask).delete(checkPermission('tasks', 'delete'), deleteTask);

module.exports = router;
