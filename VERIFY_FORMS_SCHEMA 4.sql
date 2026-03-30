-- =====================================================
-- FORMS SCHEMA VERIFICATION SCRIPT
-- =====================================================
-- Run this in Supabase SQL Editor to verify migrations succeeded
-- =====================================================

-- TEST 1: Verify all 4 form tables exist
SELECT
  '✅ All form tables exist' AS test,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'form%'
ORDER BY table_name;
-- Expected: form_assignments, form_blocks, form_submissions, forms

-- TEST 2: Verify new columns on forms table
SELECT
  '✅ Forms table has new columns' AS test,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'forms'
  AND column_name IN ('created_by_id', 'type', 'category', 'requires_approval', 'allow_anonymous')
ORDER BY column_name;
-- Expected: All 5 columns listed

-- TEST 3: Verify old column was renamed
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forms' AND column_name = 'created_by')
    THEN '❌ FAILED: Old column "created_by" still exists'
    ELSE '✅ Column renamed: created_by → created_by_id'
  END AS test;

-- TEST 4: Verify form_submissions column renames
SELECT
  '✅ Form submissions column renames' AS test,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'form_submissions'
  AND column_name IN ('user_id', 'reviewed_by_id')
ORDER BY column_name;
-- Expected: user_id, reviewed_by_id

-- TEST 5: Check form_assignments table structure
SELECT
  '✅ Form assignments table structure' AS test,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'form_assignments'
ORDER BY ordinal_position;
-- Expected: id, organization_id, form_id, assignment_type, target_id, etc.

-- TEST 6: Verify indexes were created
SELECT
  '✅ Indexes created' AS test,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'form%'
  AND indexname LIKE 'idx_form%'
ORDER BY indexname;
-- Expected: Multiple indexes including idx_forms_org_status, idx_form_assignments_org, etc.

-- TEST 7: Check RLS policies
SELECT
  '✅ RLS policies' AS test,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename LIKE 'form%'
ORDER BY tablename, policyname;
-- Expected: Multiple policies for each table

-- TEST 8: Count existing data
SELECT
  '📊 Data counts' AS test,
  (SELECT COUNT(*) FROM forms) AS forms_count,
  (SELECT COUNT(*) FROM form_blocks) AS blocks_count,
  (SELECT COUNT(*) FROM form_submissions) AS submissions_count,
  (SELECT COUNT(*) FROM form_assignments) AS assignments_count;

-- =====================================================
-- SUMMARY CHECK
-- =====================================================
SELECT
  '🎯 FINAL SUMMARY' AS summary,
  CASE
    WHEN (
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'form_assignments')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forms' AND column_name = 'created_by_id')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forms' AND column_name = 'type')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forms' AND column_name = 'created_by')
    )
    THEN '✅ ALL MIGRATIONS SUCCESSFUL!'
    ELSE '❌ MIGRATION INCOMPLETE - Check individual tests above'
  END AS status;
