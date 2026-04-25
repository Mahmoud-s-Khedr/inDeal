const { pool } = require('../src/infrastructure/config/db');

const statements = [
  `DROP FUNCTION IF EXISTS public.normalize_search_text(text) CASCADE`,
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
  // ... all your CREATE INDEX IF NOT EXISTS statements remain unchanged ...
];

const bootstrapSearch = async () => {
  for (const statement of statements) {
    await pool.query(statement);
  }
};

module.exports = { bootstrapSearch };
