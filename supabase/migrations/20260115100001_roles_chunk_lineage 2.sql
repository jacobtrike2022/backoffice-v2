-- ============================================================================
-- ROLES CHUNK LINEAGE - Add missing columns for full source traceability
-- Adds source_chunk_id and extracted_jd_data to roles table
-- ============================================================================

-- Add source_chunk_id for direct chunk reference (in addition to entity reference)
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS source_chunk_id UUID REFERENCES source_chunks(id) ON DELETE SET NULL;

COMMENT ON COLUMN roles.source_chunk_id IS 'Direct reference to the source chunk this role was created from';

-- Add extracted_jd_data JSONB column to store full extraction data for audit/enrichment
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS extracted_jd_data JSONB DEFAULT NULL;

COMMENT ON COLUMN roles.extracted_jd_data IS 'Full extracted job description data from AI processing, preserved for audit and future enrichment';

-- Create index for chunk lineage queries
CREATE INDEX IF NOT EXISTS idx_roles_source_chunk ON roles(source_chunk_id);

-- ============================================================================
-- Update get_role_lineage function to include direct chunk reference
-- ============================================================================

CREATE OR REPLACE FUNCTION get_role_lineage(p_role_id UUID)
RETURNS TABLE(
  role_id UUID,
  role_name TEXT,
  role_job_description TEXT,
  source_entity_id UUID,
  entity_type TEXT,
  entity_link_action TEXT,
  source_chunk_id UUID,
  chunk_title TEXT,
  chunk_index INTEGER,
  source_file_id UUID,
  file_name TEXT,
  extraction_confidence DECIMAL,
  linked_at TIMESTAMPTZ,
  extracted_jd_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as role_id,
    r.name as role_name,
    r.job_description as role_job_description,
    ee.id as source_entity_id,
    ee.entity_type,
    ee.link_action as entity_link_action,
    COALESCE(r.source_chunk_id, ee.source_chunk_id) as source_chunk_id,
    sc.title as chunk_title,
    sc.chunk_index,
    sf.id as source_file_id,
    sf.file_name,
    ee.extraction_confidence,
    ee.linked_at,
    r.extracted_jd_data
  FROM roles r
  LEFT JOIN extracted_entities ee ON r.source_entity_id = ee.id
  LEFT JOIN source_chunks sc ON COALESCE(r.source_chunk_id, ee.source_chunk_id) = sc.id
  LEFT JOIN source_files sf ON COALESCE(ee.source_file_id, r.source_file_id) = sf.id
  WHERE r.id = p_role_id;
END;
$$ LANGUAGE plpgsql;
