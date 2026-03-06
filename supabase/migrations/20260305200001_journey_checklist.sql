-- Journey Checklist Items
-- Dynamic checklist for prospect and onboarding phases
CREATE TABLE IF NOT EXISTS journey_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'prospect' CHECK (phase IN ('prospect', 'onboarding')),
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT DEFAULT 'task' CHECK (item_type IN (
    'task', 'resource', 'reviewer', 'follow_up', 'milestone', 'custom'
  )),
  sort_order INT DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  resource_url TEXT,
  resource_label TEXT,
  due_date DATE,
  reviewer_email TEXT,
  reviewer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_jcl_org ON journey_checklist_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_jcl_org_phase ON journey_checklist_items(organization_id, phase);

ALTER TABLE journey_checklist_items ENABLE ROW LEVEL SECURITY;

-- Org members can read their own checklist
DROP POLICY IF EXISTS "Org members can read checklist" ON journey_checklist_items;
CREATE POLICY "Org members can read checklist" ON journey_checklist_items
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

-- Trike super admins can manage all checklists
DROP POLICY IF EXISTS "Trike admins manage checklists" ON journey_checklist_items;
CREATE POLICY "Trike admins manage checklists" ON journey_checklist_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
    )
  );

-- Org admins can manage their own org's checklist
DROP POLICY IF EXISTS "Org admins manage own checklist" ON journey_checklist_items;
CREATE POLICY "Org admins manage own checklist" ON journey_checklist_items
  FOR ALL USING (
    organization_id = (
      SELECT u.organization_id FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid() AND r.name = 'Admin' LIMIT 1
    )
  );
