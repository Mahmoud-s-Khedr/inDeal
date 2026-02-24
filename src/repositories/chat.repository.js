const { pool } = require('../config/db');
const { generateRoomKey } = require('../utils/chatEncryption');

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

  // Create new room with a unique AES-256 encryption key
  const encryptionKey = generateRoomKey();
  const result = await executor.query(
    `
        INSERT INTO chat_rooms (company_a_id, company_b_id, status, encryption_key)
        VALUES ($1, $2, 'active', $3)
        RETURNING *
        `,
    [smaller, larger, encryptionKey]
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
               fca.file_path AS company_a_logo_path,
               cb.name AS company_b_name, cb.logo AS company_b_logo,
               fcb.file_path AS company_b_logo_path
        FROM chat_rooms r
        JOIN companies ca ON r.company_a_id = ca.id
        JOIN companies cb ON r.company_b_id = cb.id
        LEFT JOIN files fca ON fca.id = ca.logo
        LEFT JOIN files fcb ON fcb.id = cb.logo
        WHERE r.id = $1
        LIMIT 1
        `,
    [roomId]
  );
  return result.rows[0];
};

/**
 * Find room by ID with unread count for a company
 */
const findRoomByIdForCompany = async (roomId, companyId) => {
  const result = await pool.query(
    `
        SELECT r.*,
               ca.name AS company_a_name, ca.logo AS company_a_logo,
               fca.file_path AS company_a_logo_path,
               cb.name AS company_b_name, cb.logo AS company_b_logo,
               fcb.file_path AS company_b_logo_path,
         lm.message_text AS last_message,
         lm.sent_at AS last_message_at,
         lm.id AS last_message_id,
         lm.last_message_sender_id,
         lm.attachment_file_id AS last_attachment_file_id,
         lm.attachment_file_name AS last_attachment_file_name,
         lm.attachment_file_path AS last_attachment_file_path,
         lm.attachment_file_metadata AS last_attachment_file_metadata,
               (
                   SELECT COUNT(*)
                   FROM chat_messages m
                   JOIN users u ON m.sender_user_id = u.id
                   JOIN companies sc ON u.id = sc.agent_id
                   LEFT JOIN chat_message_reads mr
                     ON mr.message_id = m.id AND mr.company_id = $2
                   WHERE m.room_id = r.id
                     AND sc.id <> $2
                     AND mr.message_id IS NULL
               ) AS unread_count
        FROM chat_rooms r
        JOIN companies ca ON r.company_a_id = ca.id
        JOIN companies cb ON r.company_b_id = cb.id
        LEFT JOIN files fca ON fca.id = ca.logo
        LEFT JOIN files fcb ON fcb.id = cb.logo
        LEFT JOIN LATERAL (
             SELECT m.id,
               m.sender_user_id AS last_message_sender_id,
                 m.message_text,
                 m.sent_at,
                 m.attachment_file_id,
                 f.file_name AS attachment_file_name,
                 f.file_path AS attachment_file_path,
                 f.file_metadata AS attachment_file_metadata
          FROM chat_messages m
          LEFT JOIN files f ON f.id = m.attachment_file_id
          WHERE m.room_id = r.id
          ORDER BY m.sent_at DESC, m.id DESC
          LIMIT 1
        ) lm ON TRUE
        WHERE r.id = $1
        LIMIT 1
        `,
    [roomId, companyId]
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
               fca.file_path AS company_a_logo_path,
               cb.name AS company_b_name, cb.logo AS company_b_logo,
               fcb.file_path AS company_b_logo_path,
         lm.message_text AS last_message,
         lm.sent_at AS last_message_at,
         lm.id AS last_message_id,
         lm.last_message_sender_id,
         lm.attachment_file_id AS last_attachment_file_id,
         lm.attachment_file_name AS last_attachment_file_name,
         lm.attachment_file_path AS last_attachment_file_path,
         lm.attachment_file_metadata AS last_attachment_file_metadata,
               (
                   SELECT COUNT(*)
                   FROM chat_messages m
                   JOIN users u ON m.sender_user_id = u.id
                   JOIN companies sc ON u.id = sc.agent_id
                   LEFT JOIN chat_message_reads mr
                     ON mr.message_id = m.id AND mr.company_id = $1
                   WHERE m.room_id = r.id
                     AND sc.id <> $1
                     AND mr.message_id IS NULL
               ) AS unread_count
        FROM chat_rooms r
        JOIN companies ca ON r.company_a_id = ca.id
        JOIN companies cb ON r.company_b_id = cb.id
        LEFT JOIN files fca ON fca.id = ca.logo
        LEFT JOIN files fcb ON fcb.id = cb.logo
        LEFT JOIN LATERAL (
             SELECT m.id,
               m.sender_user_id AS last_message_sender_id,
                 m.message_text,
                 m.sent_at,
                 m.attachment_file_id,
                 f.file_name AS attachment_file_name,
                 f.file_path AS attachment_file_path,
                 f.file_metadata AS attachment_file_metadata
          FROM chat_messages m
          LEFT JOIN files f ON f.id = m.attachment_file_id
          WHERE m.room_id = r.id
          ORDER BY m.sent_at DESC, m.id DESC
          LIMIT 1
        ) lm ON TRUE
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

/**
 * Find all active room IDs for a company (lightweight query for socket joins)
 */
const findActiveRoomIdsByCompanyId = async (companyId) => {
  const result = await pool.query(
    `
        SELECT id FROM chat_rooms
        WHERE (company_a_id = $1 OR company_b_id = $1)
          AND status = 'active'
        `,
    [companyId]
  );
  return result.rows.map((r) => r.id);
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
const findMessagesByRoomIdForCompany = async (
  roomId,
  companyId,
  { limit = 50, offset = 0, before, after } = {}
) => {
  let query = `
        WITH room_ctx AS (
          SELECT id,
                 company_a_id,
                 company_b_id,
                 encryption_key,
                 CASE
                   WHEN company_a_id = $2 THEN company_b_id
                   WHEN company_b_id = $2 THEN company_a_id
                   ELSE NULL
                 END AS other_company_id
          FROM chat_rooms
          WHERE id = $1
        )
        SELECT m.*,
               rc.encryption_key AS room_encryption_key,
               u.first_name AS sender_first_name, u.last_name AS sender_last_name,
               u.profile_image AS sender_profile_image,
               fp.file_path AS sender_profile_image_path,
               c.id AS sender_company_id, c.name AS sender_company_name, c.logo AS sender_company_logo,
               fc.file_path AS sender_company_logo_path,
               f.file_name AS attachment_file_name, f.file_path AS attachment_file_path,
               f.file_metadata AS attachment_file_metadata,
               mr_other.read_at AS other_read_at
        FROM chat_messages m
        JOIN room_ctx rc ON rc.id = m.room_id
        JOIN users u ON m.sender_user_id = u.id
        JOIN companies c ON u.id = c.agent_id
        LEFT JOIN files f ON m.attachment_file_id = f.id
        LEFT JOIN files fp ON fp.id = u.profile_image
        LEFT JOIN files fc ON fc.id = c.logo
        LEFT JOIN chat_message_reads mr_other
          ON mr_other.message_id = m.id AND mr_other.company_id = rc.other_company_id
        WHERE m.room_id = $1
    `;
  const params = [roomId, companyId];
  let paramIndex = 3;

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

  query += ` ORDER BY m.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
const findMessageByIdForCompany = async (messageId, companyId) => {
  const result = await pool.query(
    `
        WITH room_ctx AS (
          SELECT id,
                 encryption_key,
                 CASE
                   WHEN company_a_id = $2 THEN company_b_id
                   WHEN company_b_id = $2 THEN company_a_id
                   ELSE NULL
                 END AS other_company_id
          FROM chat_rooms
          WHERE id = (SELECT room_id FROM chat_messages WHERE id = $1)
        )
        SELECT m.*,
               rc.encryption_key AS room_encryption_key,
               u.first_name AS sender_first_name, u.last_name AS sender_last_name,
               u.profile_image AS sender_profile_image,
               fp.file_path AS sender_profile_image_path,
               c.id AS sender_company_id, c.name AS sender_company_name, c.logo AS sender_company_logo,
               fc.file_path AS sender_company_logo_path,
               f.file_name AS attachment_file_name, f.file_path AS attachment_file_path,
               f.file_metadata AS attachment_file_metadata,
               mr_other.read_at AS other_read_at
        FROM chat_messages m
        JOIN room_ctx rc ON rc.id = m.room_id
        JOIN users u ON m.sender_user_id = u.id
        JOIN companies c ON u.id = c.agent_id
        LEFT JOIN files f ON m.attachment_file_id = f.id
        LEFT JOIN files fp ON fp.id = u.profile_image
        LEFT JOIN files fc ON fc.id = c.logo
        LEFT JOIN chat_message_reads mr_other
          ON mr_other.message_id = m.id AND mr_other.company_id = rc.other_company_id
        WHERE m.id = $1
        `,
    [messageId, companyId]
  );
  return result.rows[0];
};

/**
 * Mark messages as read for a company (optionally up to a message ID)
 */
const markMessagesRead = async (roomId, companyId, { messageId } = {}) => {
  const params = [roomId, companyId];
  let paramIndex = 3;
  let clause = '';

  if (messageId) {
    clause = ` AND m.id <= $${paramIndex}`;
    params.push(messageId);
    paramIndex++;
  }

  const result = await pool.query(
    `
        INSERT INTO chat_message_reads (message_id, company_id, read_at)
        SELECT m.id, $2, NOW()
        FROM chat_messages m
        JOIN users u ON m.sender_user_id = u.id
        JOIN companies c ON u.id = c.agent_id
        WHERE m.room_id = $1
          AND c.id <> $2
          ${clause}
        ON CONFLICT (message_id, company_id)
        DO UPDATE SET read_at = EXCLUDED.read_at
        RETURNING message_id, read_at
        `,
    params
  );

  return result.rows;
};

/**
 * Mark a single message as read for a specific company (used to auto-mark sender messages)
 */
const markMessageReadForCompany = async (messageId, companyId) => {
  const result = await pool.query(
    `
        INSERT INTO chat_message_reads (message_id, company_id, read_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (message_id, company_id)
        DO UPDATE SET read_at = EXCLUDED.read_at
        RETURNING message_id, read_at
        `,
    [messageId, companyId]
  );
  return result.rows[0];
};

/**
 * Count unread messages for a room and company
 */
const countUnreadMessagesByRoomId = async (roomId, companyId) => {
  const result = await pool.query(
    `
        SELECT COUNT(*) AS total
        FROM chat_messages m
        JOIN users u ON m.sender_user_id = u.id
        JOIN companies c ON u.id = c.agent_id
        LEFT JOIN chat_message_reads mr
          ON mr.message_id = m.id AND mr.company_id = $2
        WHERE m.room_id = $1
          AND c.id <> $2
          AND mr.message_id IS NULL
        `,
    [roomId, companyId]
  );
  return parseInt(result.rows[0].total, 10);
};

module.exports = {
  // Room operations
  findOrCreateRoom,
  findRoomById,
  findRoomByIdForCompany,
  findRoomsByCompanyId,
  findActiveRoomIdsByCompanyId,
  updateRoomStatus,
  isRoomParticipant,
  // Message operations
  createMessage,
  findMessagesByRoomIdForCompany,
  countMessagesByRoomId,
  findMessageByIdForCompany,
  markMessagesRead,
  markMessageReadForCompany,
  countUnreadMessagesByRoomId,
};
