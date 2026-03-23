-- =====================================================
-- FIX: Demo mode RLS for deals pipeline tables
-- =====================================================
-- The comprehensive demo fix (20260305100002) missed the deals,
-- deal_activities, and proposals tables. In demo mode:
--   auth.uid() = NULL
-- Using auth.uid() IS NULL pattern (proven working in other tables).
--
-- Drops old anon policies from 20260303100003 which used
-- auth.role() = 'anon' (may not work in all setups).
-- =====================================================

-- DEALS
DROP POLICY IF EXISTS "Demo: anon access to deals" ON deals;
DROP POLICY IF EXISTS "Demo mode: anon manage deals" ON deals;
CREATE POLICY "Demo mode: anon manage deals"
    ON deals FOR ALL
    USING (auth.uid() IS NULL)
    WITH CHECK (auth.uid() IS NULL);

-- DEAL ACTIVITIES
DROP POLICY IF EXISTS "Demo: anon access to deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Demo mode: anon manage deal_activities" ON deal_activities;
CREATE POLICY "Demo mode: anon manage deal_activities"
    ON deal_activities FOR ALL
    USING (auth.uid() IS NULL)
    WITH CHECK (auth.uid() IS NULL);

-- PROPOSALS
DROP POLICY IF EXISTS "Demo: anon access to proposals" ON proposals;
DROP POLICY IF EXISTS "Demo mode: anon manage proposals" ON proposals;
CREATE POLICY "Demo mode: anon manage proposals"
    ON proposals FOR ALL
    USING (auth.uid() IS NULL)
    WITH CHECK (auth.uid() IS NULL);
