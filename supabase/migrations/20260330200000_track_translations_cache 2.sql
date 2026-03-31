-- Track translations cache table
-- Stores AI-translated track metadata so each track is only translated once per language

CREATE TABLE IF NOT EXISTS track_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(track_id, language)
);

CREATE INDEX IF NOT EXISTS idx_track_translations_track_id ON track_translations(track_id);
CREATE INDEX IF NOT EXISTS idx_track_translations_language ON track_translations(language);

-- RLS: allow authenticated users to read translations
ALTER TABLE track_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_translations_read" ON track_translations;
CREATE POLICY "track_translations_read" ON track_translations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "track_translations_insert" ON track_translations;
CREATE POLICY "track_translations_insert" ON track_translations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "track_translations_upsert" ON track_translations;
CREATE POLICY "track_translations_upsert" ON track_translations
  FOR UPDATE USING (true);
