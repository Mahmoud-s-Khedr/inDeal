const express = require('express');
const healthRoutes = require('./health.routes');
const systemRoutes = require('./system.routes');
const authRoutes = require('./auth.routes');
const companyRoutes = require('./company.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/system', systemRoutes);
router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);

module.exports = router;
