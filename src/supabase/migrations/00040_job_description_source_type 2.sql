-- ============================================================================
-- ADD JOB_DESCRIPTION TO SOURCE_TYPE
-- Allows explicit tagging of source files as job descriptions
-- Triggers JD-specific processing flow instead of policy/procedure flow
-- ============================================================================

-- First, drop the existing constraint
ALTER TABLE source_files
DROP CONSTRAINT IF EXISTS source_files_source_type_check;

-- Add new constraint with job_description included
ALTER TABLE source_files
ADD CONSTRAINT source_files_source_type_check
CHECK (source_type IN (
  'handbook',
  'policy',
  'procedures',
  'job_description',  -- NEW: for explicit JD files
  'communications',
  'training_docs',
  'other'
));

-- Add comment explaining the new type
COMMENT ON COLUMN source_files.source_type IS 'Document classification: handbook, policy, procedures, job_description, communications, training_docs, other';

-- ============================================================================
-- ADD JD-SPECIFIC PROCESSING COLUMNS TO SOURCE_FILES
-- Track whether file has been through JD processing flow
-- ============================================================================

ALTER TABLE source_files
ADD COLUMN IF NOT EXISTS jd_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS jd_processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS jd_processing_error TEXT;

COMMENT ON COLUMN source_files.jd_processed IS 'Whether this file has been processed through the JD extraction flow';
COMMENT ON COLUMN source_files.jd_processed_at IS 'When the JD processing was completed';
COMMENT ON COLUMN source_files.jd_processing_error IS 'Error message if JD processing failed';

-- Index for finding unprocessed JD files
CREATE INDEX IF NOT EXISTS idx_source_files_jd_unprocessed
ON source_files(source_type, jd_processed)
WHERE source_type = 'job_description' AND jd_processed = FALSE;
