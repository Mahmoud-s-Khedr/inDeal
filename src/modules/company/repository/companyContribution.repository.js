const { pool } = require('../../../infrastructure/config/db');

const listByCompanyId = async (companyId, options = {}) => {
  const { keyword } = options;
  const params = [companyId];
  let keywordCondition = '';
  let scoreExpr = '0::float8 AS search_score';
  let orderBy = 'created_at DESC';

  if (keyword) {
    const normalizedDoc =
      "public.normalize_search_text(concat_ws(' ', title, description, details::text, type))";
    const normalizedKeyword = `public.normalize_search_text($2)`;
    const arabicTsVector = `to_tsvector('arabic', ${normalizedDoc})`;
    const simpleTsVector = `to_tsvector('simple', ${normalizedDoc})`;
    const arabicTsQuery = `websearch_to_tsquery('arabic', ${normalizedKeyword})`;
    const simpleTsQuery = `websearch_to_tsquery('simple', ${normalizedKeyword})`;

    scoreExpr = `((
      (
        0.6 * ts_rank_cd(${arabicTsVector}, ${arabicTsQuery}) +
        0.4 * ts_rank_cd(${simpleTsVector}, ${simpleTsQuery})
      ) * 0.8
    ) + (
      GREATEST(
        similarity(${normalizedDoc}, ${normalizedKeyword}),
        word_similarity(${normalizedDoc}, ${normalizedKeyword})
      ) * 0.2
    ))::float8 AS search_score`;

    keywordCondition = ` AND (
      ${arabicTsVector} @@ ${arabicTsQuery}
      OR ${simpleTsVector} @@ ${simpleTsQuery}
      OR ${normalizedDoc} % ${normalizedKeyword}
    )`;
    params.push(keyword);
    orderBy = 'search_score DESC, created_at DESC';
  }

  const result = await pool.query(
    `
        SELECT id, company_id, media_file_id, media_type, media_url, type, title, description, details, created_at, updated_at,
               ${scoreExpr}
        FROM company_contributions
        WHERE company_id = $1
        ${keywordCondition}
        ORDER BY ${orderBy}
        `,
    params
  );

  return result.rows;
};

const findById = async (id) => {
  const result = await pool.query(
    `
        SELECT id, company_id, media_file_id, media_type, media_url, type, title, description, details, created_at, updated_at
        FROM company_contributions
        WHERE id = $1
        LIMIT 1
        `,
    [id]
  );

  return result.rows[0];
};

const createContribution = async ({
  companyId,
  mediaFileId,
  mediaType,
  mediaUrl,
  details,
  type,
  title,
  description,
}) => {
  const result = await pool.query(
    `
        INSERT INTO company_contributions (company_id, media_file_id, media_type, media_url, details, type, title, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, company_id, media_file_id, media_type, media_url, details, type, title, description, created_at, updated_at
        `,
    [
      companyId,
      mediaFileId || null,
      mediaType || null,
      mediaUrl || null,
      details || null,
      type,
      title,
      description || null,
    ]
  );

  return result.rows[0];
};

const updateContribution = async (id, updates) => {
  const fields = [];
  const values = [];
  let index = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  });

  if (!fields.length) {
    return await findById(id);
  }

  fields.push(`updated_at = NOW()`);

  const result = await pool.query(
    `
        UPDATE company_contributions
        SET ${fields.join(', ')}
        WHERE id = $${index}
        RETURNING id, company_id, media_file_id, media_type, media_url, details, type, title, description, created_at, updated_at
        `,
    [...values, id]
  );

  return result.rows[0] || null;
};

const deleteContribution = async (id) => {
  const result = await pool.query(
    `
        DELETE FROM company_contributions
        WHERE id = $1
        RETURNING id, company_id, media_file_id, media_type, media_url, details, type, title, description, created_at, updated_at
        `,
    [id]
  );

  return result.rows[0] || null;
};

module.exports = {
  listByCompanyId,
  findById,
  createContribution,
  updateContribution,
  deleteContribution,
};
