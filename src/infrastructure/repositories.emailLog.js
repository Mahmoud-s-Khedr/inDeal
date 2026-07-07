const { pool } = require('./config/db');
const prisma = require('./config/prisma');

/**
 * Create an email log entry
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
const createLog = async (payload) => {
  return await prisma.emailLog.create({
    data: {
      recipient: payload.recipient,
      template: payload.template,
      subject: payload.subject,
      status: payload.status || 'queued',
    },
  });
};

/**
 * Update email log status
 * @param {number} logId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
const updateLog = async (logId, updates) => {
  const data = {};

  if (updates.status !== undefined) data.status = updates.status;
  if (updates.messageId !== undefined) data.message_id = updates.messageId;
  if (updates.error !== undefined) data.error = updates.error;
  if (updates.sentAt !== undefined) data.sent_at = updates.sentAt;
  if (updates.attempts !== undefined) data.attempts = updates.attempts;

  if (!Object.keys(data).length) return null;

  try {
    return await prisma.emailLog.update({
      where: { id: logId },
      data,
    });
  } catch (error) {
    if (error && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

/**
 * Get log by ID
 * @param {number} logId
 * @returns {Promise<Object|null>}
 */
const findById = async (logId) => {
  return await prisma.emailLog.findUnique({ where: { id: logId } });
};

/**
 * List logs with optional filters
 * @param {Object} filters
 * @returns {Promise<Object[]>}
 */
const listLogs = async (filters = {}) => {
  const { status, template, recipient, limit = 50, offset = 0 } = filters;
  const safeLimit = Number.isInteger(limit) ? limit : parseInt(limit, 10) || 50;
  const safeOffset = Number.isInteger(offset) ? offset : parseInt(offset, 10) || 0;

  const where = {};
  if (status) where.status = status;
  if (template) where.template = template;
  if (recipient) where.recipient = recipient;

  return await prisma.emailLog.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: safeLimit,
    skip: safeOffset,
  });
};

/**
 * Get email stats
 * Raw SQL retained for one-pass aggregate counters (performance-sensitive path).
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
