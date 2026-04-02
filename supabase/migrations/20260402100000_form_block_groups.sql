-- Form Block Groups: reusable block templates with relative conditional logic
-- Org-scoped so groups can be reused across multiple forms within an organization.

CREATE TABLE IF NOT EXISTS form_block_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  block_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS form_block_groups_org_idx
  ON form_block_groups(organization_id);

ALTER TABLE form_block_groups ENABLE ROW LEVEL SECURITY;

-- Open policy for now (matches other form tables in this project)
DROP POLICY IF EXISTS "form_block_groups_org_access" ON form_block_groups;
CREATE POLICY "form_block_groups_org_access" ON form_block_groups
  FOR ALL USING (true) WITH CHECK (true);
