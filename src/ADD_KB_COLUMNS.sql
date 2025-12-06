-- =====================================================
-- ADD KB COLUMNS TO ORGANIZATIONS TABLE
-- =====================================================
-- Run this in your Supabase SQL Editor to add the missing columns
-- This will allow the KB QR code functionality to work properly
-- =====================================================

-- Add KB columns if they don't exist
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS kb_privacy_mode TEXT DEFAULT 'public' CHECK (kb_privacy_mode IN ('public', 'password', 'employee_login'));

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS kb_shared_password TEXT;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS kb_logo_url TEXT;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS kb_logo_dark TEXT;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS kb_logo_light TEXT;

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name LIKE 'kb_%'
ORDER BY column_name;

-- Set default values for existing organization
UPDATE organizations
SET 
  kb_privacy_mode = COALESCE(kb_privacy_mode, 'public'),
  kb_shared_password = NULL,
  kb_logo_url = NULL,
  kb_logo_dark = NULL,
  kb_logo_light = NULL
WHERE id = '10000000-0000-0000-0000-000000000001';

-- Verify the update
SELECT id, name, kb_privacy_mode, kb_shared_password, kb_logo_url
FROM organizations
WHERE id = '10000000-0000-0000-0000-000000000001';

-- Success message
SELECT '✅ KB columns added successfully! The QR code viewer should now work.' AS status;
