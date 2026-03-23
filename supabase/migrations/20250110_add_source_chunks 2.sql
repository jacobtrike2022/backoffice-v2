-- ============================================================================
-- SOURCE CHUNKS TABLE
-- Stores semantically chunked segments from source documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id UUID NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Chunk positioning
  chunk_index INTEGER NOT NULL,
  parent_chunk_id UUID REFERENCES source_chunks(id) ON DELETE SET NULL,
  hierarchy_level INTEGER DEFAULT 0, -- 0=root, 1=section, 2=subsection, etc.

  -- Content
  content TEXT NOT NULL,
  title TEXT,
  summary TEXT,

  -- Stats
  word_count INTEGER,
  char_count INTEGER,
  estimated_read_time_seconds INTEGER,

  -- Classification
  chunk_type TEXT DEFAULT 'content', -- 'header', 'content', 'list', 'table', 'form'
  key_terms TEXT[], -- extracted keywords/concepts

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(source_file_id, chunk_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_source_chunks_source_file ON source_chunks(source_file_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_org ON source_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_parent ON source_chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_source_chunks_type ON source_chunks(chunk_type);

-- Enable RLS
ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view chunks in their organization"
  ON source_chunks FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert chunks in their organization"
  ON source_chunks FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update chunks in their organization"
  ON source_chunks FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete chunks in their organization"
  ON source_chunks FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Add chunking status to source_files
ALTER TABLE source_files
ADD COLUMN IF NOT EXISTS is_chunked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chunked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_source_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS source_chunks_updated_at ON source_chunks;
CREATE TRIGGER source_chunks_updated_at
  BEFORE UPDATE ON source_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_source_chunks_updated_at();
