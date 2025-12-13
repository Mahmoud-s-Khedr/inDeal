const { Queue, Worker, QueueScheduler } = require('bullmq');
const logger = require('../utils/logger');
const config = require('./env');

const connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
};

const schedulers = new Map();

const ensureScheduler = (name) => {
    if (schedulers.has(name)) return;

    const scheduler = new QueueScheduler(name, { connection });
    scheduler
        .waitUntilReady()
        .then(() => logger.info(`Queue scheduler ready: ${name}`))
        .catch((err) => logger.error(`Queue scheduler failed for ${name}`, err));

    schedulers.set(name, scheduler);
};

const createQueue = (name, options = {}) => {
    ensureScheduler(name);
    return new Queue(name, { connection, ...options });
};

const createWorker = (name, processor, options = {}) => {
    ensureScheduler(name);
    return new Worker(name, processor, { connection, ...options });
};

module.exports = {
    connection,
    createQueue,
    createWorker,
};
