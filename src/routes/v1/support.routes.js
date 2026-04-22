const express = require('express');
const supportController = require('../../controllers/support.controller');

const router = express.Router();

// Get support contact info
router.get('/info', supportController.getSupportInfo);

// Email support redirect payload for clients
router.get('/email-redirect', supportController.getEmailSupportRedirect);

module.exports = router;
