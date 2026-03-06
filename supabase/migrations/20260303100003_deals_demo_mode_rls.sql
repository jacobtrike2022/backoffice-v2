-- =====================================================
-- DEMO/DEV MODE: Anon access for deals pipeline tables
-- =====================================================
-- In demo mode (REQUIRE_AUTH: false, DEMO_MODE: true),
-- the app uses the Supabase anon key without an auth session.
-- auth.uid() returns NULL, so role-based RLS policies block
-- all INSERT/UPDATE/DELETE operations (42501 errors).
--
-- These policies allow the anon role to perform CRUD on
-- pipeline tables for development and demo purposes.
--
-- IMPORTANT: Remove these policies before production deployment!
-- In production, users authenticate via Supabase Auth and
-- the existing role-based policies handle access control.
-- =====================================================

-- DEALS
CREATE POLICY "Demo: anon access to deals"
    ON deals FOR ALL
    USING (auth.role() = 'anon')
    WITH CHECK (auth.role() = 'anon');

-- DEAL ACTIVITIES
CREATE POLICY "Demo: anon access to deal activities"
    ON deal_activities FOR ALL
    USING (auth.role() = 'anon')
    WITH CHECK (auth.role() = 'anon');

-- PROPOSALS
CREATE POLICY "Demo: anon access to proposals"
    ON proposals FOR ALL
    USING (auth.role() = 'anon')
    WITH CHECK (auth.role() = 'anon');
