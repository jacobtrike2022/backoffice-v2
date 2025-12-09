-- =====================================================
-- HELPER FUNCTION: Check if user is admin (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  -- Disable RLS for this function to prevent recursion
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name IN ('Admin', 'Trike Super Admin')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_user_district_manager_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  -- Disable RLS for this function to prevent recursion
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name IN ('Admin', 'District Manager', 'Trike Super Admin')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX ROLES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view roles in their organization" ON roles;
CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage roles in their organization" ON roles;
CREATE POLICY "Admins can manage roles in their organization"
  ON roles FOR ALL
  USING (
    is_user_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- FIX DISTRICTS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view districts in their organization" ON districts;
CREATE POLICY "Users can view districts in their organization"
  ON districts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and District Managers can manage districts" ON districts;
CREATE POLICY "Admins and District Managers can manage districts"
  ON districts FOR ALL
  USING (
    is_user_district_manager_or_admin() AND
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- FIX STORES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view stores in their organization" ON stores;
CREATE POLICY "Users can view stores in their organization"
  ON stores FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all stores in their organization" ON stores;
CREATE POLICY "Admins can manage all stores in their organization"
  ON stores FOR ALL
  USING (
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
    )
  );

DROP POLICY IF EXISTS "Store Managers can update their own store" ON stores;
CREATE POLICY "Store Managers can update their own store"
  ON stores FOR UPDATE
  USING (
    manager_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- =====================================================
-- DONE!
-- =====================================================
-- The policies now use SECURITY DEFINER functions
-- that bypass RLS to check roles (prevents recursion)
-- =====================================================