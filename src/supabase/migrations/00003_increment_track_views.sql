-- =====================================================
-- INCREMENT TRACK VIEWS RPC FUNCTION
-- =====================================================
-- Creates a database function to atomically increment
-- track view counts for better reliability and performance
-- =====================================================

CREATE OR REPLACE FUNCTION increment_track_views(track_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE tracks
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = track_id;
  
  -- If no rows were updated, the track doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Track with id % not found', track_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION increment_track_views IS 'Atomically increments the view_count for a track. Returns void.';

