-- =====================================================
-- RPC: Return all published system tracks (bypasses RLS)
-- =====================================================
-- Content Management (Trike Admin) must show all system tracks.
-- RLS can still restrict by org for logged-in non–Super-Admins; this RPC
-- bypasses RLS so the UI gets the full list when it calls it.
-- Callable by anon and authenticated (page is protected by route + password).
-- =====================================================

CREATE OR REPLACE FUNCTION get_all_published_system_tracks()
RETURNS SETOF tracks
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM tracks
  WHERE is_system_content = true
    AND status = 'published'
  ORDER BY created_at DESC;
$$;

COMMENT ON FUNCTION get_all_published_system_tracks() IS 'Content Management: all published system tracks. Bypasses RLS.';

GRANT EXECUTE ON FUNCTION get_all_published_system_tracks() TO anon;
GRANT EXECUTE ON FUNCTION get_all_published_system_tracks() TO authenticated;
