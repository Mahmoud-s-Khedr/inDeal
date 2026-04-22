const express = require('express');
const v1Routes = require('./v1');
const { mountRouter } = require('./mountRouter');

const router = express.Router();

mountRouter(router, '/v1', v1Routes);

module.exports = router;
