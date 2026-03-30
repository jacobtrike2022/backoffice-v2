-- also_called (alternate titles) was scored in SELECT but never reached when primary
-- O*NET title did not pass the title-only WHERE (e.g. "Cashiers" vs probe "sales associate...").
-- Official O*NET lists "Sales Associate" under Cashiers (41-2011.00) also_called — include alts in WHERE
-- using the same short st_probe as title (cheap % / <% vs long strings).

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

  PERFORM set_config('statement_timeout', '30000', true);
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
  WHERE
    lower(o.title) % st_probe
    OR st_probe <% lower(o.title)
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(o.also_called, ARRAY[]::TEXT[])) AS alt
      WHERE length(trim(alt)) > 2
        AND (
          lower(alt) % st_probe
          OR st_probe <% lower(alt)
        )
    )
  ORDER BY match_percentage DESC
  LIMIT match_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO anon;

COMMENT ON FUNCTION search_onet_occupations(TEXT, INT) IS
  'O*NET search: title OR also_called (alt) match on st_probe; weighted scoring.';
