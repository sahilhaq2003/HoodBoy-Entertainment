const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const ctrl = require('../controllers/lnkUpController');
const platform = require('../controllers/linkupPlatformController');
const receiptUpload = require('../middleware/linkupReceiptUpload');
const imageUpload = require('../middleware/linkupImageUpload');
const emailNotifications = require('../controllers/emailNotificationController');

// Public storefront. These routes expose only published inventory and the
// minimum bank details needed to complete a manual transfer.
router.get('/public/events', platform.publicEvents);
router.get('/public/events/:id', platform.publicEvent);
router.get('/public/packages/:id', platform.publicPackage);
router.post('/public/packages/:packageId/book', protect, platform.createBooking);
router.post('/public/packages/:packageId/complete', protect, receiptUpload.single('receipt'), platform.completePackageBooking);
router.post('/public/slots/:slotId/book', protect, platform.createSlotBooking);
router.get('/public/bookings', protect, platform.customerBookings);
router.post('/public/bookings/:reference/receipt', protect, receiptUpload.single('receipt'), platform.submitReceipt);
router.get('/public/bookings/:reference/status', protect, platform.bookingStatus);

router.use(protect);
router.get('/platform/overview', checkPermission('theLnkUp', 'read'), platform.overview);
router.get('/platform/email/settings', emailNotifications.requireAdmin, emailNotifications.getConfiguration);
router.put('/platform/email/settings', emailNotifications.requireAdmin, emailNotifications.updateConfiguration);
router.post('/platform/email/test', emailNotifications.requireAdmin, emailNotifications.testEmail);
router.post('/platform/email/:id/retry', emailNotifications.requireAdmin, emailNotifications.retry);
router.post('/platform/upload-image', checkPermission('theLnkUp', 'write'), imageUpload.single('image'), platform.uploadImage);
router.get('/platform/bookings-export.csv', checkPermission('theLnkUp', 'export'), platform.exportBookings);
router.post('/platform/transfers/:id/verify', checkPermission('theLnkUp', 'write'), (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ success: false, message: 'Only administrators can verify payments' }), platform.verifyTransfer);
router.get('/platform/transfers/:id/receipt', checkPermission('theLnkUp', 'read'), platform.receipt);
router.post('/platform/bookings/:id/cancel', checkPermission('theLnkUp', 'write'), platform.cancelBooking);
router.route('/platform/:resource')
  .get(checkPermission('theLnkUp', 'read'), platform.list)
  .post(checkPermission('theLnkUp', 'write'), platform.create);
router.route('/platform/:resource/:id')
  .get(checkPermission('theLnkUp', 'read'), platform.getOne)
  .put(checkPermission('theLnkUp', 'write'), platform.update)
  .delete(checkPermission('theLnkUp', 'write'), platform.remove);
router.get('/stats', checkPermission('theLnkUp', 'read'), ctrl.getStats);
router.route('/')
  .get(checkPermission('theLnkUp', 'read'), ctrl.getAll)
  .post(checkPermission('theLnkUp', 'write'), ctrl.create);
router.route('/:id')
  .get(checkPermission('theLnkUp', 'read'), ctrl.getById)
  .put(checkPermission('theLnkUp', 'write'), ctrl.update)
  .delete(checkPermission('theLnkUp', 'write'), ctrl.delete);

module.exports = router;
