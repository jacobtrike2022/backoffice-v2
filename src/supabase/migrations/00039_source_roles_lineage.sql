-- ============================================================================
-- SOURCE-ROLE LINEAGE TRACKING
-- Links roles back to their source documents and extracted entities
-- Enables full traceability of where role data originated
-- ============================================================================

-- Add source tracking columns to roles table
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS source_entity_id UUID REFERENCES extracted_entities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES source_files(id) ON DELETE SET NULL;

COMMENT ON COLUMN roles.source_entity_id IS 'Reference to the extracted entity this role was created/enriched from';
COMMENT ON COLUMN roles.source_file_id IS 'Reference to the source file containing the job description';

-- Create indexes for lineage queries
CREATE INDEX IF NOT EXISTS idx_roles_source_entity ON roles(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_roles_source_file ON roles(source_file_id);

-- ============================================================================
-- FUNCTION: Get full lineage for a role
-- Returns the complete chain from role back to source file
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
  linked_at TIMESTAMPTZ
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
    ee.source_chunk_id,
    sc.title as chunk_title,
    sc.chunk_index,
    sf.id as source_file_id,
    sf.file_name,
    ee.extraction_confidence,
    ee.linked_at
  FROM roles r
  LEFT JOIN extracted_entities ee ON r.source_entity_id = ee.id
  LEFT JOIN source_chunks sc ON ee.source_chunk_id = sc.id
  LEFT JOIN source_files sf ON COALESCE(ee.source_file_id, r.source_file_id) = sf.id
  WHERE r.id = p_role_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Find roles created from a source file
-- Useful for viewing all roles that came from a specific document
-- ============================================================================

CREATE OR REPLACE FUNCTION get_roles_from_source_file(p_source_file_id UUID)
RETURNS TABLE(
  role_id UUID,
  role_name TEXT,
  entity_id UUID,
  entity_status TEXT,
  link_action TEXT,
  linked_at TIMESTAMPTZ,
  extraction_confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as role_id,
    r.name as role_name,
    ee.id as entity_id,
    ee.entity_status,
    ee.link_action,
    ee.linked_at,
    ee.extraction_confidence
  FROM roles r
  INNER JOIN extracted_entities ee ON r.source_entity_id = ee.id
  WHERE ee.source_file_id = p_source_file_id
  ORDER BY ee.linked_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Update extracted entity when role is linked
-- Automatically updates entity status when a role links to it
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_entity_on_role_link()
RETURNS TRIGGER AS $$
BEGIN
  -- If source_entity_id is being set (new link)
  IF NEW.source_entity_id IS NOT NULL AND
     (OLD.source_entity_id IS NULL OR OLD.source_entity_id != NEW.source_entity_id) THEN

    UPDATE extracted_entities
    SET
      linked_entity_type = 'roles',
      linked_entity_id = NEW.id,
      linked_at = NOW(),
      entity_status = 'completed',
      updated_at = NOW()
    WHERE id = NEW.source_entity_id;

    -- Update source file counts
    PERFORM update_source_file_entity_counts(
      (SELECT source_file_id FROM extracted_entities WHERE id = NEW.source_entity_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_entity_on_role_link_trigger ON roles;
CREATE TRIGGER sync_entity_on_role_link_trigger
  AFTER INSERT OR UPDATE OF source_entity_id ON roles
  FOR EACH ROW
  EXECUTE FUNCTION sync_entity_on_role_link();
