-- =====================================================
-- Content Management: filter tracks by status (published / archived)
-- =====================================================
-- RPC accepts p_status so the UI can show published (default) or archived.
-- =====================================================

CREATE OR REPLACE FUNCTION get_all_published_system_tracks(p_status TEXT DEFAULT 'published')
RETURNS SETOF tracks
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM tracks
  WHERE status = CASE
    WHEN p_status IN ('published', 'archived') THEN p_status
    ELSE 'published'
  END
  ORDER BY created_at DESC
  LIMIT 2000;
$$;

COMMENT ON FUNCTION get_all_published_system_tracks(TEXT) IS 'Content Management: tracks by status (published or archived). Default published. Bypasses RLS.';
