-- =====================================================
-- STANDARD ROLE TYPES FOR REQUIREMENT MATCHING
-- =====================================================

CREATE TABLE IF NOT EXISTS standard_role_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed standard role types
INSERT INTO standard_role_types (name, description, sort_order) VALUES
  ('Frontline', 'Cashiers, sales associates, counter staff', 1),
  ('Food Service', 'Food handlers, cooks, food prep', 2),
  ('Shift Lead', 'Team leads, shift supervisors', 3),
  ('Assistant Manager', 'Assistant store/restaurant managers', 4),
  ('Store Manager', 'Store managers, general managers', 5),
  ('District Manager', 'Multi-unit managers, area managers', 6),
  ('Corporate', 'Corporate/HQ staff', 7),
  ('Delivery Driver', 'Delivery, logistics staff', 8),
  ('Maintenance', 'Facilities, maintenance staff', 9)
ON CONFLICT (name) DO NOTHING;

-- Add standard role type to roles
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS standard_role_type_id UUID REFERENCES standard_role_types(id);

CREATE INDEX idx_roles_standard_type ON roles(standard_role_type_id);

-- RLS
ALTER TABLE standard_role_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view standard role types" ON standard_role_types FOR SELECT USING (true);

CREATE POLICY "Trike admins can manage standard role types" ON standard_role_types FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
  ));
