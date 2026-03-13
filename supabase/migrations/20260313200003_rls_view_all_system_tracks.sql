-- =====================================================
-- RLS: Allow authenticated users to view ALL system tracks
-- =====================================================
-- Content Management (Trike Admin > Content Management) shows all published
-- system tracks. The UI role is set by dropdown + password, but the DB user
-- may still be Admin. Without this policy, RLS only allows org-scoped rows,
-- so only 3 tracks (that org's system tracks) appear.
-- This policy lets any logged-in user SELECT tracks where is_system_content = true,
-- so when the app queries without org filter (Super Admin view), all 161+ show.
-- Normal Content Library still filters by org in the query, so no change there.
-- =====================================================

CREATE POLICY "Authenticated users can view all system tracks"
  ON tracks FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_system_content = true);
