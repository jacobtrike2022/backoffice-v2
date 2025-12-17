-- =====================================================
-- VERIFY TRACKS RLS POLICY WAS APPLIED CORRECTLY
-- =====================================================
-- Run this to confirm the policy exists and is correct
-- =====================================================

-- Check if the policy exists
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tracks'
  AND policyname = 'Content creators can update their tracks'
ORDER BY policyname;

-- Expected result:
-- Should show one policy with:
-- - cmd: UPDATE
-- - qual: (organization_id = get_user_organization_id() AND (created_by = auth.uid() OR is_user_admin()))
-- - with_check: (organization_id = get_user_organization_id())

