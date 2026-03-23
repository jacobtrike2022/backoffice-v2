-- =====================================================
-- Content Management: show all published tracks (template or not)
-- =====================================================
-- Replaces get_all_published_system_tracks to return every published track,
-- regardless of is_system_content (template). Trike Super Admin can see and
-- manage all published content in one list.
-- =====================================================

CREATE OR REPLACE FUNCTION get_all_published_system_tracks()
RETURNS SETOF tracks
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM tracks
  WHERE status = 'published'
  ORDER BY created_at DESC
  LIMIT 2000;
$$;

COMMENT ON FUNCTION get_all_published_system_tracks() IS 'Content Management: all published tracks (template or not). Bypasses RLS.';
