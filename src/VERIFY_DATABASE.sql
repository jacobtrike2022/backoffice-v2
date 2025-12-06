-- =====================================================
-- VERIFY DATABASE STATE
-- =====================================================
-- Run this to check what's in your database
-- =====================================================

-- Check if organizations table exists and has the record
SELECT 
  id, 
  name, 
  subdomain,
  created_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'organizations' AND column_name = 'kb_privacy_mode'
    ) THEN '✅ KB columns exist'
    ELSE '❌ KB columns MISSING - Run ADD_KB_COLUMNS.sql'
  END as kb_columns_status
FROM organizations
WHERE id = '10000000-0000-0000-0000-000000000001';

-- Check if the track exists with the slug
SELECT 
  id,
  title,
  kb_slug,
  show_in_knowledge_base,
  status,
  organization_id,
  CASE 
    WHEN organization_id = '10000000-0000-0000-0000-000000000001' THEN '✅ Org ID matches'
    ELSE '❌ Org ID mismatch'
  END as org_check
FROM tracks
WHERE kb_slug = 'selling-alcohol-in-c-stores-K8qBZm';

-- List all KB columns if they exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name LIKE 'kb_%'
ORDER BY column_name;

-- If KB columns exist, show their values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'kb_privacy_mode'
  ) THEN
    RAISE NOTICE '✅ KB columns found! Showing values:';
  ELSE
    RAISE NOTICE '❌ KB columns NOT found! You need to run ADD_KB_COLUMNS.sql';
  END IF;
END $$;

-- Show KB column values if they exist (this might error if columns don't exist)
-- If you get an error, it means you need to run ADD_KB_COLUMNS.sql
SELECT 
  id,
  name,
  kb_privacy_mode,
  kb_shared_password,
  kb_logo_url,
  kb_logo_dark,
  kb_logo_light
FROM organizations
WHERE id = '10000000-0000-0000-0000-000000000001';
