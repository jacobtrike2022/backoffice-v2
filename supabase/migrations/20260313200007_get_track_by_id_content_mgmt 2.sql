-- =====================================================
-- Content Management: fetch single track by ID (full row, bypass RLS)
-- =====================================================
-- Preview dialog needs transcript, content_text, content_url etc. In demo mode
-- or when RLS would restrict the row, direct from('tracks').select() can fail
-- or return no row. This RPC returns the full track row so the preview always
-- has article body (transcript) and other content.
-- =====================================================

CREATE OR REPLACE FUNCTION get_track_by_id_for_content_management(p_track_id UUID)
RETURNS SETOF tracks
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT * FROM tracks
  WHERE id = p_track_id
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_track_by_id_for_content_management(UUID) IS 'Content Management: full track row by ID including transcript/content_text. Bypasses RLS.';

GRANT EXECUTE ON FUNCTION get_track_by_id_for_content_management(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_track_by_id_for_content_management(UUID) TO authenticated;
