const { pool } = require('../config/db');

const listByCompanyId = async (companyId) => {
  const result = await pool.query(
    `SELECT ca.*, u.first_name, u.last_name, u.email, u.profile_image 
     FROM company_agents ca
     JOIN users u ON ca.user_id = u.id
     WHERE ca.company_id = $1
     ORDER BY ca.created_at DESC`,
    [companyId]
  );
  return result.rows;
};

const findByCompanyAndUser = async (companyId, userId) => {
  const result = await pool.query(
    'SELECT * FROM company_agents WHERE company_id = $1 AND user_id = $2',
    [companyId, userId]
  );
  return result.rows[0];
};

const addAgent = async ({ companyId, userId, role, status = 'active' }) => {
  const result = await pool.query(
    `INSERT INTO company_agents (company_id, user_id, role, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [companyId, userId, role, status]
  );
  return result.rows[0];
};

const removeAgent = async (companyId, userId) => {
  const result = await pool.query(
    'DELETE FROM company_agents WHERE company_id = $1 AND user_id = $2 RETURNING *',
    [companyId, userId]
  );
  return result.rows[0];
};

const updateAgentRole = async (companyId, userId, role) => {
  const result = await pool.query(
    'UPDATE company_agents SET role = $3 WHERE company_id = $1 AND user_id = $2 RETURNING *',
    [companyId, userId, role]
  );
  return result.rows[0];
};

module.exports = {
  listByCompanyId,
  findByCompanyAndUser,
  addAgent,
  removeAgent,
  updateAgentRole,
};
