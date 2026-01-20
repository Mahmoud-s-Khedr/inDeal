/**
 * Pending Update Repository
 * Manages company profile update requests awaiting admin review
 */

const db = require('../config/db');

/**
 * Create a pending update request
 */
const create = async (companyId, pendingData) => {
    const { rows } = await db.query(
        `INSERT INTO company_pending_updates (company_id, pending_data)
     VALUES ($1, $2)
     RETURNING *`,
        [companyId, JSON.stringify(pendingData)]
    );
    return rows[0];
};

/**
 * Find pending update by company ID
 */
const findByCompanyId = async (companyId, status = 'pending') => {
    const { rows } = await db.query(
        `SELECT * FROM company_pending_updates 
     WHERE company_id = $1 AND status = $2
     ORDER BY submitted_at DESC
     LIMIT 1`,
        [companyId, status]
    );
    return rows[0];
};

/**
 * Find pending update by ID
 */
const findById = async (id) => {
    const { rows } = await db.query(
        `SELECT cpu.*, c.name as company_name, c.agent_id
     FROM company_pending_updates cpu
     JOIN companies c ON cpu.company_id = c.id
     WHERE cpu.id = $1`,
        [id]
    );
    return rows[0];
};

/**
 * List all pending updates
 */
const listPending = async (limit = 50, offset = 0) => {
    const { rows } = await db.query(
        `SELECT cpu.*, c.name as company_name, u.email as agent_email
     FROM company_pending_updates cpu
     JOIN companies c ON cpu.company_id = c.id
     LEFT JOIN users u ON c.agent_id = u.id
     WHERE cpu.status = 'pending'
     ORDER BY cpu.submitted_at ASC
     LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return rows;
};

/**
 * Count pending updates
 */
const countPending = async () => {
    const { rows } = await db.query(
        `SELECT COUNT(*) as count FROM company_pending_updates WHERE status = 'pending'`
    );
    return parseInt(rows[0].count, 10);
};

/**
 * Approve a pending update
 */
const approve = async (id, reviewerId) => {
    const { rows } = await db.query(
        `UPDATE company_pending_updates 
     SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $1
     RETURNING *`,
        [id, reviewerId]
    );
    return rows[0];
};

/**
 * Reject a pending update
 */
const reject = async (id, reviewerId, reason) => {
    const { rows } = await db.query(
        `UPDATE company_pending_updates 
     SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
     WHERE id = $1
     RETURNING *`,
        [id, reviewerId, reason]
    );
    return rows[0];
};

/**
 * Delete old resolved updates (cleanup job)
 */
const deleteOldResolved = async (olderThanDays = 30) => {
    const { rowCount } = await db.query(
        `DELETE FROM company_pending_updates 
     WHERE status IN ('approved', 'rejected') 
     AND reviewed_at < NOW() - INTERVAL '1 day' * $1`,
        [olderThanDays]
    );
    return rowCount;
};

module.exports = {
    create,
    findByCompanyId,
    findById,
    listPending,
    countPending,
    approve,
    reject,
    deleteOldResolved,
};
