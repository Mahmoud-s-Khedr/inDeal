/**
 * Firebase Admin SDK Configuration
 * Push notifications with enhanced logging
 */

const admin = require('firebase-admin');
const config = require('./env');
const { createServiceLogger } = require('./pino');

// Create service-specific logger
const log = createServiceLogger('firebase');

let firebaseApp = null;

const hasCredentials =
    config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey;

if (hasCredentials) {
    try {
        firebaseApp =
            admin.apps.length > 0
                ? admin.app()
                : admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: config.firebase.projectId,
                        clientEmail: config.firebase.clientEmail,
                        privateKey: config.firebase.privateKey,
                    }),
                });
        log.info({ projectId: config.firebase.projectId }, 'Firebase Admin initialized');
    } catch (err) {
        firebaseApp = null;
        log.error({ err }, 'Failed to initialize Firebase Admin SDK');
    }
} else {
    log.warn('Firebase configuration incomplete. Push notifications disabled.');
}

const messaging = firebaseApp ? admin.messaging() : null;

/**
 * Send a push notification to a single device
 * @param {Object} params - Notification parameters
 * @param {string} params.token - FCM device token
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} [params.data] - Additional data payload
 * @returns {Promise<string>} Message ID
 */
const sendNotification = async ({ token, title, body, data = {} }) => {
    if (!messaging) {
        log.warn({ operation: 'send' }, 'Firebase messaging not configured, skipping notification');
        return null;
    }

    const start = Date.now();

    try {
        const message = {
            token,
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
        };

        const messageId = await messaging.send(message);
        const duration = Date.now() - start;

        log.info(
            { operation: 'send', messageId, durationMs: duration, hasData: Object.keys(data).length > 0 },
            'Firebase push notification sent'
        );

        return messageId;
    } catch (err) {
        const duration = Date.now() - start;
        log.error(
            { err, operation: 'send', durationMs: duration, errorCode: err.code },
            'Firebase push notification failed'
        );
        throw err;
    }
};

/**
 * Send a push notification to multiple devices
 * @param {Object} params - Notification parameters
 * @param {string[]} params.tokens - Array of FCM device tokens
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} [params.data] - Additional data payload
 * @returns {Promise<Object>} Batch response
 */
const sendMulticastNotification = async ({ tokens, title, body, data = {} }) => {
    if (!messaging) {
        log.warn({ operation: 'multicast' }, 'Firebase messaging not configured, skipping notification');
        return null;
    }

    if (!tokens || tokens.length === 0) {
        log.debug({ operation: 'multicast' }, 'No tokens provided for multicast');
        return { successCount: 0, failureCount: 0 };
    }

    const start = Date.now();

    try {
        const message = {
            tokens,
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
        };

        const response = await messaging.sendEachForMulticast(message);
        const duration = Date.now() - start;

        log.info(
            {
                operation: 'multicast',
                totalTokens: tokens.length,
                successCount: response.successCount,
                failureCount: response.failureCount,
                durationMs: duration,
            },
            'Firebase multicast notification completed'
        );

        // Log failures for debugging
        if (response.failureCount > 0) {
            const failures = response.responses
                .map((r, i) => ({ index: i, error: r.error?.code }))
                .filter((r) => r.error);
            log.debug({ failures: failures.slice(0, 10) }, 'Multicast failures (first 10)');
        }

        return response;
    } catch (err) {
        const duration = Date.now() - start;
        log.error(
            { err, operation: 'multicast', tokenCount: tokens.length, durationMs: duration },
            'Firebase multicast notification failed'
        );
        throw err;
    }
};

/**
 * Subscribe tokens to a topic
 * @param {string[]} tokens - FCM device tokens
 * @param {string} topic - Topic name
 * @returns {Promise<Object>} Subscription response
 */
const subscribeToTopic = async (tokens, topic) => {
    if (!messaging) {
        log.warn({ operation: 'subscribe' }, 'Firebase messaging not configured');
        return null;
    }

    const start = Date.now();

    try {
        const response = await messaging.subscribeToTopic(tokens, topic);
        const duration = Date.now() - start;

        log.info(
            { operation: 'subscribe', topic, tokenCount: tokens.length, successCount: response.successCount, durationMs: duration },
            'Firebase topic subscription completed'
        );

        return response;
    } catch (err) {
        const duration = Date.now() - start;
        log.error(
            { err, operation: 'subscribe', topic, durationMs: duration },
            'Firebase topic subscription failed'
        );
        throw err;
    }
};

module.exports = {
    firebaseApp,
    messaging,
    sendNotification,
    sendMulticastNotification,
    subscribeToTopic,
};
