const express = require('express');
const optionalAuth = require('../../../core/middleware/optionalAuthMiddleware');
const validate = require('../../../core/middleware/validateMiddleware');
const searchController = require('../controller/search.controller');
const { searchSchema } = require('../validation/search.validation');

const router = express.Router();

router.get('/', optionalAuth, validate(searchSchema), searchController.search);

module.exports = router;
