const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const ctrl = require('../controllers/contactController');
const { validate, commonValidations } = require('../middleware/validate');

router.use(protect);
router.get('/stats', checkPermission('contacts', 'read'), ctrl.getStats);
router.get('/reminders', checkPermission('contacts', 'read'), ctrl.getUpcomingReminders);
router.route('/')
  .get(checkPermission('contacts', 'read'), ctrl.getContacts)
  .post(checkPermission('contacts', 'write'), validate(commonValidations.createContact), ctrl.createContact);
router.route('/:id')
  .get(checkPermission('contacts', 'read'), ctrl.getContactById)
  .put(checkPermission('contacts', 'write'), ctrl.updateContact)
  .delete(checkPermission('contacts', 'write'), ctrl.deleteContact);
router.patch('/:id/favorite', checkPermission('contacts', 'write'), ctrl.toggleFavorite);
router.post('/:id/interactions', checkPermission('contacts', 'write'), ctrl.addInteraction);
router.delete('/:id/interactions/:interactionId', checkPermission('contacts', 'write'), ctrl.deleteInteraction);
router.post('/:id/reminders', checkPermission('contacts', 'write'), ctrl.addReminder);
router.put('/:id/reminders/:reminderId', checkPermission('contacts', 'write'), ctrl.completeReminder);
router.delete('/:id/reminders/:reminderId', checkPermission('contacts', 'write'), ctrl.deleteReminder);

module.exports = router;
