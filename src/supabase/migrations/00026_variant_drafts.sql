-- ============================================================================
-- Migration: Variant Drafts (State Variant Intelligence v2 - Prompt 4)
-- ============================================================================
-- Creates tables to store Variant Drafts with diff ops and change notes.
-- Drafts are minimal-delta adaptations grounded in validated Key Facts.
-- ============================================================================

-- Create the variant_drafts table
CREATE TABLE IF NOT EXISTS variant_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES variant_scope_contracts(id) ON DELETE SET NULL,
  extraction_id UUID REFERENCES variant_key_facts_extractions(id) ON DELETE SET NULL,
  source_track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,

  -- State context
  state_code TEXT NOT NULL,
  state_name TEXT,

  -- Draft content
  track_type TEXT NOT NULL CHECK (track_type IN ('article', 'video', 'story', 'checkpoint')),
  status TEXT NOT NULL CHECK (status IN ('generated', 'generated_needs_review', 'blocked')),
  draft_title TEXT NOT NULL,
  draft_content TEXT NOT NULL,

  -- Key fact tracking
  applied_key_fact_ids UUID[] NOT NULL DEFAULT '{}',
  needs_review_key_fact_ids UUID[] NOT NULL DEFAULT '{}',

  -- Blocked reasons (if status = 'blocked')
  blocked_reasons TEXT[] DEFAULT NULL,

  -- Diff ops stored as JSON
  diff_ops JSONB NOT NULL DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create the variant_change_notes table
CREATE TABLE IF NOT EXISTS variant_change_notes (
  id TEXT NOT NULL, -- note-1, note-2, etc.
  draft_id UUID NOT NULL REFERENCES variant_drafts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Note content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  mapped_action TEXT NOT NULL,
  anchor_matches TEXT[] NOT NULL DEFAULT '{}',

  -- Affected range in draft content
  affected_range_start INTEGER NOT NULL,
  affected_range_end INTEGER NOT NULL,

  -- Key fact linkage
  key_fact_ids UUID[] NOT NULL DEFAULT '{}',

  -- Citations (JSON array)
  citations JSONB NOT NULL DEFAULT '[]',

  -- Status
  status TEXT NOT NULL CHECK (status IN ('applied', 'needs_review', 'blocked')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (draft_id, id)
);

-- Create the variant_draft_history table (for lightning bolt edits)
CREATE TABLE IF NOT EXISTS variant_draft_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES variant_drafts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Edit metadata
  instruction TEXT NOT NULL,
  previous_content TEXT NOT NULL,
  new_content TEXT NOT NULL,

  -- Changes made
  diff_ops JSONB NOT NULL DEFAULT '[]',
  change_notes JSONB NOT NULL DEFAULT '[]',
  applied_key_fact_ids UUID[] NOT NULL DEFAULT '{}',

  -- Blocked changes (if any)
  blocked_changes JSONB DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_variant_drafts_org
  ON variant_drafts(organization_id);

CREATE INDEX IF NOT EXISTS idx_variant_drafts_contract
  ON variant_drafts(contract_id);

CREATE INDEX IF NOT EXISTS idx_variant_drafts_extraction
  ON variant_drafts(extraction_id);

CREATE INDEX IF NOT EXISTS idx_variant_drafts_source_track
  ON variant_drafts(source_track_id);

CREATE INDEX IF NOT EXISTS idx_variant_drafts_state
  ON variant_drafts(state_code);

CREATE INDEX IF NOT EXISTS idx_variant_drafts_status
  ON variant_drafts(status);

CREATE INDEX IF NOT EXISTS idx_variant_change_notes_draft
  ON variant_change_notes(draft_id);

CREATE INDEX IF NOT EXISTS idx_variant_change_notes_org
  ON variant_change_notes(organization_id);

CREATE INDEX IF NOT EXISTS idx_variant_change_notes_status
  ON variant_change_notes(status);

CREATE INDEX IF NOT EXISTS idx_variant_draft_history_draft
  ON variant_draft_history(draft_id);

-- Create updated_at trigger for drafts
CREATE OR REPLACE FUNCTION update_variant_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS variant_drafts_updated_at ON variant_drafts;
CREATE TRIGGER variant_drafts_updated_at
  BEFORE UPDATE ON variant_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_variant_drafts_updated_at();

-- Enable RLS
ALTER TABLE variant_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_change_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_draft_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for variant_drafts
-- ============================================================================

CREATE POLICY "Users can view drafts for their organization"
  ON variant_drafts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create drafts for their organization"
  ON variant_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update drafts for their organization"
  ON variant_drafts
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete drafts for their organization"
  ON variant_drafts
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to drafts"
  ON variant_drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS Policies for variant_change_notes
-- ============================================================================

CREATE POLICY "Users can view change notes for their organization"
  ON variant_change_notes
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create change notes for their organization"
  ON variant_change_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update change notes for their organization"
  ON variant_change_notes
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete change notes for their organization"
  ON variant_change_notes
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to change notes"
  ON variant_change_notes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS Policies for variant_draft_history
-- ============================================================================

CREATE POLICY "Users can view draft history for their organization"
  ON variant_draft_history
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create draft history for their organization"
  ON variant_draft_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to draft history"
  ON variant_draft_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE variant_drafts IS
  'Stores Variant Drafts for State Variant Intelligence v2. '
  'Each draft is a minimal-delta adaptation grounded in validated Key Facts.';

COMMENT ON COLUMN variant_drafts.status IS
  'generated = ready for review, generated_needs_review = has facts needing review, blocked = could not generate';

COMMENT ON COLUMN variant_drafts.diff_ops IS
  'JSON array of DiffOp objects with type, sourceStart/End, draftStart/End, oldText, newText, noteId';

COMMENT ON COLUMN variant_drafts.applied_key_fact_ids IS
  'Array of Key Fact IDs that were successfully applied in this draft';

COMMENT ON COLUMN variant_drafts.needs_review_key_fact_ids IS
  'Array of Key Fact IDs with PASS_WITH_REVIEW status applied in this draft';

COMMENT ON TABLE variant_change_notes IS
  'Change notes for variant drafts. Each note describes a specific change '
  'with citations to the Key Facts that justify it.';

COMMENT ON COLUMN variant_change_notes.citations IS
  'JSON array of CitationRef objects with url, tier, snippet, effectiveOrUpdatedDate';

COMMENT ON TABLE variant_draft_history IS
  'History of lightning bolt edits applied to drafts. '
  'Records instruction, changes made, and any blocked changes.';
