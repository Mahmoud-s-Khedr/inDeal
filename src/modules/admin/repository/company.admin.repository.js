const { pool } = require('../../../infrastructure/config/db');

const buildCompanyWhere = ({ status, companyType, keyword } = {}) => {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`c.status = $${paramIndex}`);
    params.push(status);
    paramIndex += 1;
  }

  if (companyType) {
    conditions.push(`c.company_type = $${paramIndex}`);
    params.push(companyType);
    paramIndex += 1;
  }

  if (keyword) {
    conditions.push(
      `(
        c.name ILIKE $${paramIndex}
        OR c.description ILIKE $${paramIndex}
        OR u.email ILIKE $${paramIndex}
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

const listCompanies = async ({ status, companyType, keyword, limit, offset }) => {
  const built = buildCompanyWhere({ status, companyType, keyword });
  const result = await pool.query(
    `
      SELECT c.*,
             u.first_name AS agent_first_name,
             u.last_name AS agent_last_name,
             u.email AS agent_email
      FROM companies c
      LEFT JOIN users u ON u.id = c.agent_id
      ${built.whereClause}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $${built.paramIndex} OFFSET $${built.paramIndex + 1}
    `,
    [...built.params, limit, offset]
  );

  return result.rows;
};

const countCompanies = async ({ status, companyType, keyword }) => {
  const built = buildCompanyWhere({ status, companyType, keyword });
  const result = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM companies c
      LEFT JOIN users u ON u.id = c.agent_id
      ${built.whereClause}
    `,
    built.params
  );

  return Number(result.rows[0]?.total || 0);
};

module.exports = {
  listCompanies,
  countCompanies,
};
