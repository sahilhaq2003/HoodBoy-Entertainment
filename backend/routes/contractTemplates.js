const express = require('express');
const router = express.Router();
const { getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate } = require('../controllers/contractTemplateController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);
router.get('/', checkPermission('contractTemplates', 'read'), getTemplates);
router.get('/:id', checkPermission('contractTemplates', 'read'), getTemplate);
router.post('/', checkPermission('contractTemplates', 'write'), createTemplate);
router.put('/:id', checkPermission('contractTemplates', 'write'), updateTemplate);
router.delete('/:id', checkPermission('contractTemplates', 'write'), deleteTemplate);

module.exports = router;
