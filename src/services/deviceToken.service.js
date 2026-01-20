/**
 * Device Token Service
 * Manages FCM device tokens for push notifications
 */

const deviceTokenRepository = require('../repositories/deviceToken.repository');
const logger = require('../utils/logger');

/**
 * Sanitize device token for API response
 */
const sanitizeToken = (token) => ({
    id: token.id,
    deviceType: token.device_type,
    deviceInfo: token.device_info,
    createdAt: token.created_at,
    lastUsedAt: token.last_used_at,
});

/**
 * Register a device token
 * @param {number} userId - User ID
 * @param {string} token - FCM device token
 * @param {string} deviceType - 'ios', 'android', or 'web'
 * @param {Object} deviceInfo - Optional device metadata
 */
const registerDevice = async (userId, token, deviceType, deviceInfo = null) => {
    const result = await deviceTokenRepository.upsert(userId, token, deviceType, deviceInfo);
    logger.info({ userId, deviceType }, 'Device token registered');
    return sanitizeToken(result);
};

/**
 * Unregister a device token
 */
const unregisterDevice = async (userId, token) => {
    const deleted = await deviceTokenRepository.deleteToken(userId, token);
    if (deleted) {
        logger.info({ userId }, 'Device token unregistered');
    }
    return deleted;
};

/**
 * Get all device tokens for a user
 */
const getUserDevices = async (userId) => {
    const tokens = await deviceTokenRepository.findByUserId(userId);
    return tokens.map(sanitizeToken);
};

/**
 * Get FCM tokens for a list of user IDs (for sending push)
 * Returns array of token strings
 */
const getTokensForUsers = async (userIds) => {
    const tokens = await deviceTokenRepository.findByUserIds(userIds);
    return tokens.map((t) => t.token);
};

/**
 * Get FCM tokens for a single user
 */
const getTokensForUser = async (userId) => {
    const tokens = await deviceTokenRepository.findByUserId(userId);
    return tokens.map((t) => t.token);
};

/**
 * Clear all devices for a user (e.g., on logout all)
 */
const clearUserDevices = async (userId) => {
    const count = await deviceTokenRepository.deleteAllForUser(userId);
    logger.info({ userId, count }, 'All device tokens cleared');
    return count;
};

module.exports = {
    registerDevice,
    unregisterDevice,
    getUserDevices,
    getTokensForUsers,
    getTokensForUser,
    clearUserDevices,
};
