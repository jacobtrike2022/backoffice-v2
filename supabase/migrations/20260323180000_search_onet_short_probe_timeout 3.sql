-- search_onet_occupations still timing out (57014): long search strings (role + JD)
-- made pg_trgm % on st_full/st_focus unusable for index scans; EXISTS unnest(also_called) per row = seq scan.
-- Fix: filter only with short probes on title; score still uses full text + per-alt unnest in SELECT.
-- statement_timeout raised for this RPC (PostgREST default is often ~8s).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
  -- Index-friendly probe from title-weighted window (not the first 96 chars of a 1800-char blob)
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
    lower(o.title) % st_probe
    OR st_probe <% lower(o.title)
  ORDER BY match_percentage DESC
  LIMIT match_limit;
END;
$$;

ANALYZE onet_occupations;

GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_onet_occupations(TEXT, INT) TO anon;

COMMENT ON FUNCTION search_onet_occupations(TEXT, INT) IS
  'O*NET search: short probes in WHERE (title GIN); full scoring in SELECT; 30s local timeout.';
