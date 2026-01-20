const { pool } = require('../config/db');

const createNotification = async (payload) => {
  const result = await pool.query(
    `
    INSERT INTO notifications (user_id, type, title, message, is_read, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      payload.userId,
      payload.type,
      payload.title,
      payload.message,
      payload.isRead || false,
      payload.metadata || {},
    ]
  );
  return result.rows[0];
};

const listByUserId = async (userId, limit = 50, offset = 0) => {
  const result = await pool.query(
    `
    SELECT * FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );
  return result.rows;
};

const countUnread = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
};

const markAsRead = async (notificationId, userId) => {
  const result = await pool.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [notificationId, userId]
  );
  return result.rows[0];
};

const markAllAsRead = async (userId) => {
  await pool.query(`UPDATE notifications SET is_read = true WHERE user_id = $1`, [userId]);
};

const deleteById = async (notificationId, userId) => {
  const result = await pool.query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *`,
    [notificationId, userId]
  );
  return result.rows[0];
};

const deleteAllRead = async (userId) => {
  const result = await pool.query(
    `DELETE FROM notifications WHERE user_id = $1 AND is_read = true`,
    [userId]
  );
  return result.rowCount;
};

/**
 * Delete old notifications based on retention policy
 * @param {number} readDays - Delete read notifications older than this many days
 * @param {number} unreadDays - Delete unread notifications older than this many days
 * @returns {Promise<{readDeleted: number, unreadDeleted: number}>}
 */
const deleteOlderThan = async (readDays = 90, unreadDays = 180) => {
  const readResult = await pool.query(
    `DELETE FROM notifications WHERE is_read = true AND created_at < NOW() - INTERVAL '1 day' * $1`,
    [readDays]
  );
  const unreadResult = await pool.query(
    `DELETE FROM notifications WHERE is_read = false AND created_at < NOW() - INTERVAL '1 day' * $1`,
    [unreadDays]
  );
  return {
    readDeleted: readResult.rowCount,
    unreadDeleted: unreadResult.rowCount,
  };
};

module.exports = {
  createNotification,
  listByUserId,
  countUnread,
  markAsRead,
  markAllAsRead,
  deleteById,
  deleteAllRead,
  deleteOlderThan,
};
