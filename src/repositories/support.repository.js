const { pool } = require('../config/db');

// ─────────────────────────────────────────────────────────────
// SUPPORT TICKET OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new support ticket
 */
const createTicket = async (client, data) => {
  const executor = client || pool;
  const result = await executor.query(
    `
        INSERT INTO support_tickets (
            user_id, company_id, subject, message, email, priority, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'open')
        RETURNING *
        `,
    [
      data.userId || null,
      data.companyId || null,
      data.subject,
      data.message,
      data.email,
      data.priority || 'medium',
    ]
  );
  return result.rows[0];
};

/**
 * Find ticket by ID
 */
const findById = async (id) => {
  const result = await pool.query(
    `
        SELECT t.*,
               u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name,
               c.name AS company_name
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN companies c ON t.company_id = c.id
        WHERE t.id = $1
        `,
    [id]
  );
  return result.rows[0];
};

/**
 * Find tickets by user ID
 */
const findByUserId = async (userId, { status, limit = 20, offset = 0 } = {}) => {
  let query = `
        SELECT * FROM support_tickets
        WHERE user_id = $1
    `;
  const params = [userId];
  let paramIndex = 2;

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Update ticket status
 */
const updateStatus = async (id, status, adminNotes = null) => {
  const result = await pool.query(
    `
        UPDATE support_tickets
        SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
    [status, adminNotes, id]
  );
  return result.rows[0];
};

/**
 * Add response to ticket
 */
const addResponse = async (ticketId, responderUserId, message) => {
  const result = await pool.query(
    `
        INSERT INTO support_ticket_responses (ticket_id, responder_user_id, message)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
    [ticketId, responderUserId, message]
  );

  // Update ticket status and updated_at
  await pool.query(
    `UPDATE support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
    [ticketId]
  );

  return result.rows[0];
};

/**
 * Get ticket responses
 */
const getResponses = async (ticketId) => {
  const result = await pool.query(
    `
        SELECT r.*,
               u.first_name AS responder_first_name, u.last_name AS responder_last_name,
               u.role AS responder_role
        FROM support_ticket_responses r
        JOIN users u ON r.responder_user_id = u.id
        WHERE r.ticket_id = $1
        ORDER BY r.created_at ASC
        `,
    [ticketId]
  );
  return result.rows;
};

// ─────────────────────────────────────────────────────────────
// ADMIN: LIST ALL TICKETS
// ─────────────────────────────────────────────────────────────

const findAll = async ({ status, priority, limit = 50, offset = 0 } = {}) => {
  let query = `
        SELECT t.*,
               u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name,
               c.name AS company_name
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN companies c ON t.company_id = c.id
        WHERE 1=1
    `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND t.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (priority) {
    query += ` AND t.priority = $${paramIndex}`;
    params.push(priority);
    paramIndex++;
  }

  query += ` ORDER BY 
        CASE t.priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
        END,
        t.created_at DESC
    `;
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

const countAll = async ({ status, priority } = {}) => {
  let query = `SELECT COUNT(*) AS total FROM support_tickets WHERE 1=1`;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (priority) {
    query += ` AND priority = $${paramIndex}`;
    params.push(priority);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].total, 10);
};

const countByUserId = async (userId, status = null) => {
  let query = `SELECT COUNT(*) AS total FROM support_tickets WHERE user_id = $1`;
  const params = [userId];

  if (status) {
    query += ` AND status = $2`;
    params.push(status);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].total, 10);
};

module.exports = {
  createTicket,
  findById,
  findByUserId,
  updateStatus,
  addResponse,
  getResponses,
  findAll,
  countAll,
  countByUserId,
};
