const { body, param, query, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array().map(e => e.msg) });
  };
};

const commonValidations = {
  createTask: [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('deadline').notEmpty().withMessage('Deadline is required'),
  ],
  createFinance: [
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('category').trim().notEmpty().withMessage('Category is required'),
  ],
  createCampaign: [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('startDate').notEmpty().withMessage('Start date is required'),
    body('endDate').notEmpty().withMessage('End date is required'),
  ],
  createContact: [
    body('name').trim().notEmpty().withMessage('Contact name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
  ],
};

module.exports = { validate, commonValidations };
