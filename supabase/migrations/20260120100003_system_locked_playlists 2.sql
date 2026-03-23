-- =====================================================
-- SYSTEM-LOCKED PLAYLISTS WITH VERSIONING
-- =====================================================

-- Add compliance fields to albums
ALTER TABLE albums
ADD COLUMN IF NOT EXISTS requirement_id UUID REFERENCES compliance_requirements(id),
ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id);

CREATE INDEX idx_albums_requirement ON albums(requirement_id);
CREATE INDEX idx_albums_locked ON albums(is_system_locked) WHERE is_system_locked = true;

-- Album version history
CREATE TABLE IF NOT EXISTS album_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  track_ids UUID[] NOT NULL,
  track_order JSONB,  -- {trackId: order} for preserving sequence
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  change_notes TEXT,

  UNIQUE(album_id, version)
);

CREATE INDEX idx_album_versions_album ON album_versions(album_id);

-- Add state approvals to tracks
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS state_approvals JSONB DEFAULT '{}';
-- Example: {"TX": {"approved": true, "approved_at": "2025-01-15", "expires": "2026-01-15"}}

COMMENT ON COLUMN tracks.state_approvals IS 'JSONB map of state_code → approval status';

-- RLS for album_versions
ALTER TABLE album_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view album versions in their org" ON album_versions FOR SELECT
  USING (album_id IN (
    SELECT a.id FROM albums a
    JOIN users u ON a.organization_id = u.organization_id
    WHERE u.auth_user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage album versions in their org" ON album_versions FOR ALL
  USING (album_id IN (
    SELECT a.id FROM albums a
    JOIN users u ON a.organization_id = u.organization_id
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name IN ('Admin', 'Trike Super Admin')
  ));

-- Function to lock a playlist
CREATE OR REPLACE FUNCTION lock_album(
  p_album_id UUID,
  p_change_notes TEXT DEFAULT NULL
) RETURNS album_versions AS $$
DECLARE
  v_album albums%ROWTYPE;
  v_track_ids UUID[];
  v_track_order JSONB;
  v_new_version album_versions%ROWTYPE;
  v_user_id UUID;
BEGIN
  -- Get current user
  SELECT id INTO v_user_id FROM auth.users WHERE id = auth.uid();

  -- Get album
  SELECT * INTO v_album FROM albums WHERE id = p_album_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Album not found';
  END IF;

  -- Get current track IDs and order
  SELECT
    array_agg(track_id ORDER BY position),
    jsonb_object_agg(track_id::text, position)
  INTO v_track_ids, v_track_order
  FROM album_tracks
  WHERE album_id = p_album_id;

  -- Create version snapshot
  INSERT INTO album_versions (album_id, version, track_ids, track_order, created_by, change_notes)
  VALUES (p_album_id, v_album.version, COALESCE(v_track_ids, '{}'), COALESCE(v_track_order, '{}'), v_user_id, p_change_notes)
  RETURNING * INTO v_new_version;

  -- Update album to locked
  UPDATE albums SET
    is_system_locked = true,
    version = version + 1,
    locked_at = NOW(),
    locked_by = v_user_id
  WHERE id = p_album_id;

  RETURN v_new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
