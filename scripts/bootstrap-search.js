const { pool } = require('../src/infrastructure/config/db');

const statements = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS unaccent;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'unaccent extension not available: %', SQLERRM;
  END;
END $$;`,
  `CREATE OR REPLACE FUNCTION public.normalize_search_text(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := COALESCE(input_text, '');

  BEGIN
    normalized := unaccent(normalized);
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  normalized := lower(normalized);
  normalized := regexp_replace(normalized, '[ً-ٰٟۖ-ۭ]', '', 'g');
  normalized := replace(normalized, 'ـ', '');
  normalized := regexp_replace(normalized, '[أإآٱ]', 'ا', 'g');
  normalized := replace(normalized, 'ى', 'ي');
  normalized := replace(normalized, 'ة', 'ه');
  normalized := regexp_replace(normalized, '\\s+', ' ', 'g');

  RETURN btrim(normalized);
END;
$$;`,
  `CREATE INDEX IF NOT EXISTS idx_companies_search_arabic_fts
ON companies
USING GIN (
  to_tsvector(
    'arabic',
    public.normalize_search_text(concat_ws(' ', name, description, address, company_type, company_industry))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_companies_search_simple_fts
ON companies
USING GIN (
  to_tsvector(
    'simple',
    public.normalize_search_text(concat_ws(' ', name, description, address, company_type, company_industry))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_companies_search_trgm
ON companies
USING GIN (
  public.normalize_search_text(concat_ws(' ', name, description, address, company_type, company_industry))
  gin_trgm_ops
)`,
  `CREATE INDEX IF NOT EXISTS idx_deals_search_arabic_fts
ON deals
USING GIN (
  to_tsvector(
    'arabic',
    public.normalize_search_text(concat_ws(' ', deal_name, deal_description))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_deals_search_simple_fts
ON deals
USING GIN (
  to_tsvector(
    'simple',
    public.normalize_search_text(concat_ws(' ', deal_name, deal_description))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_deals_search_trgm
ON deals
USING GIN (
  public.normalize_search_text(concat_ws(' ', deal_name, deal_description))
  gin_trgm_ops
)`,
  `CREATE INDEX IF NOT EXISTS idx_deal_requests_search_arabic_fts
ON deal_requests
USING GIN (
  to_tsvector(
    'arabic',
    public.normalize_search_text(concat_ws(' ', request_details, cancel_reason))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_deal_requests_search_simple_fts
ON deal_requests
USING GIN (
  to_tsvector(
    'simple',
    public.normalize_search_text(concat_ws(' ', request_details, cancel_reason))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_deal_requests_search_trgm
ON deal_requests
USING GIN (
  public.normalize_search_text(concat_ws(' ', request_details, cancel_reason))
  gin_trgm_ops
)`,
  `CREATE INDEX IF NOT EXISTS idx_company_documents_search_arabic_fts
ON company_documents
USING GIN (
  to_tsvector(
    'arabic',
    public.normalize_search_text(concat_ws(' ', title, issuer, description, doc_type, url))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_company_documents_search_simple_fts
ON company_documents
USING GIN (
  to_tsvector(
    'simple',
    public.normalize_search_text(concat_ws(' ', title, issuer, description, doc_type, url))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_company_documents_search_trgm
ON company_documents
USING GIN (
  public.normalize_search_text(concat_ws(' ', title, issuer, description, doc_type, url))
  gin_trgm_ops
)`,
  `CREATE INDEX IF NOT EXISTS idx_company_contributions_search_arabic_fts
ON company_contributions
USING GIN (
  to_tsvector(
    'arabic',
    public.normalize_search_text(concat_ws(' ', title, description, details::text, type))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_company_contributions_search_simple_fts
ON company_contributions
USING GIN (
  to_tsvector(
    'simple',
    public.normalize_search_text(concat_ws(' ', title, description, details::text, type))
  )
)`,
  `CREATE INDEX IF NOT EXISTS idx_company_contributions_search_trgm
ON company_contributions
USING GIN (
  public.normalize_search_text(concat_ws(' ', title, description, details::text, type))
  gin_trgm_ops
)`,
];

const bootstrapSearch = async () => {
  for (const statement of statements) {
    await pool.query(statement);
  }
};

module.exports = {
  bootstrapSearch,
};
