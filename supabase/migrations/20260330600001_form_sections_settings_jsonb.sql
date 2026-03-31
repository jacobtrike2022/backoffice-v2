-- Add settings JSONB column to form_sections for section-level conditional logic.
-- Idempotent: safe to run multiple times.

ALTER TABLE form_sections ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

COMMENT ON COLUMN form_sections.settings IS 'Section-level settings including conditional_logic for show/hide entire sections';
