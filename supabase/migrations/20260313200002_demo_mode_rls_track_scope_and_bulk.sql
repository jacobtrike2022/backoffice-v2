-- =====================================================
-- DEMO MODE RLS: Track scope + bulk admin (Content Management)
-- =====================================================
-- In demo mode there is no Supabase auth session (auth.uid() IS NULL).
-- Trike Super Admin and demo org viewers use the anon key. Ensure:
-- 1. Demo can list organizations (org dropdown in bulk "Assign to album")
-- 2. Demo can read/write album_tracks (assign tracks to album; Phase 2 remove)
-- 3. Demo can write track_scopes (single and bulk scope edits)
-- DROP IF EXISTS so migration is idempotent (safe re-run).
-- =====================================================

-- Organizations: anon can SELECT so SystemContentManager can show org dropdown
DROP POLICY IF EXISTS "Demo mode: anon view organizations" ON organizations;
CREATE POLICY "Demo mode: anon view organizations"
  ON organizations FOR SELECT
  USING (auth.uid() IS NULL);

-- Albums: anon can UPDATE so addTracksToAlbum can touch updated_at (anon already has SELECT)
DROP POLICY IF EXISTS "Demo mode: anon update albums" ON albums;
CREATE POLICY "Demo mode: anon update albums"
  ON albums FOR UPDATE
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- Album tracks: anon can SELECT (show memberships) and INSERT (bulk assign)
DROP POLICY IF EXISTS "Demo mode: anon view album_tracks" ON album_tracks;
CREATE POLICY "Demo mode: anon view album_tracks"
  ON album_tracks FOR SELECT
  USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon insert album_tracks" ON album_tracks;
CREATE POLICY "Demo mode: anon insert album_tracks"
  ON album_tracks FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- Allow anon to update/delete album_tracks (reorder, remove from album)
DROP POLICY IF EXISTS "Demo mode: anon update album_tracks" ON album_tracks;
CREATE POLICY "Demo mode: anon update album_tracks"
  ON album_tracks FOR UPDATE
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete album_tracks" ON album_tracks;
CREATE POLICY "Demo mode: anon delete album_tracks"
  ON album_tracks FOR DELETE
  USING (auth.uid() IS NULL);

-- Track scopes: anon can INSERT/UPDATE/DELETE (scope modal + bulk scope in demo)
-- SELECT already exists: "Demo mode: anon view track_scopes"
DROP POLICY IF EXISTS "Demo mode: anon insert track_scopes" ON track_scopes;
CREATE POLICY "Demo mode: anon insert track_scopes"
  ON track_scopes FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon update track_scopes" ON track_scopes;
CREATE POLICY "Demo mode: anon update track_scopes"
  ON track_scopes FOR UPDATE
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete track_scopes" ON track_scopes;
CREATE POLICY "Demo mode: anon delete track_scopes"
  ON track_scopes FOR DELETE
  USING (auth.uid() IS NULL);
