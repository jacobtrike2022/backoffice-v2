-- onet_occupations.also_called is TEXT[] (see 00006_create_onet_tables.sql).
-- COALESCE(also_called, '[]'::jsonb) and jsonb_array_elements_text() caused:
--   COALESCE types text[] and jsonb cannot be matched (42804)
--
-- Kept for databases that already applied this version (e.g. demo/live). Same function body as
-- 20260323140000_improve_search_onet_occupations.sql after the TEXT[] fix; DROP+CREATE is idempotent.

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
    similarity(lower(o.title), st_full) > 0.08
    OR similarity(lower(o.title), st_focus) > 0.08
    OR similarity(lower(o.title), st_short) > 0.08
    OR word_similarity(st_short, lower(o.title)) > 0.15
    OR word_similarity(st_focus, lower(o.title)) > 0.12
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS alt
      WHERE
        similarity(lower(alt), st_full) > 0.08
        OR similarity(lower(alt), st_focus) > 0.08
        OR word_similarity(st_focus, lower(alt)) > 0.12
    )
  ORDER BY match_percentage DESC
  LIMIT match_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO anon;

COMMENT ON FUNCTION search_onet_occupations(TEXT, INT) IS
  'O*NET occupation search: also_called is TEXT[]; unnest + to_jsonb for API.';
