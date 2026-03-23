-- Smarter O*NET profile ranking: long search strings (role + JD) dilute pg_trgm similarity
-- vs short occupation titles, so generic "supervisor" matches could beat "Sales" roles.
-- Score each row by GREATEST(full, focus window, short window, word_similarity) and alt titles.

-- Replace fully: CREATE OR REPLACE cannot change OUT row type if remote drifted from repo.
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
  -- Title + start of JD (typical role words appear early)
  st_focus TEXT := lower(left(trim(search_term), 420));
  -- Strongly role-title–weighted slice (first ~100 chars ≈ job title line)
  st_short TEXT := lower(left(trim(search_term), 120));
BEGIN
  IF st_full = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.onet_code,
    o.title,
    COALESCE(o.also_called, '[]'::JSONB) AS also_called,
    o.description,
    ROUND(
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
                similarity(lower(alt::TEXT), st_full),
                similarity(lower(alt::TEXT), st_focus),
                similarity(lower(alt::TEXT), st_short),
                word_similarity(st_short, lower(alt::TEXT)),
                word_similarity(st_focus, lower(alt::TEXT))
              )
            )
            FROM jsonb_array_elements_text(COALESCE(o.also_called, '[]'::JSONB)) AS alt
          ),
          0
        )
      ) * 100,
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
      FROM jsonb_array_elements_text(COALESCE(o.also_called, '[]'::JSONB)) AS alt
      WHERE
        similarity(lower(alt::TEXT), st_full) > 0.08
        OR similarity(lower(alt::TEXT), st_focus) > 0.08
        OR word_similarity(st_focus, lower(alt::TEXT)) > 0.12
    )
  ORDER BY match_percentage DESC
  LIMIT match_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO anon;

COMMENT ON FUNCTION search_onet_occupations(TEXT, INT) IS
  'O*NET occupation search: trigram + word_similarity on full, focus, and short query windows.';
