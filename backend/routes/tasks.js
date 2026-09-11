const express = require('express');
const router = express.Router();
const { getTasks, getTask, createTask, updateTask, deleteTask, addComment, getKanban, getTeamPerformance, getStats, getAssignableUsers } = require('../controllers/taskController');
const { protect, checkPermission } = require('../middleware/auth');
const { validate, commonValidations } = require('../middleware/validate');

router.use(protect);
router.get('/kanban', checkPermission('tasks', 'read'), getKanban);
router.get('/team', checkPermission('tasks', 'write'), getTeamPerformance);
router.get('/stats', checkPermission('tasks', 'read'), getStats);
router.get('/assignable', checkPermission('tasks', 'write'), getAssignableUsers);
router.route('/').get(checkPermission('tasks', 'read'), getTasks).post(checkPermission('tasks', 'create'), validate(commonValidations.createTask), createTask);
router.post('/:id/comments', checkPermission('tasks', 'read'), addComment);
router.route('/:id')
  .get(checkPermission('tasks', 'read'), getTask)
  .put(checkPermission('tasks', 'read'), updateTask)
  .delete(checkPermission('tasks', 'delete'), deleteTask);

module.exports = router;
