-- Quick migration check: Compare legacy vs junction table
SELECT 
  (SELECT COUNT(*) FROM tracks WHERE tags IS NOT NULL AND array_length(tags, 1) > 0) as tracks_with_legacy_tags,
  (SELECT COUNT(DISTINCT track_id) FROM track_tags) as tracks_in_junction_table,
  (SELECT COUNT(*) FROM track_tags) as total_junction_records;
