-- =====================================================
-- KNOWLEDGE BASE QR CODE GENERATION MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. ADD COLUMNS TO TRACKS TABLE
-- =====================================================

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS kb_slug TEXT UNIQUE;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS kb_qr_enabled BOOLEAN DEFAULT false;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS kb_qr_location TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS kb_qr_downloaded_count INTEGER DEFAULT 0;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_tracks_kb_slug ON tracks(kb_slug);

-- Create index for finding QR-enabled tracks
CREATE INDEX IF NOT EXISTS idx_tracks_kb_qr_enabled ON tracks(kb_qr_enabled) WHERE kb_qr_enabled = true;

-- 2. ADD COLUMNS TO ORGANIZATIONS TABLE
-- =====================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kb_privacy_mode TEXT DEFAULT 'public' CHECK (kb_privacy_mode IN ('public', 'password', 'employee_login'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kb_shared_password TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kb_logo_url TEXT;

-- 3. OPTIONAL: PAGE VIEW TRACKING (For Phase 2 Analytics)
-- =====================================================

CREATE TABLE IF NOT EXISTS kb_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id TEXT NOT NULL, -- String ID from tracks table
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  referrer TEXT CHECK (referrer IN ('qr_scan', 'direct_link', 'internal_nav')),
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_kb_page_views_track ON kb_page_views(track_id);
CREATE INDEX IF NOT EXISTS idx_kb_page_views_viewed_at ON kb_page_views(viewed_at DESC);

-- 4. HELPER FUNCTION: Get QR-enabled tracks for an organization
-- =====================================================

CREATE OR REPLACE FUNCTION get_org_qr_enabled_tracks(org_id TEXT)
RETURNS TABLE (
  track_id TEXT,
  title TEXT,
  kb_slug TEXT,
  kb_qr_location TEXT,
  kb_qr_downloaded_count INTEGER,
  status TEXT,
  show_in_knowledge_base BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.kb_slug,
    t.kb_qr_location,
    t.kb_qr_downloaded_count,
    t.status,
    t.show_in_knowledge_base
  FROM tracks t
  WHERE t.organization_id = org_id
    AND t.kb_qr_enabled = true
  ORDER BY t.title;
END;
$$ LANGUAGE plpgsql;

-- 5. VERIFICATION QUERIES
-- =====================================================

-- Check if new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tracks'
  AND column_name IN ('kb_slug', 'kb_qr_enabled', 'kb_qr_location', 'kb_qr_downloaded_count')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name IN ('kb_privacy_mode', 'kb_shared_password', 'kb_logo_url')
ORDER BY column_name;

-- Count QR-enabled tracks
SELECT COUNT(*) as qr_enabled_tracks
FROM tracks
WHERE kb_qr_enabled = true;

-- =====================================================
-- ROLLBACK (IF NEEDED)
-- =====================================================

-- UNCOMMENT TO ROLLBACK:
/*
ALTER TABLE tracks DROP COLUMN IF EXISTS kb_slug;
ALTER TABLE tracks DROP COLUMN IF EXISTS kb_qr_enabled;
ALTER TABLE tracks DROP COLUMN IF EXISTS kb_qr_location;
ALTER TABLE tracks DROP COLUMN IF EXISTS kb_qr_downloaded_count;

ALTER TABLE organizations DROP COLUMN IF EXISTS kb_privacy_mode;
ALTER TABLE organizations DROP COLUMN IF EXISTS kb_shared_password;
ALTER TABLE organizations DROP COLUMN IF EXISTS kb_logo_url;

DROP INDEX IF EXISTS idx_tracks_kb_slug;
DROP INDEX IF EXISTS idx_tracks_kb_qr_enabled;
DROP INDEX IF EXISTS idx_kb_page_views_track;
DROP INDEX IF EXISTS idx_kb_page_views_viewed_at;

DROP TABLE IF EXISTS kb_page_views;
DROP FUNCTION IF EXISTS get_org_qr_enabled_tracks(TEXT);
*/

-- =====================================================
-- SAMPLE DATA (For Testing)
-- =====================================================

-- Example: Enable QR for a test track
/*
UPDATE tracks
SET 
  kb_slug = 'coffee-machine-cleaning-a8x9c',
  kb_qr_enabled = true,
  kb_qr_location = 'Break Room'
WHERE id = 'your-track-id-here';
*/

-- Example: Set organization KB settings
/*
UPDATE organizations
SET 
  kb_privacy_mode = 'public',
  kb_logo_url = 'https://example.com/logo.png'
WHERE id = 'your-org-id-here';
*/

-- =====================================================
-- END OF MIGRATION
-- =====================================================
