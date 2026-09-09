const express = require('express');
const router = express.Router();
const { protect, checkPermission, allowRoles } = require('../middleware/auth');
const { getUsers, getUserById, createUser, updateUser, deleteUser, toggleActive, resetPassword, getTeamStats, getPermissionsMatrix } = require('../controllers/userController');

router.use(protect);
router.use(allowRoles('admin'));

router.get('/stats', getTeamStats);
router.get('/permissions', getPermissionsMatrix);
router.route('/')
  .get(getUsers)
  .post(createUser);
router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);
router.put('/:id/toggle-active', toggleActive);
router.put('/:id/reset-password', resetPassword);

module.exports = router;
