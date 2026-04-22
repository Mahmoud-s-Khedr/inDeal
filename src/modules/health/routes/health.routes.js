const express = require('express');
const { healthCheck } = require('../controller/health.controller');

const router = express.Router();

router.get('/', healthCheck);

module.exports = router;
