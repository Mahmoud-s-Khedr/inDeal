const express = require('express');
const { getStats, getConfig } = require('../controller/system.controller');

const router = express.Router();

router.get('/stats', getStats);
router.get('/config', getConfig);

module.exports = router;
