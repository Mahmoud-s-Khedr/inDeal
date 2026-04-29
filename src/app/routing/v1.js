const express = require('express');
const { mountRouter } = require('./mountRouter');

const healthModule = require('../../modules/health');
const systemModule = require('../../modules/system');
const authModule = require('../../modules/auth');
const companyModule = require('../../modules/company');
const fileModule = require('../../modules/file');
const userModule = require('../../modules/user');
const dealModule = require('../../modules/deal');
const chatModule = require('../../modules/chat');
const searchModule = require('../../modules/search');

const router = express.Router();

mountRouter(router, '/health', healthModule.router);
mountRouter(router, '/system', systemModule.router);
mountRouter(router, '/auth', authModule.router);
mountRouter(router, '/companies', companyModule.router);
mountRouter(router, '/files', fileModule.router);
mountRouter(router, '/users', userModule.router);
mountRouter(router, '/deals', dealModule.router);
mountRouter(router, '/chats', chatModule.router);
mountRouter(router, '/search', searchModule.router);

module.exports = router;
