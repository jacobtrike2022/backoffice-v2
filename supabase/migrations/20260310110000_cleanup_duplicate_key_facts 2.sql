-- =============================================================================
-- CLEANUP DUPLICATE KEY FACTS
-- Removes duplicate facts per track (same content, multiple fact rows)
-- Keeps the earliest fact per (track_id, content); deletes duplicate links and orphaned facts
-- =============================================================================

-- Step 1: Delete fact_usage rows that link to duplicate facts (same track + same content)
-- Keep the fact_usage that points to the fact with the earliest created_at per (track_id, content)
WITH ranked AS (
  SELECT
    fu.id AS fact_usage_id,
    fu.track_id,
    fu.fact_id,
    f.content,
    ROW_NUMBER() OVER (
      PARTITION BY fu.track_id, COALESCE(TRIM(f.content), '')
      ORDER BY f.created_at ASC NULLS LAST, fu.added_at ASC NULLS LAST
    ) AS rn
  FROM fact_usage fu
  JOIN facts f ON f.id = fu.fact_id
),
duplicate_usage AS (
  SELECT fact_usage_id FROM ranked WHERE rn > 1
)
DELETE FROM fact_usage
WHERE id IN (SELECT fact_usage_id FROM duplicate_usage);

-- Step 2: Delete orphaned facts (facts that have no fact_usage links)
-- These are facts that were duplicates and are no longer linked to any track
DELETE FROM facts
WHERE id NOT IN (SELECT fact_id FROM fact_usage);
