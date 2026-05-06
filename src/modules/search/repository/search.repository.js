const { pool } = require('../../../infrastructure/config/db');

const PUBLIC_TYPES = new Set(['companies', 'deals']);
const PRIVATE_TYPES = new Set([
  'documents',
  'contributions',
  'myDeals',
  'myRequests',
  'chatRoomsMetadata',
]);

const buildSearchScoreExpr = (docExpr) => `((
  (
    0.6 * ts_rank_cd(to_tsvector('arabic', ${docExpr}), i.q_ar) +
    0.4 * ts_rank_cd(to_tsvector('simple', ${docExpr}), i.q_simple)
  ) * 0.8
) + (
  GREATEST(
    similarity(${docExpr}, i.q),
    word_similarity(${docExpr}, i.q)
  ) * 0.2
))::float8`;

const buildSearchMatchExpr = (docExpr) => `(
  to_tsvector('arabic', ${docExpr}) @@ i.q_ar
  OR to_tsvector('simple', ${docExpr}) @@ i.q_simple
  OR ${docExpr} % i.q
)`;

const resolveTypes = (types, hasCompanyContext) => {
  const allAllowed = hasCompanyContext ? [...PUBLIC_TYPES, ...PRIVATE_TYPES] : [...PUBLIC_TYPES];

  if (!types || types.length === 0) {
    return allAllowed;
  }

  return types.filter((type) => allAllowed.includes(type));
};

// Raw SQL is intentionally used here for weighted FTS + trigram ranking and UNION-based mixed feed aggregation.
const searchUnified = async ({ q, types, companyId, limit = 20, offset = 0 }) => {
  const hasCompanyContext = Number.isInteger(companyId) && companyId > 0;
  const resolvedTypes = resolveTypes(types, hasCompanyContext);

  if (!resolvedTypes.length) {
    return [];
  }

  const subqueries = [];

  if (resolvedTypes.includes('companies')) {
    const docExpr =
      "public.normalize_search_text(concat_ws(' ', c.name, c.description, c.address, c.company_type, c.company_industry))";
    const scoreExpr = buildSearchScoreExpr(docExpr);
    const matchExpr = buildSearchMatchExpr(docExpr);

    subqueries.push(`
      SELECT
        'companies'::text AS entity_type,
        c.id::int AS entity_id,
        ${scoreExpr} AS score,
        c.name::text AS title,
        left(coalesce(c.description, c.address, ''), 180)::text AS snippet,
        jsonb_build_object(
          'status', c.status,
          'companyType', c.company_type,
          'companyIndustry', c.company_industry
        ) AS meta,
        c.created_at AS sort_ts
      FROM companies c
      CROSS JOIN input i
      WHERE c.status = 'active'
        AND ${matchExpr}
    `);
  }

  if (resolvedTypes.includes('deals')) {
    const docExpr =
      "public.normalize_search_text(concat_ws(' ', d.deal_name, d.deal_description, c.name, c.company_type, c.company_industry))";
    const scoreExpr = buildSearchScoreExpr(docExpr);
    const matchExpr = buildSearchMatchExpr(docExpr);

    subqueries.push(`
      SELECT
        'deals'::text AS entity_type,
        d.id::int AS entity_id,
        ${scoreExpr} AS score,
        d.deal_name::text AS title,
        left(coalesce(d.deal_description, ''), 180)::text AS snippet,
        jsonb_build_object(
          'dealType', d.deal_type,
          'status', d.status,
          'companyId', d.company_id,
          'companyName', c.name
        ) AS meta,
        d.created_at AS sort_ts
      FROM deals d
      JOIN companies c ON c.id = d.company_id
      CROSS JOIN input i
      WHERE c.status = 'active'
        AND d.status = 'open'
        AND ${matchExpr}
    `);
  }

  if (resolvedTypes.includes('documents')) {
    const docExpr =
      "public.normalize_search_text(concat_ws(' ', d.title, d.issuer, d.description, d.doc_type, d.url))";
    const scoreExpr = buildSearchScoreExpr(docExpr);
    const matchExpr = buildSearchMatchExpr(docExpr);

    subqueries.push(`
      SELECT
        'documents'::text AS entity_type,
        d.id::int AS entity_id,
        ${scoreExpr} AS score,
        coalesce(d.title, d.doc_type, 'Document')::text AS title,
        left(coalesce(d.description, d.issuer, d.url, ''), 180)::text AS snippet,
        jsonb_build_object(
          'companyId', d.company_id,
          'docType', d.doc_type,
          'uploadedAt', d.uploaded_at
        ) AS meta,
        d.uploaded_at AS sort_ts
      FROM company_documents d
      CROSS JOIN input i
      WHERE d.company_id = $4
        AND ${matchExpr}
    `);
  }

  if (resolvedTypes.includes('contributions')) {
    const docExpr =
      "public.normalize_search_text(concat_ws(' ', cc.title, cc.description, cc.type, cc.details::text))";
    const scoreExpr = buildSearchScoreExpr(docExpr);
    const matchExpr = buildSearchMatchExpr(docExpr);

    subqueries.push(`
      SELECT
        'contributions'::text AS entity_type,
        cc.id::int AS entity_id,
        ${scoreExpr} AS score,
        cc.title::text AS title,
        left(coalesce(cc.description, ''), 180)::text AS snippet,
        jsonb_build_object(
          'companyId', cc.company_id,
          'type', cc.type,
          'createdAt', cc.created_at
        ) AS meta,
        cc.created_at AS sort_ts
      FROM company_contributions cc
      CROSS JOIN input i
      WHERE cc.company_id = $4
        AND ${matchExpr}
    `);
  }

  if (resolvedTypes.includes('myDeals')) {
    const docExpr =
      "public.normalize_search_text(concat_ws(' ', d.deal_name, d.deal_description, d.deal_type, d.status))";
    const scoreExpr = buildSearchScoreExpr(docExpr);
    const matchExpr = buildSearchMatchExpr(docExpr);

    subqueries.push(`
      SELECT
        'myDeals'::text AS entity_type,
        d.id::int AS entity_id,
        ${scoreExpr} AS score,
        d.deal_name::text AS title,
        left(coalesce(d.deal_description, ''), 180)::text AS snippet,
        jsonb_build_object(
          'dealType', d.deal_type,
          'status', d.status,
          'dealValue', d.deal_value
        ) AS meta,
        d.created_at AS sort_ts
      FROM deals d
      CROSS JOIN input i
      WHERE d.company_id = $4
        AND ${matchExpr}
    `);
  }

  if (resolvedTypes.includes('myRequests')) {
    const docExpr =
      "public.normalize_search_text(concat_ws(' ', r.request_details, r.cancel_reason, d.deal_name, oc.name, r.status))";
    const scoreExpr = buildSearchScoreExpr(docExpr);
    const matchExpr = buildSearchMatchExpr(docExpr);

    subqueries.push(`
      SELECT
        'myRequests'::text AS entity_type,
        r.id::int AS entity_id,
        ${scoreExpr} AS score,
        coalesce(d.deal_name, 'Deal Request')::text AS title,
        left(coalesce(r.request_details, r.cancel_reason, ''), 180)::text AS snippet,
        jsonb_build_object(
          'dealId', r.deal_id,
          'status', r.status,
          'requestKind', r.request_kind,
          'requestType', r.request_type,
          'ownerCompanyName', oc.name
        ) AS meta,
        r.created_at AS sort_ts
      FROM deal_requests r
      JOIN deals d ON d.id = r.deal_id
      JOIN companies oc ON oc.id = d.company_id
      CROSS JOIN input i
      WHERE r.applicant_company_id = $4
        AND ${matchExpr}
    `);
  }

  if (resolvedTypes.includes('chatRoomsMetadata')) {
    const docExpr =
      "public.normalize_search_text(concat_ws(' ', ca.name, cb.name, coalesce(ca.company_type, ''), coalesce(cb.company_type, ''), coalesce(ca.company_industry, ''), coalesce(cb.company_industry, '')))";
    const scoreExpr = buildSearchScoreExpr(docExpr);
    const matchExpr = buildSearchMatchExpr(docExpr);

    subqueries.push(`
      SELECT
        'chatRoomsMetadata'::text AS entity_type,
        r.id::int AS entity_id,
        ${scoreExpr} AS score,
        CASE WHEN r.company_a_id = $4 THEN cb.name ELSE ca.name END::text AS title,
        left(coalesce(CASE WHEN r.company_a_id = $4 THEN cb.company_industry ELSE ca.company_industry END, ''), 180)::text AS snippet,
        jsonb_build_object(
          'status', r.status,
          'otherCompanyId', CASE WHEN r.company_a_id = $4 THEN cb.id ELSE ca.id END,
          'otherCompanyName', CASE WHEN r.company_a_id = $4 THEN cb.name ELSE ca.name END
        ) AS meta,
        r.created_at AS sort_ts
      FROM chat_rooms r
      JOIN companies ca ON ca.id = r.company_a_id
      JOIN companies cb ON cb.id = r.company_b_id
      CROSS JOIN input i
      WHERE (r.company_a_id = $4 OR r.company_b_id = $4)
        AND ${matchExpr}
    `);
  }

  if (!subqueries.length) {
    return [];
  }

  const sql = `
    WITH input AS (
      SELECT
        public.normalize_search_text($1) AS q,
        websearch_to_tsquery('arabic', public.normalize_search_text($1)) AS q_ar,
        websearch_to_tsquery('simple', public.normalize_search_text($1)) AS q_simple
    ),
    combined AS (
      ${subqueries.join('\n      UNION ALL\n')}
    )
    SELECT
      entity_type AS "entityType",
      entity_id AS "entityId",
      score,
      title,
      snippet,
      meta,
      COUNT(*) OVER()::int AS total_count
    FROM combined
    ORDER BY score DESC, sort_ts DESC, entity_type ASC, entity_id DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await pool.query(sql, [q, limit, offset, hasCompanyContext ? companyId : null]);
  return result.rows;
};

module.exports = {
  searchUnified,
};
