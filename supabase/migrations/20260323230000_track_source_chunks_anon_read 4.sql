-- Demo mode uses anon access with no Supabase auth session.
-- Track generation creates track_source_chunks links, but the Sources editor and Article detail
-- fetch those links from PostgREST; without anon SELECT policy, links exist in DB but do not render.

DROP POLICY IF EXISTS "Demo mode: anon view track_source_chunks" ON track_source_chunks;
CREATE POLICY "Demo mode: anon view track_source_chunks"
  ON track_source_chunks
  FOR SELECT
  TO anon
  USING (true);
