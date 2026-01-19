const { pool } = require('../config/db');

const run = (client) => client || pool;

// ─────────────────────────────────────────────────────────────
// DEAL REQUEST (BID) CRUD
// ─────────────────────────────────────────────────────────────

/**
 * Create a deal request (bid/application)
 */
const createRequest = async (client, request) => {
  const executor = run(client);
  const result = await executor.query(
    `
        INSERT INTO deal_requests (
            deal_id,
            applicant_company_id,
            request_details,
            request_offer,
            status
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
    [
      request.dealId,
      request.applicantCompanyId,
      request.requestDetails || null,
      request.requestOffer || null,
      request.status || 'pending',
    ]
  );
  return result.rows[0];
};

/**
 * Find request by ID
 */
const findById = async (requestId) => {
  const result = await pool.query(
    `
        SELECT r.*, 
               d.deal_name, d.company_id AS deal_owner_company_id,
               c.name AS applicant_company_name, c.logo AS applicant_company_logo
        FROM deal_requests r
        JOIN deals d ON r.deal_id = d.id
        JOIN companies c ON r.applicant_company_id = c.id
        WHERE r.id = $1
        LIMIT 1
        `,
    [requestId]
  );
  return result.rows[0];
};

/**
 * Find requests by deal ID (for deal owner to see all bids)
 */
const findByDealId = async (dealId, { status, limit = 50, offset = 0 } = {}) => {
  let query = `
        SELECT r.*, 
               c.name AS applicant_company_name, c.logo AS applicant_company_logo,
               c.company_type AS applicant_company_type, c.company_industry AS applicant_industry
        FROM deal_requests r
        JOIN companies c ON r.applicant_company_id = c.id
        WHERE r.deal_id = $1
    `;
  const params = [dealId];
  let paramIndex = 2;

  if (status) {
    query += ` AND r.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY r.request_offer ASC NULLS LAST, r.created_at ASC 
               LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Find requests by applicant company (my submitted bids)
 */
const findByApplicantCompanyId = async (companyId, { status, limit = 50, offset = 0 } = {}) => {
  let query = `
        SELECT r.*, 
               d.deal_name, d.deal_type, d.deal_value, d.status AS deal_status,
               oc.name AS owner_company_name
        FROM deal_requests r
        JOIN deals d ON r.deal_id = d.id
        JOIN companies oc ON d.company_id = oc.id
        WHERE r.applicant_company_id = $1
    `;
  const params = [companyId];
  let paramIndex = 2;

  if (status) {
    query += ` AND r.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Check if company already has a request for this deal
 */
const findExistingRequest = async (dealId, applicantCompanyId) => {
  const result = await pool.query(
    `
        SELECT * FROM deal_requests
        WHERE deal_id = $1 AND applicant_company_id = $2
        LIMIT 1
        `,
    [dealId, applicantCompanyId]
  );
  return result.rows[0];
};

/**
 * Count requests for a deal
 */
const countByDealId = async (dealId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS total FROM deal_requests WHERE deal_id = $1`,
    [dealId]
  );
  return parseInt(result.rows[0].total, 10);
};

/**
 * Update request status
 */
const updateStatus = async (requestId, status) => {
  const result = await pool.query(
    `
        UPDATE deal_requests
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
    [status, requestId]
  );
  return result.rows[0];
};

/**
 * Update request details (by applicant before decision)
 */
const updateRequest = async (requestId, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  const fieldMapping = {
    requestDetails: 'request_details',
    requestOffer: 'request_offer',
    status: 'status',
  };

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    const dbField = fieldMapping[key] || key;
    fields.push(`${dbField} = $${index}`);
    values.push(value);
    index++;
  });

  if (!fields.length) {
    return await findById(requestId);
  }

  fields.push('updated_at = NOW()');

  const result = await pool.query(
    `
        UPDATE deal_requests
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING *
        `,
    [...values, requestId]
  );

  return result.rows[0];
};

/**
 * Withdraw request (by applicant)
 */
const withdrawRequest = async (requestId) => {
  return await updateStatus(requestId, 'withdrawn');
};

/**
 * Get request statistics for a deal
 */
const getRequestStats = async (dealId) => {
  const result = await pool.query(
    `
        SELECT 
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE status = 'withdrawn') AS withdrawn,
            MIN(request_offer) AS lowest_offer,
            MAX(request_offer) AS highest_offer,
            AVG(request_offer) AS average_offer
        FROM deal_requests
        WHERE deal_id = $1
        `,
    [dealId]
  );
  return result.rows[0];
};

module.exports = {
  createRequest,
  findById,
  findByDealId,
  findByApplicantCompanyId,
  findExistingRequest,
  countByDealId,
  updateStatus,
  updateRequest,
  withdrawRequest,
  getRequestStats,
};
