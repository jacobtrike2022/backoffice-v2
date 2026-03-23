-- ============================================================================
-- Cleanup orphaned and non-CORE Onboarding assignments
-- Removes assignments that show as N/A in Reports > Assignments:
--   1. Orphaned: playlist_id is NULL (playlist was deleted)
--   2. Non-target: playlist title is not 'CORE Onboarding First Week'
-- ============================================================================

DELETE FROM assignments
WHERE id IN (
  SELECT a.id
  FROM assignments a
  LEFT JOIN playlists p ON a.playlist_id = p.id
  WHERE p.id IS NULL
     OR p.title IS NULL
     OR p.title != 'CORE Onboarding First Week'
);
