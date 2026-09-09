const express = require('express');
const router = express.Router();
const { getRoyalties, getArtistRoyaltySummary, createRoyaltyEntry, calculateRoyalties, updateRoyaltyEntry, deleteRoyaltyEntry, generateStatement, recordPayment, approveRoyaltyEntry } = require('../controllers/royaltyController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/', checkPermission('royalties', 'read'), getRoyalties);
router.get('/summary/:artistId', checkPermission('royalties', 'read'), getArtistRoyaltySummary);
router.post('/', checkPermission('royalties', 'write'), createRoyaltyEntry);
router.post('/:id/calculate', checkPermission('royalties', 'write'), calculateRoyalties);
router.post('/:id/statement', checkPermission('royalties', 'write'), generateStatement);
router.post('/:id/payments', checkPermission('royalties', 'write'), recordPayment);
router.post('/:id/approve', checkPermission('royalties', 'write'), approveRoyaltyEntry);
router.put('/:id', checkPermission('royalties', 'write'), updateRoyaltyEntry);
router.delete('/:id', checkPermission('royalties', 'write'), deleteRoyaltyEntry);

module.exports = router;
