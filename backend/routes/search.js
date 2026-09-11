const express = require('express');
const { protect } = require('../middleware/auth');
const { workspaceSearch } = require('../controllers/searchController');

const router = express.Router();
router.get('/', protect, workspaceSearch);

module.exports = router;
