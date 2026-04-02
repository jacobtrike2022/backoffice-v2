-- =====================================================
-- PER-TRACK FORMS: Attach a form to individual tracks within a playlist
-- After completing a track, the learner must submit the attached form
-- before advancing to the next track.
-- =====================================================

-- Add form attachment columns to playlist_tracks
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS required_form_id UUID REFERENCES forms(id) ON DELETE SET NULL;
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS form_gate_mode TEXT DEFAULT 'none'
  CHECK (form_gate_mode IN ('none', 'required', 'optional'));

-- Index for quick lookup of tracks that have forms attached
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_form ON playlist_tracks(required_form_id) WHERE required_form_id IS NOT NULL;

COMMENT ON COLUMN playlist_tracks.required_form_id IS 'Form that must be completed after this track. NULL = no form gate.';
COMMENT ON COLUMN playlist_tracks.form_gate_mode IS 'none = no form, required = must submit before next track, optional = prompted but can skip';
