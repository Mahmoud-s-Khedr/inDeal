const { pool } = require('../../../infrastructure/config/db');
const AppError = require('../../../core/errors/AppError');
const galleryRepository = require('./companyGallery.repository');
const reviewRepository = require('./companyReview.repository');
const companyDocumentRepository = require('./companyDocument.repository');
const contributionRepository = require('./companyContribution.repository');

const run = (client) => client || pool;

const createCompany = async (client, company) => {
  const executor = run(client);
  const result = await executor.query(
    `
        INSERT INTO companies (
            agent_id,
            name,
            description,
            address,
            phone,
            website,
            company_type,
            company_industry,
            manufacturing_strategy,
            contacts,
            locations
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
        RETURNING *
        `,
    [
      company.agentId,
      company.name,
      company.description || null,
      company.address || null,
      company.phone || null,
      company.website || null,
      company.companyType || null,
      company.companyIndustry || null,
      company.manufacturingStrategy || null,
      company.contacts ? JSON.stringify(company.contacts) : null,
      company.locations ? JSON.stringify(company.locations) : null,
    ]
  );

  return result.rows[0];
};

const findByAgentId = async (agentId) => {
  const result = await pool.query(
    `
        SELECT c.*,
               u.first_name, u.last_name, u.email AS agent_email, u.job_title, u.username,
               u.profile_image, u.preferences
        FROM companies c
        JOIN users u ON c.agent_id = u.id
        WHERE c.agent_id = $1 LIMIT 1
        `,
    [agentId]
  );
  return result.rows[0];
};

const findById = async (companyId) => {
  const result = await pool.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [companyId]);
  return result.rows[0];
};

const findByName = async (name) => {
  const result = await pool.query(
    `
      SELECT *
      FROM companies
      WHERE lower(name) = lower($1)
      LIMIT 1
    `,
    [name]
  );
  return result.rows[0];
};

const findCompanyProfileById = async (companyId) => {
  const companyQuery = `
    SELECT c.*,
           u.id as agent_id_user, u.first_name, u.last_name, u.job_title, u.username,
           u.profile_image, u.preferences,
           u.email as agent_email
    FROM companies c
    JOIN users u ON c.agent_id = u.id
    WHERE c.id = $1
  `;
  const companyResult = await pool.query(companyQuery, [companyId]);
  const company = companyResult.rows[0];
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const [gallery, reviews, documents, contributions] = await Promise.all([
    galleryRepository.listByCompanyId(company.id),
    reviewRepository.listByCompanyId(company.id),
    companyDocumentRepository.listByCompanyId(company.id, { scope: 'public' }),
    contributionRepository.listByCompanyId(company.id),
  ]);

  return { company, gallery, reviews, documents, contributions };
};

const listByStatus = async (status) => {
  const result = await pool.query(
    `
        SELECT c.*, 
               u.first_name, u.last_name, u.email, u.job_title, u.username
        FROM companies c
        JOIN users u ON c.agent_id = u.id
        WHERE c.status = $1
        ORDER BY c.created_at ASC
        `,
    [status]
  );
  return result.rows;
};

const countByStatus = async (status) => {
  const result = await pool.query(
    `
        SELECT COUNT(*) AS total
        FROM companies
        WHERE status = $1
        `,
    [status]
  );
  return parseInt(result.rows[0].total, 10);
};

const listAll = async () => {
  const result = await pool.query(
    `
        SELECT *
        FROM companies
        ORDER BY created_at DESC
        `
  );
  return result.rows;
};

const searchCompanies = async ({
  keyword,
  companyType,
  companyIndustry,
  manufacturingStrategy,
  location,
  status,
  limit = 20,
  offset = 0,
} = {}) => {
  let query = `
        SELECT c.*,
               0::float8 AS search_score
        FROM companies c
        WHERE 1 = 1
    `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (keyword) {
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', c.name, c.description, c.address, c.company_type, c.company_industry))";
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
    paramIndex++;
  }

  if (companyType) {
    query += ` AND c.company_type = $${paramIndex}`;
    params.push(companyType);
    paramIndex++;
  }

  if (companyIndustry) {
    query += ` AND c.company_industry = $${paramIndex}`;
    params.push(companyIndustry);
    paramIndex++;
  }

  if (manufacturingStrategy) {
    query += ` AND c.manufacturing_strategy = $${paramIndex}`;
    params.push(manufacturingStrategy);
    paramIndex++;
  }

  if (location) {
    query += ` AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(c.locations) AS loc
            WHERE loc ILIKE $${paramIndex}
        )`;
    params.push(`%${location}%`);
    paramIndex++;
  }

  if (keyword) {
    query += ` ORDER BY search_score DESC, c.created_at DESC`;
  } else {
    query += ` ORDER BY c.created_at DESC`;
  }
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
};

const countCompanies = async ({
  keyword,
  companyType,
  companyIndustry,
  manufacturingStrategy,
  location,
  status,
} = {}) => {
  let query = `
        SELECT COUNT(*) AS total
        FROM companies c
        WHERE 1 = 1
    `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (keyword) {
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', c.name, c.description, c.address, c.company_type, c.company_industry))";
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
    paramIndex++;
  }

  if (companyType) {
    query += ` AND c.company_type = $${paramIndex}`;
    params.push(companyType);
    paramIndex++;
  }

  if (companyIndustry) {
    query += ` AND c.company_industry = $${paramIndex}`;
    params.push(companyIndustry);
    paramIndex++;
  }

  if (manufacturingStrategy) {
    query += ` AND c.manufacturing_strategy = $${paramIndex}`;
    params.push(manufacturingStrategy);
    paramIndex++;
  }

  if (location) {
    query += ` AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(c.locations) AS loc
            WHERE loc ILIKE $${paramIndex}
        )`;
    params.push(`%${location}%`);
    paramIndex++;
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].total, 10);
};

const DB_COLUMN_MAPPING = {
  companyType: 'company_type',
  companyIndustry: 'company_industry',
  manufacturingStrategy: 'manufacturing_strategy',
  agentId: 'agent_id',
};

const updateCompanyByAgent = async (agentId, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;

    let dbColumn = DB_COLUMN_MAPPING[key] || key;
    let columnValue = value;

    if (key === 'contacts' || key === 'locations') {
      columnValue = value ? JSON.stringify(value) : null;
      fields.push(`${dbColumn} = $${index}::jsonb`);
    } else {
      fields.push(`${dbColumn} = $${index}`);
    }
    values.push(columnValue);
    index += 1;
  });

  if (!fields.length) {
    const existing = await findByAgentId(agentId);
    return existing;
  }

  fields.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE companies SET ${fields.join(', ')} WHERE agent_id = $${index}`,
    [...values, agentId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return await findByAgentId(agentId);
};

const updateCompanyById = async (companyId, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;

    let dbColumn = DB_COLUMN_MAPPING[key] || key;
    let columnValue = value;

    if (key === 'contacts' || key === 'locations') {
      columnValue = value ? JSON.stringify(value) : null;
      fields.push(`${dbColumn} = $${index}::jsonb`);
    } else {
      fields.push(`${dbColumn} = $${index}`);
    }
    values.push(columnValue);
    index += 1;
  });

  if (!fields.length) {
    return await findById(companyId);
  }

  fields.push(`updated_at = NOW()`);

  const result = await pool.query(
    `
        UPDATE companies
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING *
        `,
    [...values, companyId]
  );

  return result.rows[0] || null;
};

const updateCompanyStatus = async (companyId, status, rejectionReason) => {
  const result = await pool.query(
    `
        UPDATE companies
        SET status = $1,
            rejection_reason = $3,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
    [status, companyId, rejectionReason || null]
  );
  return result.rows[0];
};

const updateCompanyAgent = async (companyId, agentId) => {
  const result = await pool.query(
    `
        UPDATE companies
        SET agent_id = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
    [agentId, companyId]
  );
  return result.rows[0];
};

module.exports = {
  createCompany,
  findByAgentId,
  findById,
  findByName,
  findCompanyProfileById,
  listByStatus,
  countByStatus,
  listAll,
  searchCompanies,
  countCompanies,
  updateCompanyByAgent,
  updateCompanyById,
  updateCompanyStatus,
  updateCompanyAgent,
};
