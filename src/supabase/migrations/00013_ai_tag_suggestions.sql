-- ============================================
-- AI Tag Suggestions - Tracks recommendations for pattern detection
-- ============================================

CREATE TABLE IF NOT EXISTS ai_tag_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  
  -- Suggestion details
  suggested_tag_name TEXT NOT NULL,
  suggested_parent_category TEXT,  -- e.g., "Compliance", "Foodservice"
  reasoning TEXT,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'auto_created')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  
  -- If this suggestion led to a new tag being created
  created_tag_id UUID REFERENCES tags(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate suggestions for same track
  UNIQUE(track_id, suggested_tag_name)
);

-- Index for finding patterns (same suggestion across multiple tracks)
CREATE INDEX IF NOT EXISTS idx_ai_tag_suggestions_pattern 
ON ai_tag_suggestions(organization_id, suggested_tag_name, status);

-- Index for finding pending suggestions for a track
CREATE INDEX IF NOT EXISTS idx_ai_tag_suggestions_track 
ON ai_tag_suggestions(track_id, status);

-- RLS Policies
ALTER TABLE ai_tag_suggestions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_tag_suggestions' AND policyname = 'Users can view suggestions for their org'
  ) THEN
    CREATE POLICY "Users can view suggestions for their org"
    ON ai_tag_suggestions FOR SELECT
    USING (organization_id = get_user_organization_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_tag_suggestions' AND policyname = 'Users can insert suggestions for their org'
  ) THEN
    CREATE POLICY "Users can insert suggestions for their org"
    ON ai_tag_suggestions FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_tag_suggestions' AND policyname = 'Users can update suggestions for their org'
  ) THEN
    CREATE POLICY "Users can update suggestions for their org"
    ON ai_tag_suggestions FOR UPDATE
    USING (organization_id = get_user_organization_id());
  END IF;
END $$;

