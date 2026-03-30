-- Speed up search_onet_occupations: plain similarity()/word_similarity() on every row + EXISTS unnest
-- can hit statement_timeout (57014) on Supabase. Use pg_trgm % / <% operators with GIN (gin_trgm_ops)
-- and SET LOCAL thresholds so the planner can use index scans.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_onet_occupations_title_lower_trgm
  ON onet_occupations
  USING gin (lower(title) gin_trgm_ops);

DROP FUNCTION IF EXISTS search_onet_occupations(TEXT, INT) CASCADE;

CREATE FUNCTION search_onet_occupations(
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
STABLE
AS $$
DECLARE
  st_full TEXT := lower(trim(search_term));
  st_focus TEXT := lower(left(trim(search_term), 420));
  st_short TEXT := lower(left(trim(search_term), 120));
BEGIN
  IF st_full = '' THEN
    RETURN;
  END IF;

  -- Align operators % and <% with previous numeric thresholds (see prior migrations).
  PERFORM set_config('pg_trgm.similarity_threshold', '0.08', true);
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.12', true);

  RETURN QUERY
  SELECT
    o.onet_code,
    o.title,
    to_jsonb(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS also_called,
    o.description,
    ROUND(
      (
        GREATEST(
          similarity(lower(o.title), st_full),
          similarity(lower(o.title), st_focus),
          similarity(lower(o.title), st_short),
          word_similarity(st_short, lower(o.title)),
          word_similarity(st_focus, lower(o.title)),
          word_similarity(st_full, lower(o.title)),
          COALESCE(
            (
              SELECT MAX(
                GREATEST(
                  similarity(lower(alt), st_full),
                  similarity(lower(alt), st_focus),
                  similarity(lower(alt), st_short),
                  word_similarity(st_short, lower(alt)),
                  word_similarity(st_focus, lower(alt))
                )
              )
              FROM unnest(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS alt
            ),
            0
          )
        ) * 100
      )::numeric,
      0
    )::NUMERIC AS match_percentage
  FROM onet_occupations o
  WHERE
    lower(o.title) % st_full
    OR lower(o.title) % st_focus
    OR lower(o.title) % st_short
    OR st_short <% lower(o.title)
    OR st_focus <% lower(o.title)
    OR st_full <% lower(o.title)
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS alt
      WHERE
        lower(alt) % st_full
        OR lower(alt) % st_focus
        OR lower(alt) % st_short
        OR st_short <% lower(alt)
        OR st_focus <% lower(alt)
    )
  ORDER BY match_percentage DESC
  LIMIT match_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO anon;

COMMENT ON FUNCTION search_onet_occupations(TEXT, INT) IS
  'O*NET search: indexed pg_trgm %/<% filters; score uses similarity/word_similarity; round(numeric).';
