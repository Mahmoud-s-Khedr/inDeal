const { pool } = require('../../../infrastructure/config/db');

const buildDealWhere = ({ status, dealType, companyId, keyword } = {}) => {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`d.status = $${paramIndex}`);
    params.push(status);
    paramIndex += 1;
  }

  if (dealType) {
    conditions.push(`d.deal_type = $${paramIndex}`);
    params.push(dealType);
    paramIndex += 1;
  }

  if (companyId) {
    conditions.push(`d.company_id = $${paramIndex}`);
    params.push(companyId);
    paramIndex += 1;
  }

  if (keyword) {
    conditions.push(
      `(
        d.deal_name ILIKE $${paramIndex}
        OR d.deal_description ILIKE $${paramIndex}
        OR c.name ILIKE $${paramIndex}
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

const listDeals = async ({ status, dealType, companyId, keyword, limit, offset }) => {
  const built = buildDealWhere({ status, dealType, companyId, keyword });
  const result = await pool.query(
    `
      SELECT d.*,
             c.name AS company_name,
             c.status AS company_status,
             COALESCE(req.request_count, 0)::int AS request_count
      FROM deals d
      JOIN companies c ON c.id = d.company_id
      LEFT JOIN (
        SELECT deal_id, COUNT(*) AS request_count
        FROM deal_requests
        GROUP BY deal_id
      ) req ON req.deal_id = d.id
      ${built.whereClause}
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT $${built.paramIndex} OFFSET $${built.paramIndex + 1}
    `,
    [...built.params, limit, offset]
  );

  return result.rows;
};

const countDeals = async ({ status, dealType, companyId, keyword }) => {
  const built = buildDealWhere({ status, dealType, companyId, keyword });
  const result = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM deals d
      JOIN companies c ON c.id = d.company_id
      ${built.whereClause}
    `,
    built.params
  );

  return Number(result.rows[0]?.total || 0);
};

module.exports = {
  listDeals,
  countDeals,
};
