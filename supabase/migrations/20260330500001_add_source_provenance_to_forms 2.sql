-- =====================================================
-- ADD SOURCE PROVENANCE TO FORMS
-- =====================================================
-- Migration: 20260330500001_add_source_provenance_to_forms.sql
-- Purpose: Link forms back to their source files/chunks when created
--          from the Sources -> Document Intelligence -> + Form flow.
-- =====================================================

-- Add source_file_id column (nullable - only set when form was created from a source)
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES source_files(id) ON DELETE SET NULL;

-- Add source_chunk_id column (nullable - specific chunk the form was extracted from)
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS source_chunk_id UUID REFERENCES source_chunks(id) ON DELETE SET NULL;

-- Index for querying forms by source
CREATE INDEX IF NOT EXISTS idx_forms_source_file_id
  ON forms(source_file_id) WHERE source_file_id IS NOT NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- + forms.source_file_id UUID (nullable FK -> source_files)
-- + forms.source_chunk_id UUID (nullable FK -> source_chunks)
-- + Index on source_file_id for provenance queries
-- =====================================================
