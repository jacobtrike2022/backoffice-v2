-- ============================================================================
-- PLAYBOOKS - Source-to-Album Automated Workflow
-- Creates tables for persisting playbook state, track groupings, and chunk assignments
-- ============================================================================

-- ============================================================================
-- PLAYBOOKS TABLE - Main playbook session tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_file_id UUID NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,

  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Overall status progression
  -- suggestion: Initial RAG analysis complete, user reviewing/adjusting groupings
  -- confirmed: All tracks confirmed, ready for draft generation
  -- generating: Draft generation in progress
  -- review: All drafts generated, user reviewing/approving
  -- publishing: Publishing in progress
  -- completed: All tracks published, album created
  -- cancelled: User cancelled the playbook
  status TEXT NOT NULL DEFAULT 'suggestion'
    CHECK (status IN ('suggestion', 'confirmed', 'generating', 'review', 'publishing', 'completed', 'cancelled')),

  -- RAG analysis results (cached for display)
  rag_analysis JSONB DEFAULT '{}',

  -- Target album (created during publish phase)
  album_id UUID REFERENCES albums(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_playbooks_org ON playbooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_source ON playbooks(source_file_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON playbooks(status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_playbooks_created_by ON playbooks(created_by);

COMMENT ON TABLE playbooks IS 'Tracks Source-to-Album playbook sessions for automated track generation from source chunks';
COMMENT ON COLUMN playbooks.status IS 'Workflow status: suggestion → confirmed → generating → review → publishing → completed';
COMMENT ON COLUMN playbooks.rag_analysis IS 'Cached RAG analysis results including grouping reasoning and conflict summary';

-- ============================================================================
-- PLAYBOOK TRACKS TABLE - Individual track groupings within a playbook
-- ============================================================================
CREATE TABLE IF NOT EXISTS playbook_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Track metadata (user-editable)
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Status progression for individual tracks
  -- suggestion: RAG suggested this grouping
  -- confirmed: User confirmed the grouping, ready for draft generation
  -- generating: Draft generation in progress
  -- draft_ready: Draft generated, awaiting approval
  -- approved: User approved the draft, ready for publishing
  -- published: Track published to content library
  -- skipped: User chose to skip this track
  status TEXT NOT NULL DEFAULT 'suggestion'
    CHECK (status IN ('suggestion', 'confirmed', 'generating', 'draft_ready', 'approved', 'published', 'skipped')),

  -- RAG reasoning for this grouping
  rag_reasoning TEXT,
  rag_confidence DECIMAL(3,2),

  -- Conflict detection
  has_conflicts BOOLEAN DEFAULT FALSE,
  conflicts JSONB DEFAULT '[]',
  -- conflicts structure: [{
  --   existing_track_id: uuid,
  --   existing_track_title: string,
  --   similarity_score: number (0-1),
  --   match_type: 'direct_overlap' | 'version_candidate' | 'variant_candidate',
  --   overlap_summary: string
  -- }]
  conflict_resolution TEXT CHECK (conflict_resolution IN ('keep_new', 'keep_existing', 'create_version', 'create_variant', NULL)),

  -- Generated draft content
  generated_content TEXT,
  generated_at TIMESTAMPTZ,
  generation_error TEXT,

  -- Published track reference
  published_track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_playbook_tracks_playbook ON playbook_tracks(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_tracks_status ON playbook_tracks(playbook_id, status);
CREATE INDEX IF NOT EXISTS idx_playbook_tracks_order ON playbook_tracks(playbook_id, display_order);

COMMENT ON TABLE playbook_tracks IS 'Individual track groupings within a playbook, tracking status from suggestion through publishing';
COMMENT ON COLUMN playbook_tracks.rag_reasoning IS 'AI explanation for why these chunks were grouped together';
COMMENT ON COLUMN playbook_tracks.conflicts IS 'Array of detected conflicts with existing published content';
COMMENT ON COLUMN playbook_tracks.conflict_resolution IS 'User choice for handling conflicts: keep_new, keep_existing, create_version, create_variant';

-- ============================================================================
-- PLAYBOOK TRACK CHUNKS TABLE - Junction table linking chunks to tracks
-- ============================================================================
CREATE TABLE IF NOT EXISTS playbook_track_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_track_id UUID NOT NULL REFERENCES playbook_tracks(id) ON DELETE CASCADE,
  source_chunk_id UUID NOT NULL REFERENCES source_chunks(id) ON DELETE CASCADE,

  -- Ordering within the track
  sequence_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate chunk assignments within a track
  UNIQUE(playbook_track_id, source_chunk_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_playbook_track_chunks_track ON playbook_track_chunks(playbook_track_id);
CREATE INDEX IF NOT EXISTS idx_playbook_track_chunks_chunk ON playbook_track_chunks(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_playbook_track_chunks_order ON playbook_track_chunks(playbook_track_id, sequence_order);

COMMENT ON TABLE playbook_track_chunks IS 'Links source chunks to playbook tracks with ordering';

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_track_chunks ENABLE ROW LEVEL SECURITY;

-- Playbooks policies
CREATE POLICY "Users can view playbooks in their organization"
  ON playbooks FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can create playbooks in their organization"
  ON playbooks FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update playbooks in their organization"
  ON playbooks FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete playbooks in their organization"
  ON playbooks FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Service role bypass for playbooks (for edge functions)
CREATE POLICY "Service role has full access to playbooks"
  ON playbooks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Playbook tracks policies
CREATE POLICY "Users can manage playbook tracks in their organization"
  ON playbook_tracks FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Service role has full access to playbook tracks"
  ON playbook_tracks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Playbook track chunks policies (through parent playbook_tracks)
CREATE POLICY "Users can manage playbook track chunks through parent"
  ON playbook_track_chunks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM playbook_tracks pt
    WHERE pt.id = playbook_track_chunks.playbook_track_id
    AND pt.organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM playbook_tracks pt
    WHERE pt.id = playbook_track_chunks.playbook_track_id
    AND pt.organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  ));

CREATE POLICY "Service role has full access to playbook track chunks"
  ON playbook_track_chunks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get full playbook with tracks and chunks
CREATE OR REPLACE FUNCTION get_playbook_with_details(p_playbook_id UUID)
RETURNS TABLE(
  playbook_id UUID,
  playbook_title TEXT,
  playbook_status TEXT,
  source_file_id UUID,
  source_file_name TEXT,
  album_id UUID,
  track_id UUID,
  track_title TEXT,
  track_status TEXT,
  track_display_order INTEGER,
  track_has_conflicts BOOLEAN,
  track_rag_reasoning TEXT,
  track_rag_confidence DECIMAL,
  chunk_id UUID,
  chunk_sequence_order INTEGER,
  chunk_content TEXT,
  chunk_title TEXT,
  chunk_index INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as playbook_id,
    p.title as playbook_title,
    p.status as playbook_status,
    p.source_file_id,
    sf.file_name as source_file_name,
    p.album_id,
    pt.id as track_id,
    pt.title as track_title,
    pt.status as track_status,
    pt.display_order as track_display_order,
    pt.has_conflicts as track_has_conflicts,
    pt.rag_reasoning as track_rag_reasoning,
    pt.rag_confidence as track_rag_confidence,
    sc.id as chunk_id,
    ptc.sequence_order as chunk_sequence_order,
    sc.content as chunk_content,
    sc.title as chunk_title,
    sc.chunk_index
  FROM playbooks p
  LEFT JOIN source_files sf ON p.source_file_id = sf.id
  LEFT JOIN playbook_tracks pt ON pt.playbook_id = p.id
  LEFT JOIN playbook_track_chunks ptc ON ptc.playbook_track_id = pt.id
  LEFT JOIN source_chunks sc ON ptc.source_chunk_id = sc.id
  WHERE p.id = p_playbook_id
  ORDER BY pt.display_order, ptc.sequence_order;
END;
$$ LANGUAGE plpgsql;

-- Function to update playbook updated_at timestamp
CREATE OR REPLACE FUNCTION update_playbook_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_playbook_timestamp();

CREATE TRIGGER playbook_tracks_updated_at
  BEFORE UPDATE ON playbook_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_playbook_timestamp();
