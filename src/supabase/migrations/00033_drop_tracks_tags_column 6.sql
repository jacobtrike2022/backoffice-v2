-- Migration: Drop the deprecated tracks.tags column
--
-- IMPORTANT: Only run this migration AFTER verifying that:
-- 1. All tags have been migrated to track_tags junction table (run 00032 first)
-- 2. All code has been updated to use track_tags junction table
-- 3. The application has been tested and working without the legacy column
--
-- This migration is DESTRUCTIVE and cannot be easily rolled back.

-- Step 1: Verify migration was completed (fail-safe check)
DO $$
DECLARE
  tracks_with_tags INTEGER;
  junction_count INTEGER;
BEGIN
  -- Count tracks that have tags in the legacy column
  SELECT COUNT(*) INTO tracks_with_tags
  FROM tracks
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

  -- Count distinct tracks in junction table
  SELECT COUNT(DISTINCT track_id) INTO junction_count
  FROM track_tags;

  -- Log the counts
  RAISE NOTICE 'Tracks with legacy tags: %, Tracks in junction table: %',
    tracks_with_tags, junction_count;

  -- If there are still tracks with tags but not in junction, warn but don't fail
  -- (Some tags may have been unrecognized/garbage tags that weren't migrated)
  IF tracks_with_tags > 0 AND junction_count = 0 THEN
    RAISE EXCEPTION 'No tags in junction table! Run migration 00032 first.';
  END IF;
END $$;

-- Step 2: Drop the legacy tags column
ALTER TABLE tracks DROP COLUMN IF EXISTS tags;

-- Step 3: Add a comment to document the change
COMMENT ON TABLE track_tags IS 'Junction table for track-tag relationships. This is the source of truth for track tags (replaces deprecated tracks.tags column).';

-- Step 4: Confirm completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully dropped tracks.tags column. Tags are now managed exclusively via track_tags junction table.';
END $$;
