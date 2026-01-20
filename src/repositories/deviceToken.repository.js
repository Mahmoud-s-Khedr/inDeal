/**
 * Device Token Repository
 * Manages FCM device tokens for push notifications
 */

const db = require('../config/db');

/**
 * Register a device token
 */
const upsert = async (userId, token, deviceType, deviceInfo = null) => {
    const { rows } = await db.query(
        `INSERT INTO user_device_tokens (user_id, token, device_type, device_info, last_used_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, token) 
     DO UPDATE SET last_used_at = NOW(), device_type = $3, device_info = $4
     RETURNING *`,
        [userId, token, deviceType, deviceInfo ? JSON.stringify(deviceInfo) : null]
    );
    return rows[0];
};

/**
 * Get all tokens for a user
 */
const findByUserId = async (userId) => {
    const { rows } = await db.query(
        `SELECT * FROM user_device_tokens WHERE user_id = $1 ORDER BY last_used_at DESC`,
        [userId]
    );
    return rows;
};

/**
 * Get all tokens for multiple users
 */
const findByUserIds = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    const { rows } = await db.query(
        `SELECT * FROM user_device_tokens WHERE user_id = ANY($1)`,
        [userIds]
    );
    return rows;
};

/**
 * Delete a specific token
 */
const deleteToken = async (userId, token) => {
    const { rowCount } = await db.query(
        `DELETE FROM user_device_tokens WHERE user_id = $1 AND token = $2`,
        [userId, token]
    );
    return rowCount > 0;
};

/**
 * Delete all tokens for a user
 */
const deleteAllForUser = async (userId) => {
    const { rowCount } = await db.query(
        `DELETE FROM user_device_tokens WHERE user_id = $1`,
        [userId]
    );
    return rowCount;
};

/**
 * Update token last used timestamp
 */
const touch = async (token) => {
    await db.query(
        `UPDATE user_device_tokens SET last_used_at = NOW() WHERE token = $1`,
        [token]
    );
};

/**
 * Delete stale tokens (unused for X days)
 */
const deleteStale = async (olderThanDays = 90) => {
    const { rowCount } = await db.query(
        `DELETE FROM user_device_tokens 
     WHERE last_used_at < NOW() - INTERVAL '1 day' * $1`,
        [olderThanDays]
    );
    return rowCount;
};

module.exports = {
    upsert,
    findByUserId,
    findByUserIds,
    deleteToken,
    deleteAllForUser,
    touch,
    deleteStale,
};
