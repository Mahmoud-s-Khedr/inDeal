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
const { mountRouter } = require('../mountRouter');

const router = express.Router();

mountRouter(router, '/health', healthRoutes);
mountRouter(router, '/system', systemRoutes);
mountRouter(router, '/auth', authRoutes);
mountRouter(router, '/companies', companyRoutes);
mountRouter(router, '/files', fileRoutes);
mountRouter(router, '/users', userRoutes);
mountRouter(router, '/deals', dealRoutes);
mountRouter(router, '/chats', chatRoutes);
mountRouter(router, '/support', supportRoutes);

module.exports = router;
