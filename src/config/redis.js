const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    username: config.redis.username,
    lazyConnect: false,
});

redis.on('ready', () => logger.info('Valkey (Redis) connection ready'));
redis.on('error', (err) => logger.error('Valkey (Redis) connection error', err));

module.exports = redis;
