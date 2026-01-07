-- ============================================================================
-- Migration: Variant Scope Contracts (State Variant Intelligence v2)
-- ============================================================================
-- Creates table to store Scope Contracts for variant generation pipeline.
-- The Scope Contract constrains downstream research, Key Facts, and generation.
-- ============================================================================

-- Create the variant_scope_contracts table
CREATE TABLE IF NOT EXISTS variant_scope_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,

  -- Variant context
  variant_type TEXT NOT NULL CHECK (variant_type IN ('geographic', 'company', 'unit')),
  variant_context JSONB NOT NULL DEFAULT '{}',

  -- The scope contract itself (JSON blob)
  -- Contains: primaryRole, secondaryRoles, roleConfidence, roleEvidenceQuotes,
  --           allowedLearnerActions, disallowedActionClasses, domainAnchors, instructionalGoal
  scope_contract JSONB NOT NULL,

  -- Role selection status
  role_selection_needed BOOLEAN NOT NULL DEFAULT false,
  top_role_matches JSONB, -- Array of {roleId, roleName, score, why}

  -- Extraction metadata
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('llm', 'fallback')),
  validation_errors TEXT[], -- Any validation errors during extraction

  -- Debug/audit fields
  raw_llm_response TEXT, -- For debugging LLM output issues

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_variant_scope_contracts_org
  ON variant_scope_contracts(organization_id);

CREATE INDEX IF NOT EXISTS idx_variant_scope_contracts_source_track
  ON variant_scope_contracts(source_track_id);

CREATE INDEX IF NOT EXISTS idx_variant_scope_contracts_variant_type
  ON variant_scope_contracts(variant_type);

CREATE INDEX IF NOT EXISTS idx_variant_scope_contracts_role_selection
  ON variant_scope_contracts(organization_id, role_selection_needed)
  WHERE role_selection_needed = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_variant_scope_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS variant_scope_contracts_updated_at ON variant_scope_contracts;
CREATE TRIGGER variant_scope_contracts_updated_at
  BEFORE UPDATE ON variant_scope_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_variant_scope_contracts_updated_at();

-- Enable RLS
ALTER TABLE variant_scope_contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Select: Users can view contracts for their organization
CREATE POLICY "Users can view scope contracts for their organization"
  ON variant_scope_contracts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Insert: Users can create contracts for their organization
CREATE POLICY "Users can create scope contracts for their organization"
  ON variant_scope_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Update: Users can update contracts for their organization
CREATE POLICY "Users can update scope contracts for their organization"
  ON variant_scope_contracts
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

-- Delete: Users can delete contracts for their organization
CREATE POLICY "Users can delete scope contracts for their organization"
  ON variant_scope_contracts
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role has full access to scope contracts"
  ON variant_scope_contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE variant_scope_contracts IS
  'Stores Scope Contracts for the State Variant Intelligence v2 pipeline. '
  'A Scope Contract defines the learner role, allowed actions, domain anchors, '
  'and disallowed action classes that constrain downstream variant generation.';

COMMENT ON COLUMN variant_scope_contracts.scope_contract IS
  'JSON object containing: primaryRole, secondaryRoles, roleConfidence, '
  'roleEvidenceQuotes, allowedLearnerActions, disallowedActionClasses, '
  'domainAnchors, instructionalGoal';

COMMENT ON COLUMN variant_scope_contracts.role_selection_needed IS
  'True if user should confirm role selection via UI before proceeding';

COMMENT ON COLUMN variant_scope_contracts.extraction_method IS
  'llm = successfully extracted via LLM, fallback = used heuristic fallback';
