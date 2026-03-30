-- =====================================================
-- FIX TRACK_TAGS INSERT & DELETE RLS POLICIES
-- =====================================================
-- The INSERT and DELETE policies only allow operations when
-- track.organization_id matches the user's org. This fails
-- for tracks with NULL organization_id (public/global tracks).
--
-- The SELECT policy was already fixed to handle NULL org IDs
-- and demo mode, but INSERT and DELETE were never updated.
--
-- This migration aligns INSERT/DELETE with SELECT policy logic.
-- =====================================================

-- Fix INSERT policy
DROP POLICY IF EXISTS track_tags_insert_policy ON track_tags;

CREATE POLICY track_tags_insert_policy ON track_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tracks t
      WHERE t.id = track_tags.track_id
      AND (
        -- Authenticated users: tracks in their org
        t.organization_id IN (
          SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
        OR
        -- Public/global tracks (organization_id IS NULL) - any authenticated user
        (auth.uid() IS NOT NULL AND t.organization_id IS NULL)
      )
    )
  );

-- Fix DELETE policy
DROP POLICY IF EXISTS track_tags_delete_policy ON track_tags;

CREATE POLICY track_tags_delete_policy ON track_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tracks t
      WHERE t.id = track_tags.track_id
      AND (
        -- Authenticated users: tracks in their org
        t.organization_id IN (
          SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
        OR
        -- Public/global tracks (organization_id IS NULL) - any authenticated user
        (auth.uid() IS NOT NULL AND t.organization_id IS NULL)
      )
    )
  );

-- =====================================================
-- DONE
-- =====================================================
-- INSERT and DELETE now match SELECT policy:
-- - Org-scoped tracks: only users in that org
-- - Public tracks (NULL org): any authenticated user
-- =====================================================
