-- Tag name translations cache
-- Keyed by (tag_name, language) — same name translates the same regardless of org
CREATE TABLE IF NOT EXISTS tag_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT NOT NULL,
  language TEXT NOT NULL,
  translated_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tag_name, language)
);

CREATE INDEX IF NOT EXISTS idx_tag_translations_name_lang ON tag_translations(tag_name, language);

ALTER TABLE tag_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tag_translations_read" ON tag_translations;
CREATE POLICY "tag_translations_read" ON tag_translations FOR SELECT USING (true);
DROP POLICY IF EXISTS "tag_translations_write" ON tag_translations;
CREATE POLICY "tag_translations_write" ON tag_translations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "tag_translations_update" ON tag_translations;
CREATE POLICY "tag_translations_update" ON tag_translations FOR UPDATE USING (true);

-- Key fact translations cache
-- Keyed by (fact_id, language) — fact IDs are globally unique UUIDs
CREATE TABLE IF NOT EXISTS fact_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id TEXT NOT NULL,
  language TEXT NOT NULL,
  title TEXT,
  content TEXT,
  steps_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fact_id, language)
);

CREATE INDEX IF NOT EXISTS idx_fact_translations_fact_lang ON fact_translations(fact_id, language);

ALTER TABLE fact_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fact_translations_read" ON fact_translations;
CREATE POLICY "fact_translations_read" ON fact_translations FOR SELECT USING (true);
DROP POLICY IF EXISTS "fact_translations_write" ON fact_translations;
CREATE POLICY "fact_translations_write" ON fact_translations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "fact_translations_update" ON fact_translations;
CREATE POLICY "fact_translations_update" ON fact_translations FOR UPDATE USING (true);
