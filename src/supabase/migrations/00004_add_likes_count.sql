-- =====================================================
-- ADD LIKES COUNT TO TRACKS TABLE
-- =====================================================
-- Adds likes_count column to tracks table and creates
-- RPC function for atomic increment operations
-- =====================================================

-- Add likes_count column to tracks table
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Create index for sorting/filtering by likes
CREATE INDEX IF NOT EXISTS idx_tracks_likes_count ON tracks(likes_count DESC);

-- Create RPC function to atomically increment likes
CREATE OR REPLACE FUNCTION increment_track_likes(track_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE tracks
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = track_id;
  
  -- If no rows were updated, the track doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Track with id % not found', track_id;
  END IF;
END;
$$;

COMMENT ON COLUMN tracks.likes_count IS 'Number of likes received for this track in KB viewer';
COMMENT ON FUNCTION increment_track_likes IS 'Atomically increments the likes_count for a track. Returns void.';

