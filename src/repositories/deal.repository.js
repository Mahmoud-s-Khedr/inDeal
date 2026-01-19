const { pool } = require('../config/db');

const run = (client) => client || pool;

// ─────────────────────────────────────────────────────────────
// DEAL CRUD
// ─────────────────────────────────────────────────────────────

/**
 * Create a new deal
 */
const createDeal = async (client, deal) => {
  const executor = run(client);
  const result = await executor.query(
    `
        INSERT INTO deals (
            company_id,
            deal_name,
            deal_description,
            deal_value,
            deal_type,
            status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
    [
      deal.companyId,
      deal.dealName,
      deal.dealDescription || null,
      deal.dealValue || null,
      deal.dealType,
      deal.status || 'open',
    ]
  );
  return result.rows[0];
};

/**
 * Find deal by ID
 */
const findById = async (dealId) => {
  const result = await pool.query(
    `
        SELECT d.*, 
               c.name AS company_name, c.logo AS company_logo,
               c.company_type, c.company_industry, c.status AS company_status
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        WHERE d.id = $1
        LIMIT 1
        `,
    [dealId]
  );
  return result.rows[0];
};

/**
 * Find deals by company ID (owner's deals)
 */
const findByCompanyId = async (companyId, { status, limit = 50, offset = 0 } = {}) => {
  let query = `
        SELECT d.*
        FROM deals d
        WHERE d.company_id = $1
    `;
  const params = [companyId];
  let paramIndex = 2;

  if (status) {
    query += ` AND d.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Search deals with filters
 */
const search = async ({
  keyword,
  dealType,
  status,
  companyIndustry,
  minValue,
  maxValue,
  companyId,
  excludeCompanyId,
  limit = 20,
  offset = 0,
} = {}) => {
  let query = `
        SELECT d.*, 
               c.name AS company_name, c.logo AS company_logo,
               c.company_type, c.company_industry,
               c.address AS company_address
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        WHERE c.status = 'active'
    `;
  const params = [];
  let paramIndex = 1;

  // Keyword search (deal name or description)
  if (keyword) {
    query += ` AND (d.deal_name ILIKE $${paramIndex} OR d.deal_description ILIKE $${paramIndex})`;
    params.push(`%${keyword}%`);
    paramIndex++;
  }

  // Deal type filter
  if (dealType) {
    query += ` AND d.deal_type = $${paramIndex}`;
    params.push(dealType);
    paramIndex++;
  }

  // Status filter
  if (status) {
    query += ` AND d.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  // Industry filter
  if (companyIndustry) {
    query += ` AND c.company_industry = $${paramIndex}`;
    params.push(companyIndustry);
    paramIndex++;
  }

  // Value range filters
  if (minValue !== undefined && minValue !== null) {
    query += ` AND d.deal_value >= $${paramIndex}`;
    params.push(minValue);
    paramIndex++;
  }
  if (maxValue !== undefined && maxValue !== null) {
    query += ` AND d.deal_value <= $${paramIndex}`;
    params.push(maxValue);
    paramIndex++;
  }

  // Specific company filter
  if (companyId) {
    query += ` AND d.company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex++;
  }

  // Exclude company (to hide own deals in search)
  if (excludeCompanyId) {
    query += ` AND d.company_id != $${paramIndex}`;
    params.push(excludeCompanyId);
    paramIndex++;
  }

  query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Count deals matching filters
 */
const countSearch = async ({
  keyword,
  dealType,
  status,
  companyIndustry,
  minValue,
  maxValue,
  companyId,
  excludeCompanyId,
} = {}) => {
  let query = `
        SELECT COUNT(*) AS total
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        WHERE c.status = 'active'
    `;
  const params = [];
  let paramIndex = 1;

  if (keyword) {
    query += ` AND (d.deal_name ILIKE $${paramIndex} OR d.deal_description ILIKE $${paramIndex})`;
    params.push(`%${keyword}%`);
    paramIndex++;
  }
  if (dealType) {
    query += ` AND d.deal_type = $${paramIndex}`;
    params.push(dealType);
    paramIndex++;
  }
  if (status) {
    query += ` AND d.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  if (companyIndustry) {
    query += ` AND c.company_industry = $${paramIndex}`;
    params.push(companyIndustry);
    paramIndex++;
  }
  if (minValue !== undefined && minValue !== null) {
    query += ` AND d.deal_value >= $${paramIndex}`;
    params.push(minValue);
    paramIndex++;
  }
  if (maxValue !== undefined && maxValue !== null) {
    query += ` AND d.deal_value <= $${paramIndex}`;
    params.push(maxValue);
    paramIndex++;
  }
  if (companyId) {
    query += ` AND d.company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex++;
  }
  if (excludeCompanyId) {
    query += ` AND d.company_id != $${paramIndex}`;
    params.push(excludeCompanyId);
    paramIndex++;
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].total, 10);
};

/**
 * Update deal by ID
 */
const updateById = async (dealId, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  const allowedFields = ['deal_name', 'deal_description', 'deal_value', 'deal_type', 'status'];
  const fieldMapping = {
    dealName: 'deal_name',
    dealDescription: 'deal_description',
    dealValue: 'deal_value',
    dealType: 'deal_type',
    status: 'status',
  };

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    const dbField = fieldMapping[key] || key;
    if (!allowedFields.includes(dbField)) return;
    fields.push(`${dbField} = $${index}`);
    values.push(value);
    index++;
  });

  if (!fields.length) {
    return await findById(dealId);
  }

  fields.push('updated_at = NOW()');

  const result = await pool.query(
    `
        UPDATE deals
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING *
        `,
    [...values, dealId]
  );

  return result.rows[0];
};

/**
 * Update deal status
 */
const updateStatus = async (dealId, status) => {
  const result = await pool.query(
    `
        UPDATE deals
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
    [status, dealId]
  );
  return result.rows[0];
};

/**
 * Delete deal (soft archive by status change)
 */
const archiveDeal = async (dealId) => {
  return await updateStatus(dealId, 'archived');
};

/**
 * List all deals for admin
 */
const listAll = async ({ status, limit = 50, offset = 0 } = {}) => {
  let query = `
        SELECT d.*, 
               c.name AS company_name, c.logo AS company_logo
        FROM deals d
        JOIN companies c ON d.company_id = c.id
    `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` WHERE d.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

module.exports = {
  createDeal,
  findById,
  findByCompanyId,
  search,
  countSearch,
  updateById,
  updateStatus,
  archiveDeal,
  listAll,
};
