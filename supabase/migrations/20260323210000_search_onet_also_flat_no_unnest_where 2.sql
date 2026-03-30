-- EXISTS + unnest(also_called) in WHERE runs many trigram checks per row → statement timeout (57014).
-- Replace with one flattened string per row: array_to_string(...) so "Sales Associate" in alts matches
-- st_probe with a single % / <% (same semantics, far less CPU).

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
  st_raw TEXT := trim(search_term);
  st_full TEXT := lower(st_raw);
  st_focus TEXT := lower(left(st_raw, 420));
  st_short TEXT := lower(left(st_raw, 120));
  st_probe TEXT;
BEGIN
  IF st_full = '' THEN
    RETURN;
  END IF;

  st_probe := lower(left(st_short, 80));
  IF length(st_probe) < 3 THEN
    st_probe := left(st_full, 80);
  END IF;

  PERFORM set_config('statement_timeout', '60000', true);
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
        LEAST(
          1.0::double precision,
          GREATEST(
            (
              0.46 * similarity(lower(o.title), st_short)
              + 0.34 * word_similarity(st_short, lower(o.title))
              + 0.12 * similarity(lower(o.title), st_focus)
              + 0.08 * word_similarity(st_focus, lower(o.title))
            ),
            0.12 * similarity(lower(o.title), left(st_full, 600)),
            COALESCE(
              (
                SELECT MAX(
                  GREATEST(
                    0.55 * similarity(lower(alt), st_short)
                    + 0.35 * word_similarity(st_short, lower(alt)),
                    0.45 * similarity(lower(alt), st_focus),
                    0.1 * similarity(lower(alt), left(st_full, 400))
                  )
                )
                FROM unnest(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS alt
              ),
              0::double precision
            )
          )
        ) * 100
      )::numeric,
      0
    )::NUMERIC AS match_percentage
  FROM onet_occupations o
  CROSS JOIN LATERAL (
    SELECT lower(
      left(
        array_to_string(COALESCE(o.also_called, ARRAY[]::TEXT[]), ' '),
        8000
      )
    ) AS als_flat
  ) als
  WHERE
    lower(o.title) % st_probe
    OR st_probe <% lower(o.title)
    OR als.als_flat % st_probe
    OR st_probe <% als.als_flat
  ORDER BY match_percentage DESC
  LIMIT match_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO anon;

COMMENT ON FUNCTION search_onet_occupations(TEXT, INT) IS
  'O*NET search: title OR flattened also_called blob vs st_probe; 60s timeout; weighted score.';
