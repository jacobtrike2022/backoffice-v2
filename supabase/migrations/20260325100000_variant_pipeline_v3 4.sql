-- ============================================================================
-- Variant Pipeline v3: Perplexity research, relevance scoring, two-pass retrieval
-- ============================================================================

-- Add source verification and relevance scoring to key facts
ALTER TABLE variant_key_facts
  ADD COLUMN IF NOT EXISTS source_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relevance_score NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS relevance_status TEXT;

-- Track iterative retrieval passes
CREATE TABLE IF NOT EXISTS variant_retrieval_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  plan_id UUID,
  pass_number INTEGER NOT NULL,
  pass_type TEXT NOT NULL CHECK (pass_type IN ('broad', 'targeted')),
  query_count INTEGER,
  evidence_count INTEGER,
  high_relevance_count INTEGER,
  flagged_count INTEGER,
  rejected_count INTEGER,
  queries_used JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for retrieval passes
ALTER TABLE variant_retrieval_passes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_access_retrieval_passes" ON variant_retrieval_passes;
CREATE POLICY "org_access_retrieval_passes" ON variant_retrieval_passes
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );
