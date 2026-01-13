-- ============================================================================
-- CONTENT CLASSIFICATION FOR SOURCE CHUNKS
-- Extends source_chunks to support intelligent content type detection
-- Enables detection of Job Descriptions embedded within other documents
-- ============================================================================

-- Add content classification columns to source_chunks
ALTER TABLE source_chunks
ADD COLUMN IF NOT EXISTS content_class TEXT DEFAULT 'policy',
ADD COLUMN IF NOT EXISTS content_class_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS content_class_detected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_extractable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending'
  CHECK (extraction_status IN ('pending', 'extracted', 'skipped', 'failed'));

-- Add comment explaining the columns
COMMENT ON COLUMN source_chunks.content_class IS 'Content type classification: policy, job_description, form, table, other';
COMMENT ON COLUMN source_chunks.content_class_confidence IS 'AI confidence score for classification (0.00-1.00)';
COMMENT ON COLUMN source_chunks.is_extractable IS 'Whether this chunk contains a standalone extractable entity';
COMMENT ON COLUMN source_chunks.extraction_status IS 'Status of extraction: pending, extracted, skipped, failed';

-- Index for finding unprocessed extractable content
CREATE INDEX IF NOT EXISTS idx_source_chunks_extractable
ON source_chunks(content_class, is_extractable, extraction_status)
WHERE is_extractable = TRUE;

-- Index for content class filtering
CREATE INDEX IF NOT EXISTS idx_source_chunks_content_class
ON source_chunks(content_class);

-- ============================================================================
-- CONTENT TYPE REGISTRY
-- Extensible registry for supported content types
-- Allows future expansion beyond job_description
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_type_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  extraction_handler TEXT,  -- Function/endpoint name to call for extraction
  target_entity TEXT,       -- Target table: 'roles', 'tracks', 'forms', etc.
  detection_keywords TEXT[],-- Keywords that suggest this content type
  detection_patterns TEXT[],-- Regex patterns for detection
  min_confidence DECIMAL(3,2) DEFAULT 0.70, -- Minimum confidence to auto-detect
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE content_type_registry IS 'Registry of detectable content types for intelligent document processing';

-- Seed initial content types
INSERT INTO content_type_registry (
  type_code,
  display_name,
  description,
  extraction_handler,
  target_entity,
  detection_keywords,
  detection_patterns
)
VALUES
  (
    'policy',
    'Policy Content',
    'Standard policy, procedure, or guideline content for training track generation',
    NULL,
    'tracks',
    ARRAY['policy', 'procedure', 'guideline', 'standard', 'compliance', 'regulation'],
    ARRAY['policy\s*:', 'procedure\s*:', 'guidelines?\s*:']
  ),
  (
    'job_description',
    'Job Description',
    'Role/position descriptions that define job responsibilities, requirements, and qualifications',
    'extract-job-description',
    'roles',
    ARRAY['job title', 'position', 'responsibilities', 'qualifications', 'reports to', 'duties', 'requirements', 'essential functions', 'job summary', 'position summary'],
    ARRAY['job\s+title\s*:', 'reports\s+to\s*:', 'essential\s+(duties|functions)', 'qualifications?\s*:', 'responsibilities\s*:', 'position\s+summary', 'job\s+summary']
  )
ON CONFLICT (type_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  extraction_handler = EXCLUDED.extraction_handler,
  target_entity = EXCLUDED.target_entity,
  detection_keywords = EXCLUDED.detection_keywords,
  detection_patterns = EXCLUDED.detection_patterns,
  updated_at = NOW();

-- Enable RLS on content_type_registry
ALTER TABLE content_type_registry ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can read content types" ON content_type_registry;
DROP POLICY IF EXISTS "Admins can manage content types" ON content_type_registry;

-- Anyone can read content types (reference data)
CREATE POLICY "Anyone can read content types"
  ON content_type_registry FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify (future: implement admin check)
CREATE POLICY "Admins can manage content types"
  ON content_type_registry FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update trigger
CREATE OR REPLACE FUNCTION update_content_type_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_type_registry_updated_at ON content_type_registry;
CREATE TRIGGER content_type_registry_updated_at
  BEFORE UPDATE ON content_type_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_content_type_registry_updated_at();
