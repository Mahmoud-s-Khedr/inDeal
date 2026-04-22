const { pool } = require('../config/db');

/**
 * Create an email log entry
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
const createLog = async (payload) => {
  const result = await pool.query(
    `INSERT INTO email_logs (recipient, template, subject, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [payload.recipient, payload.template, payload.subject, payload.status || 'queued']
  );
  return result.rows[0];
};

/**
 * Update email log status
 * @param {number} logId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
const updateLog = async (logId, updates) => {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.messageId !== undefined) {
    setClauses.push(`message_id = $${paramIndex++}`);
    values.push(updates.messageId);
  }
  if (updates.error !== undefined) {
    setClauses.push(`error = $${paramIndex++}`);
    values.push(updates.error);
  }
  if (updates.sentAt !== undefined) {
    setClauses.push(`sent_at = $${paramIndex++}`);
    values.push(updates.sentAt);
  }
  if (updates.attempts !== undefined) {
    setClauses.push(`attempts = $${paramIndex++}`);
    values.push(updates.attempts);
  }

  if (setClauses.length === 0) return null;

  values.push(logId);
  const result = await pool.query(
    `UPDATE email_logs SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
};

/**
 * Get log by ID
 * @param {number} logId
 * @returns {Promise<Object|null>}
 */
const findById = async (logId) => {
  const result = await pool.query('SELECT * FROM email_logs WHERE id = $1', [logId]);
  return result.rows[0] || null;
};

/**
 * List logs with optional filters
 * @param {Object} filters
 * @returns {Promise<Object[]>}
 */
const listLogs = async (filters = {}) => {
  const { status, template, recipient, limit = 50, offset = 0 } = filters;
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(status);
  }
  if (template) {
    conditions.push(`template = $${paramIndex++}`);
    values.push(template);
  }
  if (recipient) {
    conditions.push(`recipient = $${paramIndex++}`);
    values.push(recipient);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const result = await pool.query(
    `SELECT * FROM email_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );
  return result.rows;
};

/**
 * Get email stats
 * @returns {Promise<Object>}
 */
const getStats = async () => {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'queued') as queued
    FROM email_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  return result.rows[0];
};

module.exports = {
  createLog,
  updateLog,
  findById,
  listLogs,
  getStats,
};
