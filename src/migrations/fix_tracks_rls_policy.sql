-- =====================================================
-- FIX TRACKS RLS POLICY - Allow Admins to Update Any Track
-- =====================================================
-- This fixes the issue where users cannot archive/update
-- tracks they didn't create, even if they're admins.
-- =====================================================

-- First, ensure the helper function exists (from fix_rls_policies.sql)
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
    AND r.name IN ('Admin', 'Trike Super Admin', 'administrator')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Content creators can update their tracks" ON tracks;

-- Create a new policy that allows:
-- 1. Content creators to update their own tracks
-- 2. Admins to update any track in their organization
CREATE POLICY "Content creators can update their tracks"
    ON tracks FOR UPDATE
    USING (
        organization_id = get_user_organization_id() 
        AND (
            created_by = auth.uid() 
            OR is_user_admin()
        )
    )
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- DONE!
-- =====================================================
-- Admins can now update/archive any track in their organization
-- Content creators can still update their own tracks
-- =====================================================

