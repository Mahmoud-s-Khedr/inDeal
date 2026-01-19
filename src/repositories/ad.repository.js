const { pool } = require('../config/db');

const run = (client) => client || pool;

// ─────────────────────────────────────────────────────────────
// ADVERTISEMENT CRUD
// ─────────────────────────────────────────────────────────────

/**
 * Create a new advertisement
 */
const create = async (client, data) => {
  const executor = run(client);
  const result = await executor.query(
    `
        INSERT INTO advertisements (
            company_id, title, content, image_file_id, target_url,
            location, type, status, start_date, end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
    [
      data.companyId,
      data.title,
      data.content || null,
      data.imageFileId || null,
      data.targetUrl || null,
      data.location,
      data.type,
      'pending',
      data.startDate || null,
      data.endDate || null,
    ]
  );
  return result.rows[0];
};

/**
 * Find advertisement by ID
 */
const findById = async (id) => {
  const result = await pool.query(
    `
        SELECT a.*,
               c.name AS company_name,
               f.file_name AS image_file_name, f.file_path AS image_file_path
        FROM advertisements a
        JOIN companies c ON a.company_id = c.id
        LEFT JOIN files f ON a.image_file_id = f.id
        WHERE a.id = $1
        `,
    [id]
  );
  return result.rows[0];
};

/**
 * Find advertisements by company ID
 */
const findByCompanyId = async (companyId, { status, limit = 20, offset = 0 } = {}) => {
  let query = `
        SELECT a.*,
               f.file_name AS image_file_name, f.file_path AS image_file_path
        FROM advertisements a
        LEFT JOIN files f ON a.image_file_id = f.id
        WHERE a.company_id = $1
    `;
  const params = [companyId];
  let paramIndex = 2;

  if (status) {
    query += ` AND a.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Find active advertisements for display (public)
 */
const findActive = async ({ location, type, limit = 10 } = {}) => {
  let query = `
        SELECT a.id, a.title, a.content, a.target_url, a.location, a.type,
               c.name AS company_name, c.id AS company_id,
               f.file_path AS image_file_path
        FROM advertisements a
        JOIN companies c ON a.company_id = c.id
        LEFT JOIN files f ON a.image_file_id = f.id
        WHERE a.status = 'active'
          AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
          AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
    `;
  const params = [];
  let paramIndex = 1;

  if (location) {
    query += ` AND a.location = $${paramIndex}`;
    params.push(location);
    paramIndex++;
  }

  if (type) {
    query += ` AND a.type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  query += ` ORDER BY RANDOM() LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Update advertisement
 */
const update = async (id, data) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  /* eslint-disable no-unused-vars */
  const allowedFields = [
    'title',
    'content',
    'image_file_id',
    'target_url',
    'location',
    'type',
    'status',
    'start_date',
    'end_date',
  ];
  /* eslint-enable no-unused-vars */
  const fieldMapping = {
    title: 'title',
    content: 'content',
    imageFileId: 'image_file_id',
    targetUrl: 'target_url',
    location: 'location',
    type: 'type',
    status: 'status',
    startDate: 'start_date',
    endDate: 'end_date',
  };

  for (const [key, dbField] of Object.entries(fieldMapping)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramIndex}`);
      values.push(data[key]);
      paramIndex++;
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE advertisements SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
};

/**
 * Delete advertisement
 */
const deleteById = async (id) => {
  const result = await pool.query(`DELETE FROM advertisements WHERE id = $1 RETURNING *`, [id]);
  return result.rows[0];
};

/**
 * Count advertisements by company
 */
const countByCompanyId = async (companyId, status = null) => {
  let query = `SELECT COUNT(*) AS total FROM advertisements WHERE company_id = $1`;
  const params = [companyId];

  if (status) {
    query += ` AND status = $2`;
    params.push(status);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].total, 10);
};

// ─────────────────────────────────────────────────────────────
// ADMIN: LIST ALL ADS
// ─────────────────────────────────────────────────────────────

const findAll = async ({ status, companyId, limit = 50, offset = 0 } = {}) => {
  let query = `
        SELECT a.*,
               c.name AS company_name,
               f.file_path AS image_file_path
        FROM advertisements a
        JOIN companies c ON a.company_id = c.id
        LEFT JOIN files f ON a.image_file_id = f.id
        WHERE 1=1
    `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND a.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (companyId) {
    query += ` AND a.company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex++;
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

const countAll = async ({ status, companyId } = {}) => {
  let query = `SELECT COUNT(*) AS total FROM advertisements WHERE 1=1`;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (companyId) {
    query += ` AND company_id = $${paramIndex}`;
    params.push(companyId);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].total, 10);
};

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────

/**
 * Record an impression
 */
const recordImpression = async (adId) => {
  await pool.query(
    `
        INSERT INTO ad_analytics_daily (advertisement_id, date, impressions_count)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (advertisement_id, date)
        DO UPDATE SET impressions_count = ad_analytics_daily.impressions_count + 1
        `,
    [adId]
  );
};

/**
 * Record a click
 */
const recordClick = async (adId, userId = null, ipAddress = null, userAgent = null) => {
  // Record in click events table
  await pool.query(
    `
        INSERT INTO ad_click_events (advertisement_id, user_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
        `,
    [adId, userId, ipAddress, userAgent]
  );

  // Update daily analytics
  await pool.query(
    `
        INSERT INTO ad_analytics_daily (advertisement_id, date, clicks_count)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (advertisement_id, date)
        DO UPDATE SET clicks_count = ad_analytics_daily.clicks_count + 1
        `,
    [adId]
  );
};

/**
 * Get analytics for an ad
 */
const getAnalytics = async (adId, { startDate, endDate } = {}) => {
  let query = `
        SELECT date, impressions_count, clicks_count
        FROM ad_analytics_daily
        WHERE advertisement_id = $1
    `;
  const params = [adId];
  let paramIndex = 2;

  if (startDate) {
    query += ` AND date >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND date <= $${paramIndex}`;
    params.push(endDate);
  }

  query += ` ORDER BY date DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Get total analytics for an ad
 */
const getTotalAnalytics = async (adId) => {
  const result = await pool.query(
    `
        SELECT 
            COALESCE(SUM(impressions_count), 0) AS total_impressions,
            COALESCE(SUM(clicks_count), 0) AS total_clicks
        FROM ad_analytics_daily
        WHERE advertisement_id = $1
        `,
    [adId]
  );
  return result.rows[0];
};

module.exports = {
  create,
  findById,
  findByCompanyId,
  findActive,
  update,
  deleteById,
  countByCompanyId,
  findAll,
  countAll,
  recordImpression,
  recordClick,
  getAnalytics,
  getTotalAnalytics,
};
