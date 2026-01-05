// This file is for local development only
// On Vercel, api/index.js is used instead

const http = require('http');
const app = require('./app');
const { pool } = require('./config/db');
const config = require('./config/env');
const logger = require('./utils/logger');
const redis = require('./config/redis');

// Eager-load infrastructure modules so configuration issues surface on boot
require('./config/firebase');
require('./config/storage');
require('./config/mailer');
require('./config/queue');

const server = http.createServer(app);

// Socket.io is disabled for Vercel deployment
// For real-time features, use a separate WebSocket service (Pusher, Ably, etc.)
// or deploy WebSocket server to Railway/Render
const ENABLE_SOCKETIO = process.env.ENABLE_SOCKETIO === 'true';

let io = null;

if (ENABLE_SOCKETIO) {
    const { Server } = require('socket.io');
    
    io = new Server(server, {
        cors: {
            origin: '*', // Configure allowed origins before production
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        logger.debug(`Socket connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.debug(`Socket disconnected: ${socket.id}`);
        });
    });

    logger.info('Socket.io enabled');
} else {
    logger.info('Socket.io disabled (set ENABLE_SOCKETIO=true to enable)');
}

const startServer = async () => {
    try {
        // Verify database connection on startup (local dev only)
        const client = await pool.connect();
        client.release();
        logger.info('Database connection verified');

        server.listen(config.app.port, () => {
            logger.info(`Server running on port ${config.app.port} (${config.app.env})`);
        });
    } catch (error) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
};

const gracefulShutdown = async (signal) => {
    logger.warn(`${signal} received. Shutting down gracefully...`);

    server.close(async (err) => {
        if (err) {
            logger.error('Error shutting down HTTP server', err);
        }
        try {
            if (io) {
                io.close();
            }
            await pool.end();
            await redis.quit();
        } catch (error) {
            logger.error('Error during shutdown', error);
        } finally {
            process.exit(0);
        }
    });
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => gracefulShutdown(signal));
});

// Only start server if this file is run directly (not imported)
if (require.main === module) {
    startServer();
}
