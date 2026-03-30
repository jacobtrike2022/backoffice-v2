-- Form sections (pages within a form), template support, and expanded block types.
-- Idempotent: safe to run multiple times.

-- =====================================================
-- Part A: form_sections table
-- =====================================================

CREATE TABLE IF NOT EXISTS form_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Section',
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_sections_form_id_idx ON form_sections(form_id);
CREATE INDEX IF NOT EXISTS form_sections_display_order_idx ON form_sections(form_id, display_order);

-- =====================================================
-- Part B: Add section_id FK to form_blocks
-- =====================================================

ALTER TABLE form_blocks ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES form_sections(id) ON DELETE SET NULL;

-- =====================================================
-- Part C: Expand block type constraint on form_blocks
-- The column is named 'type' in the initial schema.
-- PostgreSQL auto-names the inline CHECK as form_blocks_type_check.
-- We also drop the alternative name just in case.
-- =====================================================

ALTER TABLE form_blocks DROP CONSTRAINT IF EXISTS form_blocks_type_check;
ALTER TABLE form_blocks DROP CONSTRAINT IF EXISTS form_blocks_block_type_check;

ALTER TABLE form_blocks ADD CONSTRAINT form_blocks_type_check
  CHECK (type IN (
    'text', 'textarea', 'select', 'multiselect', 'radio', 'checkbox',
    'number', 'date', 'time', 'file', 'rating', 'section', 'html',
    'yes_no', 'signature', 'slider', 'location', 'photo', 'instruction', 'divider'
  ));

-- =====================================================
-- Part D: Template and slug columns on forms
-- =====================================================

ALTER TABLE forms ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES forms(id) ON DELETE SET NULL;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS forms_slug_unique_idx ON forms(slug) WHERE slug IS NOT NULL;

-- =====================================================
-- Part E: RLS for form_sections (open for demo mode)
-- =====================================================

ALTER TABLE form_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_sections_open_demo" ON form_sections;
CREATE POLICY "form_sections_open_demo" ON form_sections
  FOR ALL
  USING (true)
  WITH CHECK (true);
