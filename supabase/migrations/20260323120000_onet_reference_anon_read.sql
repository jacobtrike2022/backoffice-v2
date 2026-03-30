-- O*NET tables are public reference data (not org-specific). Demo mode uses the anon key;
-- search_onet_occupations can return rows while direct PostgREST reads were blocked by RLS-only-authenticated policies,
-- causing PGRST116 / 406 when loading profile details. Allow read-only SELECT for anon on these tables.

DROP POLICY IF EXISTS "Anon can read onet_occupations" ON onet_occupations;
CREATE POLICY "Anon can read onet_occupations"
  ON onet_occupations FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can read onet_tasks" ON onet_tasks;
CREATE POLICY "Anon can read onet_tasks"
  ON onet_tasks FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can read onet_skills" ON onet_skills;
CREATE POLICY "Anon can read onet_skills"
  ON onet_skills FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can read onet_occupation_skills" ON onet_occupation_skills;
CREATE POLICY "Anon can read onet_occupation_skills"
  ON onet_occupation_skills FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can read onet_knowledge" ON onet_knowledge;
CREATE POLICY "Anon can read onet_knowledge"
  ON onet_knowledge FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can read onet_occupation_knowledge" ON onet_occupation_knowledge;
CREATE POLICY "Anon can read onet_occupation_knowledge"
  ON onet_occupation_knowledge FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon can read onet_work_context" ON onet_work_context;
CREATE POLICY "Anon can read onet_work_context"
  ON onet_work_context FOR SELECT
  TO anon
  USING (true);
