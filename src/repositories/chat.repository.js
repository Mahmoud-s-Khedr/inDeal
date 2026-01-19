const { pool } = require('../config/db');

const run = (client) => client || pool;

// ─────────────────────────────────────────────────────────────
// CHAT ROOM OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create or get existing chat room between two companies
 * Ensures company_a_id < company_b_id constraint is maintained
 */
const findOrCreateRoom = async (client, companyAId, companyBId) => {
  const executor = run(client);

  // Ensure ordering for the constraint
  const [smaller, larger] =
    companyAId < companyBId ? [companyAId, companyBId] : [companyBId, companyAId];

  // Try to find existing room first
  const existing = await executor.query(
    `
        SELECT * FROM chat_rooms
        WHERE company_a_id = $1 AND company_b_id = $2
        LIMIT 1
        `,
    [smaller, larger]
  );

  if (existing.rows[0]) {
    return { room: existing.rows[0], created: false };
  }

  // Create new room
  const result = await executor.query(
    `
        INSERT INTO chat_rooms (company_a_id, company_b_id, status)
        VALUES ($1, $2, 'active')
        RETURNING *
        `,
    [smaller, larger]
  );

  return { room: result.rows[0], created: true };
};

/**
 * Find room by ID
 */
const findRoomById = async (roomId) => {
  const result = await pool.query(
    `
        SELECT r.*,
               ca.name AS company_a_name, ca.logo AS company_a_logo,
               cb.name AS company_b_name, cb.logo AS company_b_logo
        FROM chat_rooms r
        JOIN companies ca ON r.company_a_id = ca.id
        JOIN companies cb ON r.company_b_id = cb.id
        WHERE r.id = $1
        LIMIT 1
        `,
    [roomId]
  );
  return result.rows[0];
};

/**
 * Find rooms for a company (as participant)
 */
const findRoomsByCompanyId = async (companyId, { status, limit = 50, offset = 0 } = {}) => {
  let query = `
        SELECT r.*,
               ca.name AS company_a_name, ca.logo AS company_a_logo,
               cb.name AS company_b_name, cb.logo AS company_b_logo,
               (
                   SELECT m.message_text 
                   FROM chat_messages m 
                   WHERE m.room_id = r.id 
                   ORDER BY m.sent_at DESC 
                   LIMIT 1
               ) AS last_message,
               (
                   SELECT m.sent_at 
                   FROM chat_messages m 
                   WHERE m.room_id = r.id 
                   ORDER BY m.sent_at DESC 
                   LIMIT 1
               ) AS last_message_at
        FROM chat_rooms r
        JOIN companies ca ON r.company_a_id = ca.id
        JOIN companies cb ON r.company_b_id = cb.id
        WHERE (r.company_a_id = $1 OR r.company_b_id = $1)
    `;
  const params = [companyId];
  let paramIndex = 2;

  if (status) {
    query += ` AND r.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY last_message_at DESC NULLS LAST, r.created_at DESC`;
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Update room status
 */
const updateRoomStatus = async (roomId, status) => {
  const result = await pool.query(
    `
        UPDATE chat_rooms
        SET status = $1
        WHERE id = $2
        RETURNING *
        `,
    [status, roomId]
  );
  return result.rows[0];
};

/**
 * Check if company is participant in room
 */
const isRoomParticipant = async (roomId, companyId) => {
  const result = await pool.query(
    `
        SELECT 1 FROM chat_rooms
        WHERE id = $1 AND (company_a_id = $2 OR company_b_id = $2)
        `,
    [roomId, companyId]
  );
  return result.rows.length > 0;
};

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new message
 */
const createMessage = async (client, { roomId, senderUserId, messageText, attachmentFileId }) => {
  const executor = run(client);
  const result = await executor.query(
    `
        INSERT INTO chat_messages (room_id, sender_user_id, message_text, attachment_file_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
    [roomId, senderUserId, messageText || null, attachmentFileId || null]
  );
  return result.rows[0];
};

/**
 * Find messages by room ID with pagination
 */
const findMessagesByRoomId = async (roomId, { limit = 50, offset = 0, before, after } = {}) => {
  let query = `
        SELECT m.*,
               u.first_name AS sender_first_name, u.last_name AS sender_last_name,
               u.profile_image AS sender_profile_image,
               c.id AS sender_company_id, c.name AS sender_company_name,
               f.file_name AS attachment_file_name, f.file_path AS attachment_file_path,
               f.file_metadata AS attachment_file_metadata
        FROM chat_messages m
        JOIN users u ON m.sender_user_id = u.id
        JOIN companies c ON u.id = c.agent_id
        LEFT JOIN files f ON m.attachment_file_id = f.id
        WHERE m.room_id = $1
    `;
  const params = [roomId];
  let paramIndex = 2;

  // Optional cursor-based pagination
  if (before) {
    query += ` AND m.id < $${paramIndex}`;
    params.push(before);
    paramIndex++;
  }
  if (after) {
    query += ` AND m.id > $${paramIndex}`;
    params.push(after);
    paramIndex++;
  }

  query += ` ORDER BY m.sent_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Count messages in a room
 */
const countMessagesByRoomId = async (roomId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS total FROM chat_messages WHERE room_id = $1`,
    [roomId]
  );
  return parseInt(result.rows[0].total, 10);
};

/**
 * Find message by ID
 */
const findMessageById = async (messageId) => {
  const result = await pool.query(
    `
        SELECT m.*,
               u.first_name AS sender_first_name, u.last_name AS sender_last_name,
               f.file_name AS attachment_file_name, f.file_path AS attachment_file_path,
               f.file_metadata AS attachment_file_metadata
        FROM chat_messages m
        JOIN users u ON m.sender_user_id = u.id
        LEFT JOIN files f ON m.attachment_file_id = f.id
        WHERE m.id = $1
        `,
    [messageId]
  );
  return result.rows[0];
};

module.exports = {
  // Room operations
  findOrCreateRoom,
  findRoomById,
  findRoomsByCompanyId,
  updateRoomStatus,
  isRoomParticipant,
  // Message operations
  createMessage,
  findMessagesByRoomId,
  countMessagesByRoomId,
  findMessageById,
};
