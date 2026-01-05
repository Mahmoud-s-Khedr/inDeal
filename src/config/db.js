const { Pool } = require('pg');
const config = require('./env');
const logger = require('../utils/logger');

// Set DNS resolution to prefer IPv4 before creating the pool
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Use DATABASE_URL if available, otherwise use individual config values
const pool = process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== ''
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    })
    : new Pool({
        user: config.db.user,
        host: config.db.host,
        database: config.db.name,
        password: config.db.password,
        port: config.db.port,
        ssl: {
            rejectUnauthorized: false,
        },
    });

pool.on('connect', () => {
    logger.info('Connected to PostgreSQL');
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle database client', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
