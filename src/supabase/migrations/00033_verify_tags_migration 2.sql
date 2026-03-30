-- Verification queries for tags migration
-- Run these after 00032_migrate_tags_to_junction.sql to verify the migration worked

-- 1. Count tracks with tags in junction table vs legacy column
SELECT 
  'Junction Table' as source,
  COUNT(DISTINCT track_id) as tracks_with_tags,
  COUNT(*) as total_tag_assignments
FROM track_tags
UNION ALL
SELECT 
  'Legacy Column' as source,
  COUNT(*) as tracks_with_tags,
  SUM(array_length(tags, 1)) as total_tag_assignments
FROM tracks 
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

-- 2. Compare tags for individual tracks (sample of 10)
-- This shows if tags match between legacy column and junction table
SELECT 
  t.id,
  t.title,
  t.tags as legacy_tags,
  COALESCE(array_agg(DISTINCT tg.name) FILTER (WHERE tg.name IS NOT NULL), ARRAY[]::text[]) as junction_tags,
  CASE 
    WHEN t.tags IS NULL OR array_length(t.tags, 1) = 0 THEN 'No legacy tags'
    WHEN COALESCE(array_agg(DISTINCT tg.name) FILTER (WHERE tg.name IS NOT NULL), ARRAY[]::text[]) = ARRAY[]::text[] THEN 'No junction tags'
    WHEN array(SELECT unnest(t.tags) ORDER BY 1) = array(SELECT unnest(COALESCE(array_agg(DISTINCT tg.name) FILTER (WHERE tg.name IS NOT NULL), ARRAY[]::text[])) ORDER BY 1) THEN 'Match ✓'
    ELSE 'Mismatch ⚠'
  END as status
FROM tracks t
LEFT JOIN track_tags tt ON tt.track_id = t.id
LEFT JOIN tags tg ON tg.id = tt.tag_id
WHERE t.tags IS NOT NULL AND array_length(t.tags, 1) > 0
GROUP BY t.id, t.title, t.tags
ORDER BY t.created_at DESC
LIMIT 10;

-- 3. Find tracks with tags in legacy column but NOT in junction table
-- These would indicate a migration issue
SELECT 
  t.id,
  t.title,
  t.tags as legacy_tags,
  COUNT(tt.track_id) as junction_tag_count
FROM tracks t
LEFT JOIN track_tags tt ON tt.track_id = t.id
WHERE t.tags IS NOT NULL 
  AND array_length(t.tags, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM track_tags tt2 
    WHERE tt2.track_id = t.id
  )
GROUP BY t.id, t.title, t.tags
ORDER BY array_length(t.tags, 1) DESC;

-- 4. Find tag names in legacy column that don't exist in tags table
-- These are the "garbage" tags that couldn't be migrated
SELECT DISTINCT
  unnest(t.tags) as orphaned_tag_name,
  COUNT(*) as track_count
FROM tracks t
WHERE t.tags IS NOT NULL 
  AND array_length(t.tags, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM tags tg 
    WHERE tg.name = unnest(t.tags)
  )
GROUP BY unnest(t.tags)
ORDER BY track_count DESC;

-- 5. Summary statistics
SELECT 
  (SELECT COUNT(DISTINCT track_id) FROM track_tags) as tracks_in_junction_table,
  (SELECT COUNT(*) FROM tracks WHERE tags IS NOT NULL AND array_length(tags, 1) > 0) as tracks_with_legacy_tags,
  (SELECT COUNT(*) FROM track_tags) as total_junction_records,
  (SELECT SUM(array_length(tags, 1)) FROM tracks WHERE tags IS NOT NULL AND array_length(tags, 1) > 0) as total_legacy_tag_assignments;
