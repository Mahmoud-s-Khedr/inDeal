const { pool } = require('../../../infrastructure/config/db');

const run = (client) => client || pool;

const deriveInternalRequestKind = (request) => {
  if (request.requestType === 'inDemand') return 'demand';
  return 'supply';
};

const appendApplicantRequestFilters = ({
  baseQuery,
  params,
  startParamIndex,
  status,
  keyword,
  requestType,
  includeDirect = false,
}) => {
  let query = baseQuery;
  let paramIndex = startParamIndex;

  if (status) {
    query += ` AND r.status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  if (requestType) {
    query += ` AND r.request_type = $${paramIndex}`;
    params.push(requestType);
    paramIndex += 1;
  }

  if (includeDirect === false && !requestType) {
    query += ` AND r.request_type != 'direct'`;
  }

  if (keyword) {
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', r.request_details, r.cancel_reason, d.deal_name, oc.name, tc.name))";
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

const appendDealRequestFilters = ({ baseQuery, params, startParamIndex, status, keyword }) => {
  let query = baseQuery;
  let paramIndex = startParamIndex;

  if (status) {
    query += ` AND r.status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  if (keyword) {
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', r.request_details, r.cancel_reason, c.name, c.company_type, c.company_industry))";
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
 * Create a deal request or direct request
 */
const createRequest = async (client, request) => {
  const executor = run(client);
  const result = await executor.query(
    `
      INSERT INTO deal_requests (
        deal_id,
        applicant_company_id,
        target_company_id,
        request_kind,
        request_type,
        request_details,
        request_offer,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      request.dealId ?? null,
      request.applicantCompanyId,
      request.targetCompanyId ?? null,
      deriveInternalRequestKind(request),
      request.requestType || 'inSupply',
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
             d.deal_name,
             d.company_id AS deal_owner_company_id,
             c.name AS applicant_company_name,
             c.logo AS applicant_company_logo,
             tc.name AS target_company_name,
             tc.logo AS target_company_logo,
             tc.company_type AS target_company_type,
             tc.company_industry AS target_company_industry
      FROM deal_requests r
      LEFT JOIN deals d ON r.deal_id = d.id
      JOIN companies c ON r.applicant_company_id = c.id
      LEFT JOIN companies tc ON r.target_company_id = tc.id
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
const findByDealId = async (dealId, { status, keyword, limit = 50, offset = 0 } = {}) => {
  const params = [dealId];
  const built = appendDealRequestFilters({
    baseQuery: `
      SELECT r.*,
             c.name AS applicant_company_name,
             c.logo AS applicant_company_logo,
             c.company_type AS applicant_company_type,
             c.company_industry AS applicant_industry,
             0::float8 AS search_score
      FROM deal_requests r
      JOIN companies c ON r.applicant_company_id = c.id
      WHERE r.deal_id = $1
  `,
    params,
    startParamIndex: 2,
    status,
    keyword,
  });
  let query = built.query;
  const paramIndex = built.paramIndex;

  if (keyword) {
    query += `
      ORDER BY search_score DESC, r.created_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
  } else {
    query += `
      ORDER BY
        CASE r.status
          WHEN 'pending' THEN 1
          WHEN 'paused' THEN 2
          WHEN 'accepted' THEN 3
          WHEN 'rejected' THEN 4
          WHEN 'canceled' THEN 5
          ELSE 6
        END,
        r.created_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
  }
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Find requests by applicant company (my submitted requests)
 */
const findByApplicantCompanyId = async (
  companyId,
  { status, keyword, requestType, includeDirect = false, limit = 50, offset = 0 } = {}
) => {
  const params = [companyId];
  const built = appendApplicantRequestFilters({
    baseQuery: `
      SELECT r.*,
             d.deal_name,
             d.deal_type,
             d.deal_value,
             d.status AS deal_status,
             oc.name AS owner_company_name,
             tc.name AS target_company_name,
             tc.logo AS target_company_logo,
             tc.company_type AS target_company_type,
             tc.company_industry AS target_company_industry,
             0::float8 AS search_score
      FROM deal_requests r
      LEFT JOIN deals d ON r.deal_id = d.id
      LEFT JOIN companies oc ON d.company_id = oc.id
      LEFT JOIN companies tc ON r.target_company_id = tc.id
      WHERE r.applicant_company_id = $1
  `,
    params,
    startParamIndex: 2,
    status,
    keyword,
    requestType,
    includeDirect,
  });
  let query = built.query;
  const paramIndex = built.paramIndex;

  if (keyword) {
    query += ` ORDER BY search_score DESC, r.created_at DESC`;
  } else {
    query += ` ORDER BY r.created_at DESC`;
  }
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

const countByApplicantCompanyId = async (
  companyId,
  { status, keyword, requestType, includeDirect = false } = {}
) => {
  const params = [companyId];
  const built = appendApplicantRequestFilters({
    baseQuery: `
      SELECT COUNT(*) AS total,
             0::float8 AS search_score
      FROM deal_requests r
      LEFT JOIN deals d ON r.deal_id = d.id
      LEFT JOIN companies oc ON d.company_id = oc.id
      LEFT JOIN companies tc ON r.target_company_id = tc.id
      WHERE r.applicant_company_id = $1
    `,
    params,
    startParamIndex: 2,
    status,
    keyword,
    requestType,
    includeDirect,
  });

  const countQuery = built.query.replace(',\n             0::float8 AS search_score', '');
  const result = await pool.query(countQuery, params);
  return parseInt(result.rows[0].total, 10);
};

/**
 * Check if company already has a request for this deal
 */
const findExistingRequest = async (
  dealId,
  applicantCompanyId,
  statuses = ['pending', 'paused', 'accepted']
) => {
  const result = await pool.query(
    `
      SELECT *
      FROM deal_requests
      WHERE deal_id = $1
        AND applicant_company_id = $2
        AND status = ANY($3::text[])
      LIMIT 1
    `,
    [dealId, applicantCompanyId, statuses]
  );
  return result.rows[0];
};

const findExistingDirectRequest = async (
  applicantCompanyId,
  targetCompanyId,
  statuses = ['pending', 'paused', 'accepted']
) => {
  const result = await pool.query(
    `
      SELECT *
      FROM deal_requests
      WHERE deal_id IS NULL
        AND request_type = 'direct'
        AND applicant_company_id = $1
        AND target_company_id = $2
        AND status = ANY($3::text[])
      LIMIT 1
    `,
    [applicantCompanyId, targetCompanyId, statuses]
  );
  return result.rows[0];
};

/**
 * Count requests for a deal
 */
const countByDealId = async (dealId, { status, keyword } = {}) => {
  const params = [dealId];
  const built = appendDealRequestFilters({
    baseQuery: `
      SELECT COUNT(*) AS total,
             0::float8 AS search_score
      FROM deal_requests r
      JOIN companies c ON r.applicant_company_id = c.id
      WHERE r.deal_id = $1
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
 * Update request status
 */
const updateStatus = async (requestId, status) => {
  const result = await pool.query(
    `
      UPDATE deal_requests
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
    [status, requestId]
  );
  return result.rows[0];
};

const pauseRequest = async (requestId, byCompanyId) => {
  const result = await pool.query(
    `
      UPDATE deal_requests
      SET status = 'paused',
          paused_at = NOW(),
          paused_by_company_id = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [requestId, byCompanyId]
  );
  return result.rows[0];
};

const cancelRequest = async (requestId, byCompanyId, cancelReason) => {
  const result = await pool.query(
    `
      UPDATE deal_requests
      SET status = 'canceled',
          canceled_at = NOW(),
          canceled_by_company_id = $2,
          cancel_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [requestId, byCompanyId, cancelReason]
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
    requestKind: 'request_kind',
    requestType: 'request_type',
    requestDetails: 'request_details',
    requestOffer: 'request_offer',
    status: 'status',
    cancelReason: 'cancel_reason',
  };

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    const dbField = fieldMapping[key] || key;
    fields.push(`${dbField} = $${index}`);
    values.push(value);
    index += 1;
  });

  if (!fields.length) {
    return findById(requestId);
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
 * Withdraw request (legacy alias)
 */
const withdrawRequest = async (requestId, byCompanyId, cancelReason) =>
  cancelRequest(requestId, byCompanyId, cancelReason);

/**
 * Get request statistics for a deal
 */
const getRequestStats = async (dealId) => {
  const result = await pool.query(
    `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'paused') AS paused,
        COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE status = 'canceled') AS canceled,
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

/**
 * Find accepted deal relationship between two companies for a deal
 */
const findAcceptedDealBetweenCompanies = async ({ dealId, companyAId, companyBId }) => {
  const result = await pool.query(
    `
      SELECT r.*, d.status AS deal_status, d.company_id AS deal_owner_company_id
      FROM deal_requests r
      JOIN deals d ON r.deal_id = d.id
      WHERE r.deal_id = $1
        AND r.status = 'accepted'
        AND d.status IN ('open', 'closed')
        AND (
          (d.company_id = $2 AND r.applicant_company_id = $3)
          OR (d.company_id = $3 AND r.applicant_company_id = $2)
        )
      LIMIT 1
    `,
    [dealId, companyAId, companyBId]
  );
  return result.rows[0];
};

module.exports = {
  createRequest,
  findById,
  findByDealId,
  findByApplicantCompanyId,
  countByApplicantCompanyId,
  findExistingRequest,
  findExistingDirectRequest,
  countByDealId,
  updateStatus,
  pauseRequest,
  cancelRequest,
  updateRequest,
  withdrawRequest,
  getRequestStats,
  findAcceptedDealBetweenCompanies,
};
