-- =====================================================
-- FIX TRACK_TAGS RLS POLICY FOR DEMO MODE
-- =====================================================
-- Allow track_tags to be viewable in demo mode (no auth)
-- This enables tags to show on tracks in the demo environment
-- =====================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS track_tags_select_policy ON track_tags;

-- Create a new policy that allows:
-- 1. Authenticated users to view track_tags for tracks in their organization
-- 2. Demo mode: Allow viewing track_tags for tracks in the default demo organization
--    (organization_id = '10000000-0000-0000-0000-000000000001')
CREATE POLICY track_tags_select_policy ON track_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tracks t
      WHERE t.id = track_tags.track_id
      AND (
        -- Authenticated users: tracks in their org
        (auth.uid() IS NOT NULL AND t.organization_id IN (
          SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        ))
        OR
        -- Demo mode: default demo organization (when no auth)
        (auth.uid() IS NULL AND t.organization_id = '10000000-0000-0000-0000-000000000001')
        OR
        -- Public tracks (organization_id IS NULL)
        t.organization_id IS NULL
      )
    )
  );

-- =====================================================
-- DONE!
-- =====================================================
-- Tags will now be visible on tracks in demo mode
-- Authenticated users still see only their org's tags
-- =====================================================
