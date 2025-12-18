-- =====================================================
-- KB PRIVACY REFACTOR & CENTRALIZED LOGO MANAGEMENT
-- Run this in Supabase SQL Editor
-- =====================================================

-- PART 1: Update CHECK constraint to allow 'pin' mode
-- =====================================================

-- Drop the old constraint
ALTER TABLE organizations 
DROP CONSTRAINT IF EXISTS organizations_kb_privacy_mode_check;

-- Add new constraint that includes 'pin'
ALTER TABLE organizations
ADD CONSTRAINT organizations_kb_privacy_mode_check 
CHECK (kb_privacy_mode IN ('public', 'password', 'employee_login', 'pin'));

-- PART 2: Add organization-wide logo columns
-- =====================================================

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_light_url TEXT;

-- PART 3: Add guest access control
-- =====================================================

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS kb_allow_guest_access BOOLEAN DEFAULT true;

-- PART 4: Update existing organizations to use 'pin' mode
-- =====================================================

-- Set all organizations to 'pin' mode by default
-- This is the new standard for KB access
UPDATE organizations 
SET kb_privacy_mode = 'pin' 
WHERE kb_privacy_mode IS NULL OR kb_privacy_mode = 'public';

-- PART 5: Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_organizations_kb_privacy_mode 
ON organizations(kb_privacy_mode);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name IN ('logo_dark_url', 'logo_light_url', 'kb_allow_guest_access')
ORDER BY column_name;

-- Check constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'organizations_kb_privacy_mode_check';

-- Check current privacy mode settings
SELECT 
  id,
  name,
  kb_privacy_mode,
  kb_allow_guest_access,
  logo_dark_url,
  logo_light_url
FROM organizations
ORDER BY name;

-- =====================================================
-- ROLLBACK (IF NEEDED)
-- =====================================================

-- UNCOMMENT TO ROLLBACK:
/*
-- Remove new columns
ALTER TABLE organizations DROP COLUMN IF EXISTS logo_dark_url;
ALTER TABLE organizations DROP COLUMN IF EXISTS logo_light_url;
ALTER TABLE organizations DROP COLUMN IF EXISTS kb_allow_guest_access;

-- Restore old constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_kb_privacy_mode_check;
ALTER TABLE organizations
ADD CONSTRAINT organizations_kb_privacy_mode_check 
CHECK (kb_privacy_mode IN ('public', 'password', 'employee_login'));

-- Restore old privacy mode values
UPDATE organizations 
SET kb_privacy_mode = 'public' 
WHERE kb_privacy_mode = 'pin';

-- Drop index
DROP INDEX IF EXISTS idx_organizations_kb_privacy_mode;
*/

-- =====================================================
-- NOTES
-- =====================================================

/*
OLD SYSTEM:
- kb_logo_dark (KB-specific, broken)
- kb_logo_light (KB-specific, broken)
- kb_privacy_mode: 'public' | 'password' | 'employee_login'

NEW SYSTEM:
- logo_dark_url (organization-wide)
- logo_light_url (organization-wide)
- kb_privacy_mode: 'pin' (simplified)
- kb_allow_guest_access: true (show guest button) | false (PIN only)

MIGRATION PATH:
1. Add 'pin' to CHECK constraint
2. Add new logo columns
3. Add guest access control
4. Update all orgs to 'pin' mode
5. Later: Can drop old kb_logo_* columns if desired
*/

-- =====================================================
-- END OF MIGRATION
-- =====================================================
