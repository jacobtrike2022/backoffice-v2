-- ============================================================================
-- Migration: Variant Research Plans (State Variant Intelligence v2 - Prompt 2)
-- ============================================================================
-- Creates tables to store Research Plans and Retrieval Results.
-- Research Plans constrain what queries can be executed based on Scope Contract.
-- ============================================================================

-- Create the variant_research_plans table
CREATE TABLE IF NOT EXISTS variant_research_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES variant_scope_contracts(id) ON DELETE SET NULL,

  -- State context
  state_code TEXT NOT NULL,
  state_name TEXT,

  -- The research plan (JSON blob)
  -- Contains: queries[], globalNegativeTerms[], sourcePolicy
  research_plan JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create the variant_retrieval_results table
CREATE TABLE IF NOT EXISTS variant_retrieval_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES variant_research_plans(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES variant_scope_contracts(id) ON DELETE SET NULL,

  -- Result counts
  evidence_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,

  -- Full retrieval output (JSON blob)
  -- Contains: evidence[], rejected[]
  retrieval_output JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_variant_research_plans_org
  ON variant_research_plans(organization_id);

CREATE INDEX IF NOT EXISTS idx_variant_research_plans_contract
  ON variant_research_plans(contract_id);

CREATE INDEX IF NOT EXISTS idx_variant_research_plans_state
  ON variant_research_plans(state_code);

CREATE INDEX IF NOT EXISTS idx_variant_retrieval_results_org
  ON variant_retrieval_results(organization_id);

CREATE INDEX IF NOT EXISTS idx_variant_retrieval_results_plan
  ON variant_retrieval_results(plan_id);

-- Create updated_at trigger for research plans
CREATE OR REPLACE FUNCTION update_variant_research_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS variant_research_plans_updated_at ON variant_research_plans;
CREATE TRIGGER variant_research_plans_updated_at
  BEFORE UPDATE ON variant_research_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_variant_research_plans_updated_at();

-- Enable RLS
ALTER TABLE variant_research_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_retrieval_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for variant_research_plans

CREATE POLICY "Users can view research plans for their organization"
  ON variant_research_plans
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create research plans for their organization"
  ON variant_research_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update research plans for their organization"
  ON variant_research_plans
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

CREATE POLICY "Users can delete research plans for their organization"
  ON variant_research_plans
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to research plans"
  ON variant_research_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for variant_retrieval_results

CREATE POLICY "Users can view retrieval results for their organization"
  ON variant_retrieval_results
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create retrieval results for their organization"
  ON variant_retrieval_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete retrieval results for their organization"
  ON variant_retrieval_results
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to retrieval results"
  ON variant_retrieval_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE variant_research_plans IS
  'Stores Research Plans for the State Variant Intelligence v2 pipeline. '
  'A Research Plan defines constrained queries derived from the Scope Contract.';

COMMENT ON COLUMN variant_research_plans.research_plan IS
  'JSON object containing: queries[], globalNegativeTerms[], sourcePolicy{}';

COMMENT ON TABLE variant_retrieval_results IS
  'Stores retrieval results from executing Research Plans. '
  'Contains accepted evidence blocks and rejected results with reasons.';

COMMENT ON COLUMN variant_retrieval_results.retrieval_output IS
  'JSON object containing: evidence[], rejected[]';
