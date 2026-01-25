-- =====================================================
-- FIX COMPLIANCE RLS FOR DEMO MODE
-- =====================================================
-- Adds policies to allow operations when auth.uid() IS NULL (demo mode)
-- In production with DEMO_MODE=false, these policies won't match
-- because auth.uid() will return a real user ID
-- =====================================================

-- compliance_topics - allow demo mode access
CREATE POLICY "Demo mode access for compliance topics"
  ON compliance_topics FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- compliance_authorities - allow demo mode access
CREATE POLICY "Demo mode access for compliance authorities"
  ON compliance_authorities FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- compliance_requirements - allow demo mode access
CREATE POLICY "Demo mode access for compliance requirements"
  ON compliance_requirements FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);
