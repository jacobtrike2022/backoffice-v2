-- ============================================================================
-- Migration: Fix Variant Tables RLS for Service Role
-- ============================================================================
-- Ensures service_role can bypass RLS on all variant tables
-- ============================================================================

-- Drop existing service role policies and recreate them properly
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'variant_scope_contracts',
            'variant_research_plans',
            'variant_key_facts_extractions',
            'variant_key_facts',
            'variant_rejected_facts',
            'variant_retrieval_results',
            'variant_drafts',
            'variant_change_notes',
            'variant_draft_history'
        ])
    LOOP
        -- Drop existing service role policy if exists
        EXECUTE format('DROP POLICY IF EXISTS "Service role has full access to %I" ON %I', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Service role bypass" ON %I', tbl);

        -- Create new service role policy
        EXECUTE format('
            CREATE POLICY "Service role bypass" ON %I
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true)
        ', tbl);

        RAISE NOTICE 'Fixed RLS for table: %', tbl;
    END LOOP;
END $$;

-- Also ensure RLS is enabled on all variant tables
ALTER TABLE IF EXISTS variant_scope_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_research_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_key_facts_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_key_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_rejected_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_retrieval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_change_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variant_draft_history ENABLE ROW LEVEL SECURITY;
