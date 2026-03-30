-- Check which 2 tracks didn't migrate (likely orphaned tags)
SELECT 
  t.id,
  t.title,
  t.tags as legacy_tags,
  CASE 
    WHEN EXISTS (SELECT 1 FROM track_tags tt WHERE tt.track_id = t.id) 
    THEN 'Migrated ✓' 
    ELSE 'NOT Migrated ⚠' 
  END as migration_status
FROM tracks t
WHERE t.tags IS NOT NULL 
  AND array_length(t.tags, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM track_tags tt WHERE tt.track_id = t.id
  )
ORDER BY t.created_at DESC;

-- Show which tag names from those tracks don't exist in tags table
SELECT DISTINCT
  t.id,
  t.title,
  unnest(t.tags) as orphaned_tag_name
FROM tracks t
WHERE t.tags IS NOT NULL 
  AND array_length(t.tags, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM track_tags tt WHERE tt.track_id = t.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM tags tg WHERE tg.name = unnest(t.tags)
  )
ORDER BY t.id, orphaned_tag_name;
