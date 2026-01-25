-- =====================================================
-- ADD MULTI-TOPIC SUPPORT FOR COMPLIANCE REQUIREMENTS
-- =====================================================
-- Creates a junction table to allow requirements to have multiple topics
-- The original topic_id column is kept for backwards compatibility
-- =====================================================

-- Create junction table for requirement-topic many-to-many relationship
CREATE TABLE IF NOT EXISTS requirement_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES compliance_topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(requirement_id, topic_id)
);

CREATE INDEX idx_requirement_topics_requirement ON requirement_topics(requirement_id);
CREATE INDEX idx_requirement_topics_topic ON requirement_topics(topic_id);

-- RLS policies
ALTER TABLE requirement_topics ENABLE ROW LEVEL SECURITY;

-- Anyone can view (same as compliance_requirements)
CREATE POLICY "Anyone can view requirement topics"
  ON requirement_topics FOR SELECT USING (true);

-- Demo mode access (when auth.uid() is null)
CREATE POLICY "Demo mode access for requirement topics"
  ON requirement_topics FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- Trike Super Admin can manage
CREATE POLICY "Trike admins can manage requirement topics"
  ON requirement_topics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name = 'Trike Super Admin'
    )
  );

-- Migrate existing topic_id data to junction table
INSERT INTO requirement_topics (requirement_id, topic_id)
SELECT id, topic_id FROM compliance_requirements
WHERE topic_id IS NOT NULL
ON CONFLICT DO NOTHING;
