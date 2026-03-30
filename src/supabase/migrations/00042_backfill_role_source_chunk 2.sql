-- ============================================================================
-- BACKFILL ROLE SOURCE CHUNK IDS
-- For roles created before source_chunk_id was added, backfill from their
-- linked extracted_entity's source_chunk_id
-- ============================================================================

-- Backfill source_chunk_id for roles that have source_entity_id but no source_chunk_id
UPDATE roles r
SET source_chunk_id = ee.source_chunk_id
FROM extracted_entities ee
WHERE r.source_entity_id = ee.id
  AND r.source_chunk_id IS NULL
  AND ee.source_chunk_id IS NOT NULL;

-- Also backfill extracted_jd_data for roles that have source_entity_id but no extracted_jd_data
UPDATE roles r
SET extracted_jd_data = ee.extracted_data
FROM extracted_entities ee
WHERE r.source_entity_id = ee.id
  AND r.extracted_jd_data IS NULL
  AND ee.extracted_data IS NOT NULL
  AND ee.extracted_data != '{}'::jsonb;

-- Log how many roles were backfilled
DO $$
DECLARE
  chunk_count INTEGER;
  jd_data_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO chunk_count
  FROM roles r
  JOIN extracted_entities ee ON r.source_entity_id = ee.id
  WHERE r.source_chunk_id = ee.source_chunk_id
    AND ee.source_chunk_id IS NOT NULL;

  SELECT COUNT(*) INTO jd_data_count
  FROM roles r
  JOIN extracted_entities ee ON r.source_entity_id = ee.id
  WHERE r.extracted_jd_data IS NOT NULL
    AND r.extracted_jd_data != '{}'::jsonb;

  RAISE NOTICE 'Backfilled % roles with source_chunk_id', chunk_count;
  RAISE NOTICE 'Backfilled % roles with extracted_jd_data', jd_data_count;
END $$;
