-- =====================================================
-- RLS HARDENING: Guard anon policies + add owner access
-- =====================================================
-- 1. Replace wide-open anon policies with GUC-guarded
--    versions that only activate when app.demo_mode = 'true'
-- 2. Add deal-owner SELECT policies so future sales
--    rep roles can see their own deals
-- 3. Add Org Admin read-only policy for proposals
-- =====================================================

-- =====================================================
-- STEP 1: Remove wide-open anon policies
-- =====================================================

DROP POLICY IF EXISTS "Demo: anon access to deals" ON deals;
DROP POLICY IF EXISTS "Demo: anon access to deal activities" ON deal_activities;
DROP POLICY IF EXISTS "Demo: anon access to proposals" ON proposals;

-- Legacy names from earlier iteration
DROP POLICY IF EXISTS "Anon users can read deals" ON deals;
DROP POLICY IF EXISTS "Anon users can insert deals" ON deals;
DROP POLICY IF EXISTS "Anon users can update deals" ON deals;
DROP POLICY IF EXISTS "Anon users can delete deals" ON deals;
DROP POLICY IF EXISTS "Anon users can read deal_activities" ON deal_activities;
DROP POLICY IF EXISTS "Anon users can insert deal_activities" ON deal_activities;
DROP POLICY IF EXISTS "Anon users can update deal_activities" ON deal_activities;
DROP POLICY IF EXISTS "Anon users can delete deal_activities" ON deal_activities;
DROP POLICY IF EXISTS "Anon users can read proposals" ON proposals;
DROP POLICY IF EXISTS "Anon users can insert proposals" ON proposals;
DROP POLICY IF EXISTS "Anon users can update proposals" ON proposals;
DROP POLICY IF EXISTS "Anon users can delete proposals" ON proposals;

-- =====================================================
-- STEP 2: Guarded anon policies (only when demo mode)
-- =====================================================
-- These use current_setting('app.demo_mode', true) which
-- can be set per-request via Supabase client headers:
--   supabase.rpc('set_config', { setting: 'app.demo_mode', value: 'true' })
-- or via the PostgREST config. When unset, defaults to ''
-- which is NOT 'true', so policies do not apply.

CREATE POLICY "Demo mode: anon access to deals"
    ON deals FOR ALL
    USING (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    )
    WITH CHECK (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    );

CREATE POLICY "Demo mode: anon access to deal activities"
    ON deal_activities FOR ALL
    USING (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    )
    WITH CHECK (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    );

CREATE POLICY "Demo mode: anon access to proposals"
    ON proposals FOR ALL
    USING (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    )
    WITH CHECK (
        auth.role() = 'anon'
        AND current_setting('app.demo_mode', true) = 'true'
    );

-- =====================================================
-- STEP 3: Deal owner policies (for future sales reps)
-- =====================================================
-- Deal owners can view and edit their own deals + activities.
-- This enables a future "Sales Rep" role to manage their pipeline
-- without needing Trike Super Admin privileges.

CREATE POLICY "Deal owners can view their deals"
    ON deals FOR SELECT
    USING (
        owner_id IN (
            SELECT id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Deal owners can update their deals"
    ON deals FOR UPDATE
    USING (
        owner_id IN (
            SELECT id FROM users
            WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        owner_id IN (
            SELECT id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Deal owners can view activities on their deals
CREATE POLICY "Deal owners can view their deal activities"
    ON deal_activities FOR SELECT
    USING (
        deal_id IN (
            SELECT id FROM deals
            WHERE owner_id IN (
                SELECT id FROM users
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Deal owners can add activities to their deals
CREATE POLICY "Deal owners can add activities to their deals"
    ON deal_activities FOR INSERT
    WITH CHECK (
        deal_id IN (
            SELECT id FROM deals
            WHERE owner_id IN (
                SELECT id FROM users
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- =====================================================
-- STEP 4: Proposal read access for Org Admins
-- =====================================================
-- Org Admins can view proposals for their own organization.
-- This supports a future prospect portal where org admins
-- review proposals sent to them.

CREATE POLICY "Org admins can view their proposals"
    ON proposals FOR SELECT
    USING (
        organization_id IN (
            SELECT u.organization_id FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Admin'
        )
    );
