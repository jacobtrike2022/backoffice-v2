-- Form versioning: snapshot published states and track version history.
-- Idempotent: safe to run multiple times.

-- =====================================================
-- Part A: form_versions table
-- =====================================================

CREATE TABLE IF NOT EXISTS form_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  change_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, version_number)
);

CREATE INDEX IF NOT EXISTS form_versions_form_id_idx ON form_versions(form_id);

-- =====================================================
-- Part B: Version tracking columns on forms
-- =====================================================

ALTER TABLE forms ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- =====================================================
-- Part C: Version reference on form_submissions
-- =====================================================

ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS form_version_id UUID REFERENCES form_versions(id) ON DELETE SET NULL;

-- =====================================================
-- Part D: RLS for form_versions (open for demo mode)
-- =====================================================

ALTER TABLE form_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_versions_open_demo" ON form_versions;
CREATE POLICY "form_versions_open_demo" ON form_versions
  FOR ALL
  USING (true)
  WITH CHECK (true);
