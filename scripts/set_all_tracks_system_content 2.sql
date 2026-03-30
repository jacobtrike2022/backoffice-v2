-- =====================================================
-- Set is_system_content = true for all tracks
-- =====================================================
-- Run this once in Supabase SQL Editor to mark all tracks as
-- "Trike content library templates" (available for all new orgs).
-- Scope (UNIVERSAL, STATE, etc.) is separate and unchanged.
-- =====================================================

-- Optional: see how many will be updated
-- SELECT count(*) FROM tracks;

UPDATE tracks
SET is_system_content = true,
    updated_at = NOW()
WHERE true;

-- Optional: verify (should match total track count)
-- SELECT count(*) FROM tracks WHERE is_system_content = true;
