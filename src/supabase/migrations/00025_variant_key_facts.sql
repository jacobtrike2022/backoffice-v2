-- ============================================================================
-- Migration: Variant Key Facts (State Variant Intelligence v2 - Prompt 3)
-- ============================================================================
-- Creates tables to store Key Facts extracted from evidence.
-- Key Facts are atomic claims with grounded citations and QA gate results.
-- ============================================================================

-- Create the variant_key_facts_extractions table (batch/session level)
CREATE TABLE IF NOT EXISTS variant_key_facts_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES variant_scope_contracts(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES variant_research_plans(id) ON DELETE SET NULL,

  -- State context
  state_code TEXT NOT NULL,
  state_name TEXT,

  -- Extraction metadata
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('llm', 'fallback')),
  overall_status TEXT NOT NULL CHECK (overall_status IN ('PASS', 'PASS_WITH_REVIEW', 'FAIL')),

  -- Counts
  key_facts_count INTEGER NOT NULL DEFAULT 0,
  rejected_facts_count INTEGER NOT NULL DEFAULT 0,

  -- Gate results (JSON blob)
  gate_results JSONB NOT NULL DEFAULT '[]',

  -- Raw LLM output for audit
  raw_llm_response TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create the variant_key_facts table (individual facts)
CREATE TABLE IF NOT EXISTS variant_key_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  extraction_id UUID NOT NULL REFERENCES variant_key_facts_extractions(id) ON DELETE CASCADE,

  -- Fact content
  fact_text TEXT NOT NULL,
  mapped_action TEXT NOT NULL,
  anchor_hits TEXT[] NOT NULL DEFAULT '{}',

  -- Strong claim tracking
  is_strong_claim BOOLEAN NOT NULL DEFAULT false,

  -- QA status
  qa_status TEXT NOT NULL CHECK (qa_status IN ('PASS', 'PASS_WITH_REVIEW', 'FAIL')),
  qa_flags TEXT[] NOT NULL DEFAULT '{}',

  -- Citations stored as JSON array
  citations JSONB NOT NULL DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create the variant_rejected_facts table (facts that failed QA)
CREATE TABLE IF NOT EXISTS variant_rejected_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  extraction_id UUID NOT NULL REFERENCES variant_key_facts_extractions(id) ON DELETE CASCADE,

  -- Fact content
  fact_text TEXT NOT NULL,

  -- Rejection reason
  reason TEXT NOT NULL,
  failed_gates TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_variant_key_facts_extractions_org
  ON variant_key_facts_extractions(organization_id);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_extractions_contract
  ON variant_key_facts_extractions(contract_id);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_extractions_plan
  ON variant_key_facts_extractions(plan_id);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_extractions_state
  ON variant_key_facts_extractions(state_code);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_extractions_status
  ON variant_key_facts_extractions(overall_status);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_extraction
  ON variant_key_facts(extraction_id);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_org
  ON variant_key_facts(organization_id);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_status
  ON variant_key_facts(qa_status);

CREATE INDEX IF NOT EXISTS idx_variant_key_facts_strong_claim
  ON variant_key_facts(is_strong_claim) WHERE is_strong_claim = true;

CREATE INDEX IF NOT EXISTS idx_variant_rejected_facts_extraction
  ON variant_rejected_facts(extraction_id);

-- Enable RLS
ALTER TABLE variant_key_facts_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_key_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_rejected_facts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for variant_key_facts_extractions
-- ============================================================================

CREATE POLICY "Users can view key fact extractions for their organization"
  ON variant_key_facts_extractions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create key fact extractions for their organization"
  ON variant_key_facts_extractions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete key fact extractions for their organization"
  ON variant_key_facts_extractions
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to key fact extractions"
  ON variant_key_facts_extractions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS Policies for variant_key_facts
-- ============================================================================

CREATE POLICY "Users can view key facts for their organization"
  ON variant_key_facts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create key facts for their organization"
  ON variant_key_facts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update key facts for their organization"
  ON variant_key_facts
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

CREATE POLICY "Users can delete key facts for their organization"
  ON variant_key_facts
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to key facts"
  ON variant_key_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS Policies for variant_rejected_facts
-- ============================================================================

CREATE POLICY "Users can view rejected facts for their organization"
  ON variant_rejected_facts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create rejected facts for their organization"
  ON variant_rejected_facts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete rejected facts for their organization"
  ON variant_rejected_facts
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to rejected facts"
  ON variant_rejected_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE variant_key_facts_extractions IS
  'Stores Key Facts extraction sessions for State Variant Intelligence v2. '
  'Each extraction processes evidence from a Research Plan through QA gates.';

COMMENT ON COLUMN variant_key_facts_extractions.overall_status IS
  'PASS = all facts passed QA, PASS_WITH_REVIEW = some facts need review, FAIL = critical issues';

COMMENT ON COLUMN variant_key_facts_extractions.gate_results IS
  'JSON array of QualityGateResult objects with gate name, status, and reason';

COMMENT ON TABLE variant_key_facts IS
  'Individual Key Facts extracted from evidence. Each fact is an atomic claim '
  'with citations and QA status.';

COMMENT ON COLUMN variant_key_facts.citations IS
  'JSON array of KeyFactCitation objects with evidenceId, quote, tier, url, etc.';

COMMENT ON COLUMN variant_key_facts.qa_flags IS
  'Array of reasons for non-PASS status (e.g., "B: Strong claim lacks Tier-1 support")';

COMMENT ON TABLE variant_rejected_facts IS
  'Facts that failed QA gates and were not included in the final extraction.';
