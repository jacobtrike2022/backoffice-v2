-- ============================================================================
-- TRACK GENERATION - Link chunks to generated tracks
-- ============================================================================

-- Track-Chunk relationship table (many-to-many)
CREATE TABLE IF NOT EXISTS track_source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  source_chunk_id UUID NOT NULL REFERENCES source_chunks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Ordering within the track (if multiple chunks)
  sequence_order INTEGER DEFAULT 0,

  -- How the chunk was used
  usage_type TEXT DEFAULT 'content', -- 'content', 'reference', 'quiz_source'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(track_id, source_chunk_id)
);

-- Indexes
CREATE INDEX idx_track_source_chunks_track ON track_source_chunks(track_id);
CREATE INDEX idx_track_source_chunks_chunk ON track_source_chunks(source_chunk_id);
CREATE INDEX idx_track_source_chunks_org ON track_source_chunks(organization_id);

-- Enable RLS
ALTER TABLE track_source_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view track-chunk links in their organization"
  ON track_source_chunks FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert track-chunk links in their organization"
  ON track_source_chunks FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete track-chunk links in their organization"
  ON track_source_chunks FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Add generation tracking to source_chunks
ALTER TABLE source_chunks
ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_track_id UUID REFERENCES tracks(id) ON DELETE SET NULL;

-- Add source tracking to tracks
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS generated_from_chunks BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES source_files(id) ON DELETE SET NULL;
