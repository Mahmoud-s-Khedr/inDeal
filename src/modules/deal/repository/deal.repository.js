const { pool } = require('../../../infrastructure/config/db');

const run = (client) => client || pool;

const appendCompanyDealFilters = ({ baseQuery, params, startParamIndex, status, keyword }) => {
  let query = baseQuery;
  let paramIndex = startParamIndex;

  if (status) {
    query += ` AND d.status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  } else {
    query += ` AND d.status != $${paramIndex}`;
    params.push('archived');
    paramIndex += 1;
  }

  if (keyword) {
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', d.deal_name, d.deal_description))";
    const normalizedKeyword = `public.normalize_search_text($${paramIndex})`;
    const arabicTsVector = `to_tsvector('arabic', ${normalizedDoc})`;
    const simpleTsVector = `to_tsvector('simple', ${normalizedDoc})`;
    const arabicTsQuery = `websearch_to_tsquery('arabic', ${normalizedKeyword})`;
    const simpleTsQuery = `websearch_to_tsquery('simple', ${normalizedKeyword})`;

    query = query.replace(
      '0::float8 AS search_score',
      `((
          (
            0.6 * ts_rank_cd(${arabicTsVector}, ${arabicTsQuery}) +
            0.4 * ts_rank_cd(${simpleTsVector}, ${simpleTsQuery})
          ) * 0.8
        ) + (
          GREATEST(
            similarity(${normalizedDoc}, ${normalizedKeyword}),
            word_similarity(${normalizedDoc}, ${normalizedKeyword})
          ) * 0.2
        ))::float8 AS search_score`
    );

    query += ` AND (
      ${arabicTsVector} @@ ${arabicTsQuery}
      OR ${simpleTsVector} @@ ${simpleTsQuery}
      OR ${normalizedDoc} % ${normalizedKeyword}
    )`;
    params.push(keyword);
    paramIndex += 1;
  }

  return { query, paramIndex };
};

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
             c.name AS company_name,
             c.logo AS company_logo,
             c.company_type,
             c.company_industry,
             c.address AS company_address,
             c.status AS company_status,
             COALESCE(req.request_count, 0)::int AS applications_count
      FROM deals d
      JOIN companies c ON d.company_id = c.id
      LEFT JOIN (
        SELECT deal_id, COUNT(*) AS request_count
        FROM deal_requests
        GROUP BY deal_id
      ) req ON req.deal_id = d.id
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
const findByCompanyId = async (companyId, { status, keyword, limit = 50, offset = 0 } = {}) => {
  const params = [companyId];
  const built = appendCompanyDealFilters({
    baseQuery: `
      SELECT d.*,
             COALESCE(req.request_count, 0)::int AS applications_count,
             0::float8 AS search_score
      FROM deals d
      LEFT JOIN (
        SELECT deal_id, COUNT(*) AS request_count
        FROM deal_requests
        GROUP BY deal_id
      ) req ON req.deal_id = d.id
      WHERE d.company_id = $1
  `,
    params,
    startParamIndex: 2,
    status,
    keyword,
  });

  let query = built.query;
  const paramIndex = built.paramIndex;

  if (keyword) {
    query += ` ORDER BY search_score DESC, d.created_at DESC`;
  } else {
    query += ` ORDER BY d.created_at DESC`;
  }
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

const countByCompanyId = async (companyId, { status, keyword } = {}) => {
  const params = [companyId];
  const built = appendCompanyDealFilters({
    baseQuery: `
      SELECT COUNT(*) AS total,
             0::float8 AS search_score
      FROM deals d
      WHERE d.company_id = $1
    `,
    params,
    startParamIndex: 2,
    status,
    keyword,
  });

  const countQuery = built.query.replace(',\n             0::float8 AS search_score', '');
  const result = await pool.query(countQuery, params);
  return parseInt(result.rows[0].total, 10);
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
  createdFrom,
  createdTo,
  sortBy,
  sortOrder = 'desc',
  companyId,
  excludeCompanyId,
  limit = 20,
  offset = 0,
} = {}) => {
  let query = `
      SELECT d.*,
             c.name AS company_name,
             c.logo AS company_logo,
             c.company_type,
             c.company_industry,
             c.address AS company_address,
             COALESCE(req.request_count, 0)::int AS applications_count,
             0::float8 AS search_score
      FROM deals d
      JOIN companies c ON d.company_id = c.id
      LEFT JOIN (
        SELECT deal_id, COUNT(*) AS request_count
        FROM deal_requests
        GROUP BY deal_id
      ) req ON req.deal_id = d.id
      WHERE c.status = 'active'
  `;

  const params = [];
  let paramIndex = 1;

  if (keyword) {
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', d.deal_name, d.deal_description, c.name, c.company_type, c.company_industry))";
    const normalizedKeyword = `public.normalize_search_text($${paramIndex})`;
    const arabicTsVector = `to_tsvector('arabic', ${normalizedDoc})`;
    const simpleTsVector = `to_tsvector('simple', ${normalizedDoc})`;
    const arabicTsQuery = `websearch_to_tsquery('arabic', ${normalizedKeyword})`;
    const simpleTsQuery = `websearch_to_tsquery('simple', ${normalizedKeyword})`;

    query = query.replace(
      '0::float8 AS search_score',
      `((
          (
            0.6 * ts_rank_cd(${arabicTsVector}, ${arabicTsQuery}) +
            0.4 * ts_rank_cd(${simpleTsVector}, ${simpleTsQuery})
          ) * 0.8
        ) + (
          GREATEST(
            similarity(${normalizedDoc}, ${normalizedKeyword}),
            word_similarity(${normalizedDoc}, ${normalizedKeyword})
          ) * 0.2
        ))::float8 AS search_score`
    );

    query += ` AND (
      ${arabicTsVector} @@ ${arabicTsQuery}
      OR ${simpleTsVector} @@ ${simpleTsQuery}
      OR ${normalizedDoc} % ${normalizedKeyword}
    )`;
    params.push(keyword);
    paramIndex += 1;
  }

  if (dealType) {
    query += ` AND d.deal_type = $${paramIndex}`;
    params.push(dealType);
    paramIndex += 1;
  }

  if (status) {
    query += ` AND d.status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  if (companyIndustry) {
    query += ` AND c.company_industry = $${paramIndex}`;
    params.push(companyIndustry);
    paramIndex += 1;
  }

  if (minValue !== undefined && minValue !== null) {
    query += ` AND d.deal_value >= $${paramIndex}`;
    params.push(minValue);
    paramIndex += 1;
  }

  if (maxValue !== undefined && maxValue !== null) {
    query += ` AND d.deal_value <= $${paramIndex}`;
    params.push(maxValue);
    paramIndex += 1;
  }

  if (createdFrom) {
    query += ` AND d.created_at >= $${paramIndex}`;
    params.push(createdFrom);
    paramIndex += 1;
  }

  if (createdTo) {
    query += ` AND d.created_at <= $${paramIndex}`;
    params.push(createdTo);
    paramIndex += 1;
  }

  if (companyId) {
    query += ` AND d.company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex += 1;
  }

  if (excludeCompanyId) {
    query += ` AND d.company_id != $${paramIndex}`;
    params.push(excludeCompanyId);
    paramIndex += 1;
  }

  if (keyword) {
    query += ` ORDER BY search_score DESC, d.created_at DESC, d.id DESC`;
  } else {
    const normalizedSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumnMap = {
      price: 'd.deal_value',
      date: 'd.created_at',
      applications: 'applications_count',
    };
    const sortColumn = sortColumnMap[sortBy] || 'd.created_at';
    query += ` ORDER BY ${sortColumn} ${normalizedSortOrder}, d.id DESC`;
  }
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
  createdFrom,
  createdTo,
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
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', d.deal_name, d.deal_description, c.name, c.company_type, c.company_industry))";
    const normalizedKeyword = `public.normalize_search_text($${paramIndex})`;
    const arabicTsVector = `to_tsvector('arabic', ${normalizedDoc})`;
    const simpleTsVector = `to_tsvector('simple', ${normalizedDoc})`;
    const arabicTsQuery = `websearch_to_tsquery('arabic', ${normalizedKeyword})`;
    const simpleTsQuery = `websearch_to_tsquery('simple', ${normalizedKeyword})`;

    query += ` AND (
      ${arabicTsVector} @@ ${arabicTsQuery}
      OR ${simpleTsVector} @@ ${simpleTsQuery}
      OR ${normalizedDoc} % ${normalizedKeyword}
    )`;
    params.push(keyword);
    paramIndex += 1;
  }

  if (dealType) {
    query += ` AND d.deal_type = $${paramIndex}`;
    params.push(dealType);
    paramIndex += 1;
  }

  if (status) {
    query += ` AND d.status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  if (companyIndustry) {
    query += ` AND c.company_industry = $${paramIndex}`;
    params.push(companyIndustry);
    paramIndex += 1;
  }

  if (minValue !== undefined && minValue !== null) {
    query += ` AND d.deal_value >= $${paramIndex}`;
    params.push(minValue);
    paramIndex += 1;
  }

  if (maxValue !== undefined && maxValue !== null) {
    query += ` AND d.deal_value <= $${paramIndex}`;
    params.push(maxValue);
    paramIndex += 1;
  }

  if (createdFrom) {
    query += ` AND d.created_at >= $${paramIndex}`;
    params.push(createdFrom);
    paramIndex += 1;
  }

  if (createdTo) {
    query += ` AND d.created_at <= $${paramIndex}`;
    params.push(createdTo);
    paramIndex += 1;
  }

  if (companyId) {
    query += ` AND d.company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex += 1;
  }

  if (excludeCompanyId) {
    query += ` AND d.company_id != $${paramIndex}`;
    params.push(excludeCompanyId);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].total, 10);
};

/**
 * Update deal by ID
 */
const updateById = async (dealId, updates, client = null) => {
  const executor = run(client);
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
    index += 1;
  });

  if (!fields.length) {
    return findById(dealId);
  }

  fields.push('updated_at = NOW()');

  const result = await executor.query(
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
const archiveDeal = async (dealId) => updateStatus(dealId, 'archived');

/**
 * List all deals for admin
 */
const listAll = async ({ status, limit = 50, offset = 0 } = {}) => {
  let query = `
      SELECT d.*, c.name AS company_name, c.logo AS company_logo
      FROM deals d
      JOIN companies c ON d.company_id = c.id
  `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` WHERE d.status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

const countOpenByCompanyId = async (companyId, client = null) => {
  const executor = run(client);
  const result = await executor.query(
    `
      SELECT COUNT(*) AS total
      FROM deals
      WHERE company_id = $1
        AND status = 'open'
    `,
    [companyId]
  );

  return parseInt(result.rows[0].total, 10);
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
  countOpenByCompanyId,
  countByCompanyId,
};
