-- =====================================================
-- FIX RLS POLICIES FOR ROLE MERGE HISTORY
-- =====================================================
-- This migration fixes RLS policies for role_merge_history table
-- to allow the merge_roles function to insert merge records
-- =====================================================

-- Enable RLS on role_merge_history if not already enabled
ALTER TABLE IF EXISTS role_merge_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view merge history in their organization" ON role_merge_history;
DROP POLICY IF EXISTS "Users can insert merge history in their organization" ON role_merge_history;
DROP POLICY IF EXISTS "Admins can insert merge history" ON role_merge_history;
DROP POLICY IF EXISTS "Service role can insert merge history" ON role_merge_history;

-- Policy: Users can view merge history for their organization
CREATE POLICY "Users can view merge history in their organization"
  ON role_merge_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Allow inserts for authenticated users in the same organization
-- This allows the merge_roles function to insert records when called by authenticated users
CREATE POLICY "Users can insert merge history in their organization"
  ON role_merge_history FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- CHECK AND UPDATE merge_roles FUNCTION
-- =====================================================
-- The merge_roles function should use SECURITY DEFINER to bypass RLS
-- when inserting into role_merge_history. If it doesn't, we need to update it.
-- =====================================================

-- Check if function exists and uses SECURITY DEFINER
DO $$
DECLARE
  func_uses_security_definer BOOLEAN;
BEGIN
  SELECT prosecdef INTO func_uses_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'merge_roles';
  
  IF NOT FOUND THEN
    RAISE NOTICE 'merge_roles function not found. Please create it first.';
  ELSIF NOT func_uses_security_definer THEN
    RAISE NOTICE 'merge_roles function does not use SECURITY DEFINER. Consider updating it to use SECURITY DEFINER to bypass RLS.';
    RAISE NOTICE 'Example: ALTER FUNCTION merge_roles(...) SECURITY DEFINER;';
  ELSE
    RAISE NOTICE 'merge_roles function uses SECURITY DEFINER - RLS should be bypassed.';
  END IF;
END $$;

-- =====================================================
-- ALTERNATIVE FIX: If function doesn't use SECURITY DEFINER
-- =====================================================
-- If the function cannot be modified to use SECURITY DEFINER,
-- the RLS policies above should allow inserts from authenticated users.
-- However, if the function runs in a different security context,
-- you may need to temporarily disable RLS for the insert operation
-- within the function itself using: SET LOCAL row_security = off;
-- =====================================================

