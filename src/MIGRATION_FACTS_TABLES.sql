-- =====================================================
-- KEY FACTS DATABASE MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. SOURCES TABLE (for tracking original documents)
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('handbook', 'sop', 'manual', 'policy', 'law', 'regulation', 'custom')),
  original_format TEXT CHECK (original_format IN ('pdf', 'docx', 'txt', 'markdown', 'html')),
  markdown TEXT, -- Docling output
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  version TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  company_id TEXT,
  
  -- External source tracking
  external_source JSONB, -- { type, sourceId, lastSynced, url }
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FACTS TABLE (the atomic knowledge units - THE CROWN JEWEL)
CREATE TABLE IF NOT EXISTS facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('Fact', 'Procedure')) NOT NULL,
  steps JSONB DEFAULT '[]', -- Array of strings for Procedure type
  
  -- CONTEXT HIERARCHY (for variants and conflict detection)
  context JSONB NOT NULL DEFAULT '{"specificity": "universal", "tags": {}}',
  -- Structure: { specificity: 'universal'|'sector'|'industry'|'program'|'state'|'company'|'unit', tags: { sector?, industry?, program?, state?, company?, unit? } }
  
  -- LINEAGE (where did this come from?)
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  source_section TEXT,
  source_page INTEGER,
  extracted_by TEXT CHECK (extracted_by IN ('ai-pass-1', 'ai-pass-2', 'manual', 'imported')) DEFAULT 'manual',
  extraction_confidence DECIMAL(3,2), -- 0.00 to 1.00
  
  -- RELATIONSHIPS (stored as arrays of UUIDs)
  related_facts JSONB DEFAULT '[]', -- Array of fact IDs
  prerequisite_facts JSONB DEFAULT '[]', -- Array of fact IDs
  supersedes JSONB DEFAULT '[]', -- Array of fact IDs this replaces
  superseded_by UUID REFERENCES facts(id) ON DELETE SET NULL, -- The fact that replaces this one
  
  -- ANALYTICS & QUALITY
  views INTEGER DEFAULT 0,
  effectiveness DECIMAL(3,2), -- 0.00 to 1.00, based on checkpoint performance
  needs_review BOOLEAN DEFAULT FALSE,
  last_verified TIMESTAMPTZ,
  verified_by TEXT,
  
  -- EXTERNAL SOURCE TRACKING (for compliance updates)
  external_source JSONB, -- { type: 'fda-food-code'|'justia-law'|'osha-regulation', sourceId, lastSynced, url? }
  
  -- METADATA
  company_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  change_history JSONB DEFAULT '[]' -- Array of change objects
);

-- 3. FACT USAGE (which tracks use which facts)
CREATE TABLE IF NOT EXISTS fact_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id UUID REFERENCES facts(id) ON DELETE CASCADE NOT NULL,
  track_type TEXT CHECK (track_type IN ('article', 'video', 'story', 'checkpoint')) NOT NULL,
  track_id TEXT NOT NULL, -- String ID from the respective track table
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure we don't duplicate the same fact in the same track
  UNIQUE(fact_id, track_type, track_id)
);

-- 4. FACT CONFLICTS (for compliance management)
CREATE TABLE IF NOT EXISTS fact_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id UUID REFERENCES facts(id) ON DELETE CASCADE NOT NULL,
  conflicting_fact_id UUID REFERENCES facts(id) ON DELETE CASCADE NOT NULL,
  reason TEXT CHECK (reason IN ('state-override', 'company-policy', 'outdated', 'contradictory')) NOT NULL,
  resolution TEXT CHECK (resolution IN ('defer-to-company', 'defer-to-state', 'needs-review')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure we don't duplicate the same conflict pair
  UNIQUE(fact_id, conflicting_fact_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Facts table indexes
CREATE INDEX IF NOT EXISTS idx_facts_company ON facts(company_id);
CREATE INDEX IF NOT EXISTS idx_facts_source ON facts(source_id);
CREATE INDEX IF NOT EXISTS idx_facts_needs_review ON facts(needs_review) WHERE needs_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_facts_superseded ON facts(superseded_by) WHERE superseded_by IS NOT NULL;

-- JSONB GIN indexes for fast context queries
CREATE INDEX IF NOT EXISTS idx_facts_context_gin ON facts USING GIN (context);

-- More specific indexes for common queries
CREATE INDEX IF NOT EXISTS idx_facts_specificity ON facts ((context->>'specificity'));
CREATE INDEX IF NOT EXISTS idx_facts_state ON facts ((context->'tags'->>'state')) WHERE context->'tags'->>'state' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facts_company_tag ON facts ((context->'tags'->>'company')) WHERE context->'tags'->>'company' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facts_program ON facts ((context->'tags'->>'program')) WHERE context->'tags'->>'program' IS NOT NULL;

-- Fact usage indexes
CREATE INDEX IF NOT EXISTS idx_fact_usage_fact ON fact_usage(fact_id);
CREATE INDEX IF NOT EXISTS idx_fact_usage_track ON fact_usage(track_type, track_id);

-- Fact conflicts indexes
CREATE INDEX IF NOT EXISTS idx_fact_conflicts_fact ON fact_conflicts(fact_id);
CREATE INDEX IF NOT EXISTS idx_fact_conflicts_conflicting ON fact_conflicts(conflicting_fact_id);

-- Sources indexes
CREATE INDEX IF NOT EXISTS idx_sources_company ON sources(company_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

-- Auto-update updated_at on facts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_facts_updated_at BEFORE UPDATE ON facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (Optional - enable if using RLS)
-- =====================================================

-- If you're using RLS, uncomment these:
-- ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fact_usage ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fact_conflicts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Create policies as needed for your auth setup

-- =====================================================
-- HELPER VIEWS (Optional but useful)
-- =====================================================

-- View of facts with their usage count
CREATE OR REPLACE VIEW facts_with_usage AS
SELECT 
  f.*,
  COUNT(fu.id) as usage_count
FROM facts f
LEFT JOIN fact_usage fu ON f.id = fu.fact_id
GROUP BY f.id;

-- View of facts needing review
CREATE OR REPLACE VIEW facts_needing_review AS
SELECT 
  f.*,
  COUNT(fc.id) as conflict_count
FROM facts f
LEFT JOIN fact_conflicts fc ON f.id = fc.fact_id
WHERE f.needs_review = TRUE
GROUP BY f.id;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- After running this migration:
-- 1. The FactService.ts will work immediately
-- 2. Existing learning_objectives arrays are preserved (backward compatible)
-- 3. New AI-generated facts will be stored in facts table
-- 4. UI will fetch from facts table first, fall back to learning_objectives
