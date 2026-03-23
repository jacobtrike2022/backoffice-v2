-- =====================================================
-- FIX: Add explicit WITH CHECK to deals/activities/proposals RLS
-- =====================================================
-- The original FOR ALL policies used only USING() without
-- WITH CHECK(). While PostgreSQL docs say USING is used
-- as WITH CHECK when omitted, Supabase/PostgREST can
-- reject INSERTs without an explicit WITH CHECK clause.
-- This migration drops and recreates the policies with
-- both USING and WITH CHECK for full CRUD support.
-- =====================================================

-- =====================================================
-- DEALS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Trike super admins can manage all deals" ON deals;
DROP POLICY IF EXISTS "Service role has full access to deals" ON deals;

CREATE POLICY "Trike super admins can manage all deals"
    ON deals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    );

CREATE POLICY "Service role has full access to deals"
    ON deals FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- DEAL ACTIVITIES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Trike super admins can manage deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Service role has full access to deal activities" ON deal_activities;

CREATE POLICY "Trike super admins can manage deal activities"
    ON deal_activities FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    );

CREATE POLICY "Service role has full access to deal activities"
    ON deal_activities FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- PROPOSALS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Trike super admins can manage all proposals" ON proposals;
DROP POLICY IF EXISTS "Service role has full access to proposals" ON proposals;

CREATE POLICY "Trike super admins can manage all proposals"
    ON proposals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    );

CREATE POLICY "Service role has full access to proposals"
    ON proposals FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
