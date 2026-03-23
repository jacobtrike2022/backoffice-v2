-- =====================================================
-- REPORTS: Demo mode + Trike Super Admin RLS
-- =====================================================
-- Fixes reports showing no data when:
-- 1. Trike Super Admin views a demo org (viewingOrgOverride)
--    - RLS uses get_user_organization_id() = Super Admin's org
--    - Query filters by demo org → 0 rows
-- 2. Relay-created orgs: real stores (not is_seed) + seed people
--    - Same RLS block when Super Admin or anon views
--
-- Adds:
-- - Trike Super Admin SELECT policies for reports tables
-- - Anon demo policies for assignments, track_completions, etc.
-- =====================================================

-- Helper: Trike Super Admin check (SELECT only - read access for preview)
CREATE OR REPLACE FUNCTION is_trike_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name = 'Trike Super Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- TRIKE SUPER ADMIN: Can SELECT any org's data (for preview)
-- =====================================================
-- Use DROP IF EXISTS so migration is idempotent (safe re-run if partially applied).

-- Users
DROP POLICY IF EXISTS "Trike super admins can view all users for reports" ON users;
CREATE POLICY "Trike super admins can view all users for reports"
  ON users FOR SELECT
  USING (is_trike_super_admin());

-- Stores (Relay units - not is_seed)
DROP POLICY IF EXISTS "Trike super admins can view all stores for reports" ON stores;
CREATE POLICY "Trike super admins can view all stores for reports"
  ON stores FOR SELECT
  USING (is_trike_super_admin());

-- Districts
DROP POLICY IF EXISTS "Trike super admins can view all districts for reports" ON districts;
CREATE POLICY "Trike super admins can view all districts for reports"
  ON districts FOR SELECT
  USING (is_trike_super_admin());

-- Roles
DROP POLICY IF EXISTS "Trike super admins can view all roles for reports" ON roles;
CREATE POLICY "Trike super admins can view all roles for reports"
  ON roles FOR SELECT
  USING (is_trike_super_admin());

-- Assignments
DROP POLICY IF EXISTS "Trike super admins can view all assignments for reports" ON assignments;
CREATE POLICY "Trike super admins can view all assignments for reports"
  ON assignments FOR SELECT
  USING (is_trike_super_admin());

-- Playlists
DROP POLICY IF EXISTS "Trike super admins can view all playlists for reports" ON playlists;
CREATE POLICY "Trike super admins can view all playlists for reports"
  ON playlists FOR SELECT
  USING (is_trike_super_admin());

-- Playlist tracks
DROP POLICY IF EXISTS "Trike super admins can view all playlist_tracks for reports" ON playlist_tracks;
CREATE POLICY "Trike super admins can view all playlist_tracks for reports"
  ON playlist_tracks FOR SELECT
  USING (is_trike_super_admin());

-- Playlist albums
DROP POLICY IF EXISTS "Trike super admins can view all playlist_albums for reports" ON playlist_albums;
CREATE POLICY "Trike super admins can view all playlist_albums for reports"
  ON playlist_albums FOR SELECT
  USING (is_trike_super_admin());

-- Albums
DROP POLICY IF EXISTS "Trike super admins can view all albums for reports" ON albums;
CREATE POLICY "Trike super admins can view all albums for reports"
  ON albums FOR SELECT
  USING (is_trike_super_admin());

-- Tracks
DROP POLICY IF EXISTS "Trike super admins can view all tracks for reports" ON tracks;
CREATE POLICY "Trike super admins can view all tracks for reports"
  ON tracks FOR SELECT
  USING (is_trike_super_admin());

-- Track completions
DROP POLICY IF EXISTS "Trike super admins can view all track_completions for reports" ON track_completions;
CREATE POLICY "Trike super admins can view all track_completions for reports"
  ON track_completions FOR SELECT
  USING (is_trike_super_admin());

-- Certifications
DROP POLICY IF EXISTS "Trike super admins can view all certifications for reports" ON certifications;
CREATE POLICY "Trike super admins can view all certifications for reports"
  ON certifications FOR SELECT
  USING (is_trike_super_admin());

-- User certifications
DROP POLICY IF EXISTS "Trike super admins can view all user_certifications for reports" ON user_certifications;
CREATE POLICY "Trike super admins can view all user_certifications for reports"
  ON user_certifications FOR SELECT
  USING (is_trike_super_admin());

-- Organizations (for filter options / org lookup)
DROP POLICY IF EXISTS "Trike super admins can view all organizations for reports" ON organizations;
CREATE POLICY "Trike super admins can view all organizations for reports"
  ON organizations FOR SELECT
  USING (is_trike_super_admin());

-- =====================================================
-- DEMO MODE ANON: Assignments, track_completions, etc.
-- (users, stores, districts, roles already have anon in 20260305100002)
-- =====================================================

-- Assignments
DROP POLICY IF EXISTS "Demo mode: anon view assignments" ON assignments;
CREATE POLICY "Demo mode: anon view assignments"
  ON assignments FOR SELECT
  USING (auth.uid() IS NULL);

-- Track completions
DROP POLICY IF EXISTS "Demo mode: anon view track_completions" ON track_completions;
CREATE POLICY "Demo mode: anon view track_completions"
  ON track_completions FOR SELECT
  USING (auth.uid() IS NULL);

-- Playlists
DROP POLICY IF EXISTS "Demo mode: anon view playlists" ON playlists;
CREATE POLICY "Demo mode: anon view playlists"
  ON playlists FOR SELECT
  USING (auth.uid() IS NULL);

-- Playlist tracks
DROP POLICY IF EXISTS "Demo mode: anon view playlist_tracks" ON playlist_tracks;
CREATE POLICY "Demo mode: anon view playlist_tracks"
  ON playlist_tracks FOR SELECT
  USING (auth.uid() IS NULL);

-- Playlist albums
DROP POLICY IF EXISTS "Demo mode: anon view playlist_albums" ON playlist_albums;
CREATE POLICY "Demo mode: anon view playlist_albums"
  ON playlist_albums FOR SELECT
  USING (auth.uid() IS NULL);

-- Albums
DROP POLICY IF EXISTS "Demo mode: anon view albums" ON albums;
CREATE POLICY "Demo mode: anon view albums"
  ON albums FOR SELECT
  USING (auth.uid() IS NULL);

-- Tracks (may already have fix_track_tags_demo_access - add anon for reports)
DROP POLICY IF EXISTS "Demo mode: anon view tracks for reports" ON tracks;
CREATE POLICY "Demo mode: anon view tracks for reports"
  ON tracks FOR SELECT
  USING (auth.uid() IS NULL);

-- Certifications
DROP POLICY IF EXISTS "Demo mode: anon view certifications" ON certifications;
CREATE POLICY "Demo mode: anon view certifications"
  ON certifications FOR SELECT
  USING (auth.uid() IS NULL);

-- User certifications
DROP POLICY IF EXISTS "Demo mode: anon view user_certifications" ON user_certifications;
CREATE POLICY "Demo mode: anon view user_certifications"
  ON user_certifications FOR SELECT
  USING (auth.uid() IS NULL);
