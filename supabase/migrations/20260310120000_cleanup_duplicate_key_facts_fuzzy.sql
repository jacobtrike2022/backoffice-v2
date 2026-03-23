-- =============================================================================
-- ENHANCED CLEANUP: Duplicate Key Facts (Fuzzy + Subset)
-- Catches rephrased duplicates and subset facts that the exact-match migration missed
-- =============================================================================

-- Step 1: Subset deduplication
-- If fact A's content is fully contained in fact B's content (same track), keep B (the more complete one)
WITH normalized_facts AS (
  SELECT
    fu.id AS fact_usage_id,
    fu.track_id,
    fu.fact_id,
    f.content,
    LOWER(TRIM(REGEXP_REPLACE(f.content, '\s+', ' ', 'g'))) AS content_norm,
    LENGTH(f.content) AS content_len
  FROM fact_usage fu
  JOIN facts f ON f.id = fu.fact_id
),
redundant AS (
  SELECT n1.fact_usage_id
  FROM normalized_facts n1
  JOIN normalized_facts n2 ON n1.track_id = n2.track_id
    AND n1.fact_id <> n2.fact_id
    AND n2.content_len > n1.content_len + 5
    AND POSITION(n1.content_norm IN n2.content_norm) > 0
)
DELETE FROM fact_usage
WHERE id IN (SELECT fact_usage_id FROM redundant);

-- Step 2: Normalized-content deduplication (catches minor wording/punctuation differences)
-- e.g. "skin or clothing" vs "skin, or clothing" - same after normalization
WITH normalized AS (
  SELECT
    fu.id AS fact_usage_id,
    fu.track_id,
    fu.fact_id,
    ROW_NUMBER() OVER (
      PARTITION BY fu.track_id,
        LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(f.content, '\s+', ' ', 'g'), '[^\w\s]', '', 'g')))
      ORDER BY LENGTH(f.content) DESC, f.created_at ASC NULLS LAST
    ) AS rn
  FROM fact_usage fu
  JOIN facts f ON f.id = fu.fact_id
),
duplicate_normalized AS (
  SELECT fact_usage_id FROM normalized WHERE rn > 1
)
DELETE FROM fact_usage
WHERE id IN (SELECT fact_usage_id FROM duplicate_normalized);

-- Step 3: Delete orphaned facts
DELETE FROM facts
WHERE id NOT IN (SELECT fact_id FROM fact_usage);
