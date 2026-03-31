-- ============================================================================
-- PLAYLIST REQUIRED FORMS
-- Adds required_form_id and form_completion_mode to playlists and albums
-- so that completing a training track can require filling out a form.
-- ============================================================================

-- Drop constraints first (idempotent)
ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_form_completion_mode_check;
ALTER TABLE albums    DROP CONSTRAINT IF EXISTS albums_form_completion_mode_check;

-- Add columns to playlists
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS required_form_id UUID REFERENCES forms(id) ON DELETE SET NULL;

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS form_completion_mode TEXT DEFAULT 'optional';

ALTER TABLE playlists
  ADD CONSTRAINT playlists_form_completion_mode_check
    CHECK (form_completion_mode IN ('optional', 'required', 'required_before_completion'));

-- Add columns to albums
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS required_form_id UUID REFERENCES forms(id) ON DELETE SET NULL;

ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS form_completion_mode TEXT DEFAULT 'optional';

ALTER TABLE albums
  ADD CONSTRAINT albums_form_completion_mode_check
    CHECK (form_completion_mode IN ('optional', 'required', 'required_before_completion'));
