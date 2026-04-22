const express = require('express');
const healthRoutes = require('./health.routes');
const systemRoutes = require('./system.routes');
const authRoutes = require('./auth.routes');
const companyRoutes = require('./company.routes');
const fileRoutes = require('./file.routes');
const userRoutes = require('./user.routes');
const dealRoutes = require('./deal.routes');
const chatRoutes = require('./chat.routes');
const supportRoutes = require('./support.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/system', systemRoutes);
router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/files', fileRoutes);
router.use('/users', userRoutes);
router.use('/deals', dealRoutes);
router.use('/chats', chatRoutes);
router.use('/support', supportRoutes);

module.exports = router;
