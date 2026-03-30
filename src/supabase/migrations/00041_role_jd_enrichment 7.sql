-- ============================================================================
-- ROLE JD ENRICHMENT COLUMNS
-- Adds columns to store extracted JD data and direct chunk linkage
-- Enables future enrichment workflows for skills, DWAs, competencies
-- ============================================================================

-- Add extracted JD data storage (JSONB for flexibility)
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS extracted_jd_data JSONB DEFAULT NULL;

COMMENT ON COLUMN roles.extracted_jd_data IS 'Raw extracted data from job description AI processing. Contains: role_name, department, job_family, is_manager, is_frontline, permission_level, responsibilities, skills, knowledge, onet_search_keywords, job_description';

-- Add direct source chunk reference for JD hotlink
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS source_chunk_id UUID REFERENCES source_chunks(id) ON DELETE SET NULL;

COMMENT ON COLUMN roles.source_chunk_id IS 'Direct reference to the source chunk containing the job description. Used for JD hotlink display.';

-- Create index for source chunk lookups
CREATE INDEX IF NOT EXISTS idx_roles_source_chunk ON roles(source_chunk_id);

-- ============================================================================
-- O*NET ALTERNATE TITLES UPDATE
-- Add "Clerk" to Cashiers (41-2011.00) alternate titles for better matching
-- ============================================================================

UPDATE onet_occupations
SET also_called = array_append(
  COALESCE(also_called, ARRAY[]::TEXT[]),
  'Clerk'
)
WHERE onet_code = '41-2011.00'
AND NOT ('Clerk' = ANY(COALESCE(also_called, ARRAY[]::TEXT[])));

-- Also add common variations for better matching
UPDATE onet_occupations
SET also_called = array_cat(
  COALESCE(also_called, ARRAY[]::TEXT[]),
  ARRAY['Store Clerk', 'Retail Clerk', 'Sales Clerk', 'Checkout Clerk']
)
WHERE onet_code = '41-2011.00'
AND NOT ('Store Clerk' = ANY(COALESCE(also_called, ARRAY[]::TEXT[])));
