const Redis = require('ioredis');
const config = require('./env');
const logger = require('../../shared/utils/logger');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  username: config.redis.username,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

redis.on('ready', () =>
  logger.info(`Valkey (Redis) connection ready @ ${config.redis.host}:${config.redis.port}`)
);
redis.on('error', (err) =>
  logger.error(
    { err, redisHost: config.redis.host, redisPort: config.redis.port },
    'Valkey (Redis) connection error'
  )
);

module.exports = redis;
