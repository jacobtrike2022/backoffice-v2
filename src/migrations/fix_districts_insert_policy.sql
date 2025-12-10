-- =====================================================
-- FIX INSERT POLICIES - ADD WITH CHECK CLAUSES
-- This migration fixes RLS policies to allow INSERT operations
-- by adding the required WITH CHECK clause for all FOR ALL policies
-- =====================================================

-- =====================================================
-- FIX ROLES INSERT POLICY
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage roles in their organization" ON roles;

CREATE POLICY "Admins can manage roles in their organization"
  ON roles FOR ALL
  USING (
    is_user_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_user_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- FIX DISTRICTS INSERT POLICY
-- =====================================================

DROP POLICY IF EXISTS "Admins and District Managers can manage districts" ON districts;

CREATE POLICY "Admins and District Managers can manage districts"
  ON districts FOR ALL
  USING (
    is_user_district_manager_or_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_user_district_manager_or_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- FIX STORES INSERT POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage all stores in their organization" ON stores;

CREATE POLICY "Admins can manage all stores in their organization"
  ON stores FOR ALL
  USING (
    is_user_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_user_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "District Managers can manage stores in their district" ON stores;

CREATE POLICY "District Managers can manage stores in their district"
  ON stores FOR ALL
  USING (
    district_id IN (
      SELECT id FROM districts 
      WHERE manager_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ) OR
    is_user_admin()
  )
  WITH CHECK (
    district_id IN (
      SELECT id FROM districts 
      WHERE manager_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    ) OR
    is_user_admin()
  );

-- =====================================================
-- FIX TAGS INSERT POLICIES
-- Allow Store Managers and District Managers to create tags
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage tags" ON tags;

CREATE POLICY "Admins can manage tags"
  ON tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role_name IN ('Admin', 'Trike Super Admin', 'Store Manager', 'District Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role_name IN ('Admin', 'Trike Super Admin', 'Store Manager', 'District Manager')
    )
  );

-- =====================================================
-- FIX UNIT_TAGS INSERT POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage unit tags" ON unit_tags;

CREATE POLICY "Admins can manage unit tags"
  ON unit_tags FOR ALL
  USING (
    store_id IN (
      SELECT id FROM stores
      WHERE organization_id IN (
        SELECT organization_id FROM users
        WHERE auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores
      WHERE organization_id IN (
        SELECT organization_id FROM users
        WHERE auth_user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify all policies have been updated:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename IN ('districts', 'stores', 'roles', 'tags', 'unit_tags')
-- ORDER BY tablename, policyname;
