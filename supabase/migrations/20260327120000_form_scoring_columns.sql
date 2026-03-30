-- Scoring, timing, and device metadata columns on form_submissions.
-- score_percentage is stored as a plain column (computed and written by the app
-- at submission time) to avoid generated-column CASE compatibility issues.
-- Idempotent: safe to run multiple times.

-- =====================================================
-- Scoring and submission metadata columns
-- =====================================================

ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS total_score NUMERIC;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS max_possible_score NUMERIC;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS score_percentage NUMERIC;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS completion_time_seconds INTEGER;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS location_data JSONB;

-- submitted_at already exists in the initial schema (NOT NULL DEFAULT NOW()),
-- but we guard with IF NOT EXISTS for safety on any environment where it may be missing.
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
