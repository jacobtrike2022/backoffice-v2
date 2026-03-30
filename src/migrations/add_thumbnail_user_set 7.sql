-- Migration: Add thumbnail_user_set column to tracks table
-- This tracks whether the user has explicitly set or removed the thumbnail
-- preventing auto-extraction from overwriting user preferences

-- Add the column with default false (existing tracks are assumed auto-extracted)
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS thumbnail_user_set BOOLEAN DEFAULT FALSE;

-- Add a comment explaining the column
COMMENT ON COLUMN tracks.thumbnail_user_set IS
'When true, the thumbnail was explicitly set or removed by the user and should not be auto-overwritten by video extraction. When false, the thumbnail can be auto-extracted from video uploads.';
