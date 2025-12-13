const express = require('express');
const { getStats, getConfig } = require('../../controllers/system.controller');

const router = express.Router();

router.get('/stats', getStats);
router.get('/config', getConfig);

module.exports = router;
