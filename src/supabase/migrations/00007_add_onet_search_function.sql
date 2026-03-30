-- =====================================================
-- SMART PROFILE SEARCH FUNCTION
-- =====================================================
-- Purpose: Search onet_occupations by title and alternative titles
-- Returns top N matches with similarity percentage using pg_trgm
-- also_called is TEXT[] on onet_occupations (see 00006_create_onet_tables.sql).
-- =====================================================

-- Ensure pg_trgm extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION search_onet_occupations(
  search_term TEXT,
  match_limit INT DEFAULT 4
)
RETURNS TABLE (
  onet_code VARCHAR(10),
  title TEXT,
  also_called JSONB,
  description TEXT,
  match_percentage NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.onet_code,
    o.title,
    to_jsonb(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS also_called,
    o.description,
    ROUND(
      (
        GREATEST(
          similarity(lower(o.title), lower(search_term)),
          COALESCE((
            SELECT MAX(similarity(lower(alt), lower(search_term)))
            FROM unnest(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS alt
          ), 0)
        ) * 100
      )::numeric,
      0
    )::NUMERIC AS match_percentage
  FROM onet_occupations o
  WHERE
    similarity(lower(o.title), lower(search_term)) > 0.1
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS alt
      WHERE similarity(lower(alt), lower(search_term)) > 0.1
    )
  ORDER BY match_percentage DESC
  LIMIT match_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO anon;

COMMENT ON FUNCTION search_onet_occupations IS 'Searches O*NET occupations by title and alternative titles, returning top matches with similarity percentage';
