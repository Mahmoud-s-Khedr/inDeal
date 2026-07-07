const { pool } = require('../../../infrastructure/config/db');

const buildUserWhere = ({ role, status, keyword } = {}) => {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (role) {
    conditions.push(`u.role = $${paramIndex}`);
    params.push(role);
    paramIndex += 1;
  }

  if (status) {
    conditions.push(`u.status = $${paramIndex}`);
    params.push(status);
    paramIndex += 1;
  }

  if (keyword) {
    conditions.push(
      `(
        u.email ILIKE $${paramIndex}
        OR u.username ILIKE $${paramIndex}
        OR concat_ws(' ', u.first_name, u.last_name) ILIKE $${paramIndex}
      )`
    );
    params.push(`%${keyword}%`);
    paramIndex += 1;
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    paramIndex,
  };
};

const listUsers = async ({ role, status, keyword, limit, offset }) => {
  const built = buildUserWhere({ role, status, keyword });
  const result = await pool.query(
    `
      SELECT u.*,
             c.id AS company_id,
             c.name AS company_name,
             c.status AS company_status
      FROM users u
      LEFT JOIN companies c ON c.agent_id = u.id
      ${built.whereClause}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT $${built.paramIndex} OFFSET $${built.paramIndex + 1}
    `,
    [...built.params, limit, offset]
  );

  return result.rows;
};

const countUsers = async ({ role, status, keyword }) => {
  const built = buildUserWhere({ role, status, keyword });
  const result = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM users u
      ${built.whereClause}
    `,
    built.params
  );

  return Number(result.rows[0]?.total || 0);
};

const findUserDetailById = async (userId) => {
  const result = await pool.query(
    `
      SELECT u.*,
             c.id AS company_id,
             c.name AS company_name,
             c.status AS company_status
      FROM users u
      LEFT JOIN companies c ON c.agent_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
};

const countActiveAdminsExcludingUser = async (userId) => {
  const result = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'admin'
        AND status != 'suspended'
        AND id != $1
    `,
    [userId]
  );

  return Number(result.rows[0]?.total || 0);
};

module.exports = {
  listUsers,
  countUsers,
  findUserDetailById,
  countActiveAdminsExcludingUser,
};
