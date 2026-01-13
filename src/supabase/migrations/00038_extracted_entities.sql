-- ============================================================================
-- EXTRACTED ENTITIES TABLE
-- Stores entities detected and extracted from source documents
-- Enables processing Job Descriptions (and future entity types) found in docs
-- Maintains full lineage tracking back to source
-- ============================================================================

CREATE TABLE IF NOT EXISTS extracted_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Source Lineage (full tracking from file to chunk to entity)
  source_file_id UUID NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  source_chunk_id UUID REFERENCES source_chunks(id) ON DELETE SET NULL,

  -- Entity Type & Classification
  entity_type TEXT NOT NULL, -- 'job_description', 'form', etc.
  entity_status TEXT DEFAULT 'pending' CHECK (entity_status IN (
    'pending',       -- Detected but not reviewed by user
    'processing',    -- User currently processing this entity
    'completed',     -- Successfully processed and linked
    'skipped',       -- User chose to skip this entity
    'failed'         -- Processing failed
  )),

  -- Extracted Data (JSON for flexibility across entity types)
  extracted_data JSONB NOT NULL DEFAULT '{}',
  extraction_confidence DECIMAL(3,2),
  extraction_method TEXT CHECK (extraction_method IN ('ai', 'pattern', 'manual')),

  -- Linked Entity (polymorphic reference to created/enriched record)
  linked_entity_type TEXT,  -- 'roles', 'tracks', 'forms', etc.
  linked_entity_id UUID,
  linked_at TIMESTAMPTZ,
  linked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  link_action TEXT CHECK (link_action IN ('created', 'enriched', 'merged')),

  -- Processing Metadata
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  processing_notes TEXT,

  -- O*NET suggestions (for job_description type)
  onet_suggestions JSONB DEFAULT '[]', -- Array of {onet_code, title, confidence}

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE extracted_entities IS 'Entities detected and extracted from source documents for processing';
COMMENT ON COLUMN extracted_entities.entity_type IS 'Type of entity: job_description, form, etc.';
COMMENT ON COLUMN extracted_entities.entity_status IS 'Processing status: pending, processing, completed, skipped, failed';
COMMENT ON COLUMN extracted_entities.extracted_data IS 'Structured data extracted from the entity (JSON)';
COMMENT ON COLUMN extracted_entities.linked_entity_id IS 'ID of the created/enriched entity (polymorphic)';
COMMENT ON COLUMN extracted_entities.link_action IS 'How the entity was linked: created, enriched, or merged';
COMMENT ON COLUMN extracted_entities.onet_suggestions IS 'O*NET profile suggestions for job descriptions';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_extracted_entities_org
  ON extracted_entities(organization_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_source_file
  ON extracted_entities(source_file_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_source_chunk
  ON extracted_entities(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_status
  ON extracted_entities(entity_status);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type_status
  ON extracted_entities(entity_type, entity_status);

-- Composite index for finding pending entities by org and type
CREATE INDEX IF NOT EXISTS idx_extracted_entities_pending
  ON extracted_entities(organization_id, entity_type, entity_status)
  WHERE entity_status = 'pending';

-- Index for linked entity lookups
CREATE INDEX IF NOT EXISTS idx_extracted_entities_linked
  ON extracted_entities(linked_entity_type, linked_entity_id)
  WHERE linked_entity_id IS NOT NULL;

-- Enable RLS
ALTER TABLE extracted_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view extracted entities in their organization"
  ON extracted_entities FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert extracted entities in their organization"
  ON extracted_entities FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update extracted entities in their organization"
  ON extracted_entities FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete extracted entities in their organization"
  ON extracted_entities FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_extracted_entities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS extracted_entities_updated_at ON extracted_entities;
CREATE TRIGGER extracted_entities_updated_at
  BEFORE UPDATE ON extracted_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_extracted_entities_updated_at();

-- ============================================================================
-- ADD ENTITY COUNTS TO SOURCE FILES
-- Track how many entities have been detected in each source file
-- ============================================================================

ALTER TABLE source_files
ADD COLUMN IF NOT EXISTS detected_entity_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_entity_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_job_descriptions BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN source_files.detected_entity_count IS 'Total number of extracted entities detected in this file';
COMMENT ON COLUMN source_files.pending_entity_count IS 'Number of entities still pending processing';
COMMENT ON COLUMN source_files.has_job_descriptions IS 'Whether this file contains detected job descriptions';

-- ============================================================================
-- FUNCTION: Update source file entity counts
-- Called after entity detection to update file-level counts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_source_file_entity_counts(p_source_file_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE source_files
  SET
    detected_entity_count = (
      SELECT COUNT(*) FROM extracted_entities
      WHERE source_file_id = p_source_file_id
    ),
    pending_entity_count = (
      SELECT COUNT(*) FROM extracted_entities
      WHERE source_file_id = p_source_file_id
      AND entity_status = 'pending'
    ),
    has_job_descriptions = (
      SELECT EXISTS(
        SELECT 1 FROM extracted_entities
        WHERE source_file_id = p_source_file_id
        AND entity_type = 'job_description'
      )
    ),
    updated_at = NOW()
  WHERE id = p_source_file_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get full lineage for an extracted entity
-- Returns the complete chain from role back to source file
-- ============================================================================

CREATE OR REPLACE FUNCTION get_entity_lineage(p_entity_id UUID)
RETURNS TABLE(
  entity_id UUID,
  entity_type TEXT,
  entity_status TEXT,
  extracted_data JSONB,
  source_chunk_id UUID,
  chunk_title TEXT,
  chunk_index INTEGER,
  source_file_id UUID,
  file_name TEXT,
  linked_entity_type TEXT,
  linked_entity_id UUID,
  extraction_confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ee.id as entity_id,
    ee.entity_type,
    ee.entity_status,
    ee.extracted_data,
    ee.source_chunk_id,
    sc.title as chunk_title,
    sc.chunk_index,
    sf.id as source_file_id,
    sf.file_name,
    ee.linked_entity_type,
    ee.linked_entity_id,
    ee.extraction_confidence
  FROM extracted_entities ee
  LEFT JOIN source_chunks sc ON ee.source_chunk_id = sc.id
  LEFT JOIN source_files sf ON ee.source_file_id = sf.id
  WHERE ee.id = p_entity_id;
END;
$$ LANGUAGE plpgsql;
