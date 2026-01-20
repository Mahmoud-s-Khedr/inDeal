/**
 * Support Chat Repository
 * Manages live support chat rooms and messages
 */

const db = require('../config/db');

// ═══════════════════════════════════════════════════════════════
// CHAT ROOMS
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new support chat room
 */
const createRoom = async (userId, companyId = null) => {
    const { rows } = await db.query(
        `INSERT INTO support_chat_rooms (user_id, company_id)
     VALUES ($1, $2)
     RETURNING *`,
        [userId, companyId]
    );
    return rows[0];
};

/**
 * Find active room for user
 */
const findActiveRoomByUserId = async (userId) => {
    const { rows } = await db.query(
        `SELECT scr.*, u.first_name, u.last_name, u.email,
            admin.first_name as admin_first_name, admin.last_name as admin_last_name
     FROM support_chat_rooms scr
     JOIN users u ON scr.user_id = u.id
     LEFT JOIN users admin ON scr.assigned_admin_id = admin.id
     WHERE scr.user_id = $1 AND scr.status != 'closed'
     ORDER BY scr.started_at DESC
     LIMIT 1`,
        [userId]
    );
    return rows[0];
};

/**
 * Find room by ID
 */
const findRoomById = async (roomId) => {
    const { rows } = await db.query(
        `SELECT scr.*, u.first_name, u.last_name, u.email,
            admin.first_name as admin_first_name, admin.last_name as admin_last_name,
            c.name as company_name
     FROM support_chat_rooms scr
     JOIN users u ON scr.user_id = u.id
     LEFT JOIN users admin ON scr.assigned_admin_id = admin.id
     LEFT JOIN companies c ON scr.company_id = c.id
     WHERE scr.id = $1`,
        [roomId]
    );
    return rows[0];
};

/**
 * List all rooms with optional status filter
 */
const listRooms = async (status = null, limit = 50, offset = 0) => {
    let query = `
    SELECT scr.*, u.first_name, u.last_name, u.email,
           admin.first_name as admin_first_name, admin.last_name as admin_last_name,
           c.name as company_name,
           (SELECT COUNT(*) FROM support_chat_messages WHERE room_id = scr.id) as message_count
    FROM support_chat_rooms scr
    JOIN users u ON scr.user_id = u.id
    LEFT JOIN users admin ON scr.assigned_admin_id = admin.id
    LEFT JOIN companies c ON scr.company_id = c.id
  `;
    const params = [];

    if (status) {
        query += ` WHERE scr.status = $1`;
        params.push(status);
    }

    query += ` ORDER BY scr.started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await db.query(query, params);
    return rows;
};

/**
 * Assign admin to room
 */
const assignAdmin = async (roomId, adminId) => {
    const { rows } = await db.query(
        `UPDATE support_chat_rooms 
     SET assigned_admin_id = $2, status = 'active'
     WHERE id = $1
     RETURNING *`,
        [roomId, adminId]
    );
    return rows[0];
};

/**
 * Close a room
 */
const closeRoom = async (roomId) => {
    const { rows } = await db.query(
        `UPDATE support_chat_rooms 
     SET status = 'closed', ended_at = NOW()
     WHERE id = $1
     RETURNING *`,
        [roomId]
    );
    return rows[0];
};

/**
 * Count rooms by status
 */
const countByStatus = async (status) => {
    const { rows } = await db.query(
        `SELECT COUNT(*) as count FROM support_chat_rooms WHERE status = $1`,
        [status]
    );
    return parseInt(rows[0].count, 10);
};

// ═══════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════

/**
 * Create a message
 */
const createMessage = async (roomId, senderId, messageText, isFromSupport = false) => {
    const { rows } = await db.query(
        `INSERT INTO support_chat_messages (room_id, sender_id, message_text, is_from_support)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
        [roomId, senderId, messageText, isFromSupport]
    );
    return rows[0];
};

/**
 * Get messages for a room
 */
const getMessages = async (roomId, limit = 100, offset = 0) => {
    const { rows } = await db.query(
        `SELECT scm.*, u.first_name, u.last_name
     FROM support_chat_messages scm
     JOIN users u ON scm.sender_id = u.id
     WHERE scm.room_id = $1
     ORDER BY scm.sent_at ASC
     LIMIT $2 OFFSET $3`,
        [roomId, limit, offset]
    );
    return rows;
};

/**
 * Check if user is participant in room
 */
const isParticipant = async (roomId, userId) => {
    const { rows } = await db.query(
        `SELECT 1 FROM support_chat_rooms 
     WHERE id = $1 AND (user_id = $2 OR assigned_admin_id = $2)`,
        [roomId, userId]
    );
    return rows.length > 0;
};

module.exports = {
    createRoom,
    findActiveRoomByUserId,
    findRoomById,
    listRooms,
    assignAdmin,
    closeRoom,
    countByStatus,
    createMessage,
    getMessages,
    isParticipant,
};
