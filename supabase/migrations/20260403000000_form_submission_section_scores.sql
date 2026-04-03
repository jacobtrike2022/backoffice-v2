-- Add scoring_mode and section_scores columns to form_submissions
-- for the new multi-mode scoring system (pass_fail / weighted / section)

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS scoring_mode TEXT,
  ADD COLUMN IF NOT EXISTS section_scores JSONB;

COMMENT ON COLUMN form_submissions.scoring_mode IS 'Scoring mode active at submission time: pass_fail, weighted, or section';
COMMENT ON COLUMN form_submissions.section_scores IS 'Per-section score breakdown (JSON array of SectionScore objects). Only populated when scoring_mode = section.';
