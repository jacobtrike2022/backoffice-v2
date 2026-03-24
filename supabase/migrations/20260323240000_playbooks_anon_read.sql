-- Demo mode has no authenticated session. Playbook build view reads playbooks via PostgREST
-- after analyze-source creates them; without anon SELECT on playbook tables, UI gets 406/PGRST116.

DROP POLICY IF EXISTS "Demo mode: anon view playbooks" ON playbooks;
CREATE POLICY "Demo mode: anon view playbooks"
  ON playbooks
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Demo mode: anon view playbook_tracks" ON playbook_tracks;
CREATE POLICY "Demo mode: anon view playbook_tracks"
  ON playbook_tracks
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Demo mode: anon view playbook_track_chunks" ON playbook_track_chunks;
CREATE POLICY "Demo mode: anon view playbook_track_chunks"
  ON playbook_track_chunks
  FOR SELECT
  TO anon
  USING (true);
