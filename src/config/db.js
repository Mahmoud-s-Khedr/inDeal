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
    logger.debug('Database client connected');
});

pool.on('error', (err) => {
    logger.error({ err, source: 'pg-pool' }, 'Unexpected error on idle database client');
});

/**
 * Execute a database query with optional logging
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const query = async (text, params) => {
    const start = Date.now();

    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        // Log slow queries
        if (duration > config.log.slowQueryMs) {
            logger.warn(
                {
                    query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                    duration,
                    rowCount: result.rowCount,
                    threshold: config.log.slowQueryMs,
                },
                'Slow database query detected'
            );
        } else {
            logger.debug(
                {
                    query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                    duration,
                    rowCount: result.rowCount,
                },
                'Database query executed'
            );
        }

        return result;
    } catch (err) {
        const duration = Date.now() - start;
        logger.error(
            {
                err,
                query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                duration,
                source: 'pg-query',
            },
            'Database query failed'
        );
        throw err;
    }
};

module.exports = {
    query,
    pool,
};
