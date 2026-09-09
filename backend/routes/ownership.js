const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const {
  getBySong, getAll, createOrUpdate, validate, approve, remove, getDashboard,
} = require('../controllers/ownershipController');

router.use(protect);

router.get('/dashboard', checkPermission('ownership', 'read'), getDashboard);
router.get('/validate/:songId', checkPermission('ownership', 'read'), validate);
router.get('/song/:songId', checkPermission('ownership', 'read'), getBySong);
router.get('/', checkPermission('ownership', 'read'), getAll);
router.post('/', checkPermission('ownership', 'write'), createOrUpdate);
router.post('/approve/:songId', checkPermission('ownership', 'write'), approve);
router.delete('/song/:songId', checkPermission('ownership', 'write'), remove);

module.exports = router;
