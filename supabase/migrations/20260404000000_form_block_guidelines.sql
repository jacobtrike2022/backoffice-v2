-- ============================================================================
-- FORM BLOCK GUIDELINES
-- ============================================================================
-- Adds per-question guideline text and attachments so inspectors/auditors
-- can view grading criteria and reference media directly from the form.
-- Populated manually in the form builder or auto-matched during spreadsheet
-- import (e.g., Pre-Flight Checklist Guidelines tab → Questionnaire items).

ALTER TABLE form_blocks
  ADD COLUMN IF NOT EXISTS guideline_text TEXT,
  ADD COLUMN IF NOT EXISTS guideline_attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN form_blocks.guideline_text IS 'Per-question grading criteria or reference instructions shown via info icon during form submission.';
COMMENT ON COLUMN form_blocks.guideline_attachments IS 'Array of {url, type, name} objects for photos/videos attached to the guideline.';
