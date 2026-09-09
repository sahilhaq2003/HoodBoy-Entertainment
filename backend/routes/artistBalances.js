const express = require('express');
const router = express.Router();
const { getAll, getArtistBalance, getArtistBalanceHistory, create, addTransaction, update, delete: remove } = require('../controllers/artistBalanceController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/', checkPermission('artistBalances', 'read'), getAll);
router.get('/artist/:artistId', checkPermission('artistBalances', 'read'), getArtistBalance);
router.get('/artist/:artistId/history', checkPermission('artistBalances', 'read'), getArtistBalanceHistory);
router.post('/', checkPermission('artistBalances', 'write'), create);
router.post('/:id/transactions', checkPermission('artistBalances', 'write'), addTransaction);
router.put('/:id', checkPermission('artistBalances', 'write'), update);
router.delete('/:id', checkPermission('artistBalances', 'write'), remove);

module.exports = router;
