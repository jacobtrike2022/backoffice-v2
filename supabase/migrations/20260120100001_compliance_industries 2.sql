-- =====================================================
-- INDUSTRY TAXONOMY FOR COMPLIANCE MATCHING
-- =====================================================

-- Add missing columns to existing industries table
ALTER TABLE industries ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE industries ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES industries(id);
ALTER TABLE industries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE industries ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add unique constraint on code if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'industries_code_key'
  ) THEN
    ALTER TABLE industries ADD CONSTRAINT industries_code_key UNIQUE (code);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Constraint might already exist or have a different name
  NULL;
END $$;

-- Update existing industries with codes if they don't have them
UPDATE industries SET code = LOWER(REPLACE(name, ' ', '_')) WHERE code IS NULL;

-- Seed core industries (using ON CONFLICT on code)
INSERT INTO industries (name, code, description, sort_order) VALUES
  ('Convenience Stores', 'cstore', 'Gas stations, convenience stores, travel centers', 1),
  ('Quick Service Restaurants', 'qsr', 'Fast food, fast casual dining', 2),
  ('Full Service Restaurants', 'fsr', 'Casual dining, fine dining', 3),
  ('Grocery', 'grocery', 'Supermarkets, grocery stores', 4),
  ('Hospitality', 'hospitality', 'Hotels, resorts, casinos', 5),
  ('Retail', 'retail', 'General retail, department stores', 6),
  ('Healthcare', 'healthcare', 'Hospitals, clinics, long-term care', 7),
  ('Manufacturing', 'manufacturing', 'Food processing, production facilities', 8)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Industry → Requirement mapping
CREATE TABLE IF NOT EXISTS industry_compliance_requirements (
  industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (industry_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_industry_compliance_industry ON industry_compliance_requirements(industry_id);
CREATE INDEX IF NOT EXISTS idx_industry_compliance_req ON industry_compliance_requirements(requirement_id);

-- Add industry to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS industry_id UUID REFERENCES industries(id);

CREATE INDEX IF NOT EXISTS idx_organizations_industry ON organizations(industry_id);

-- RLS
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_compliance_requirements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view industries" ON industries;
DROP POLICY IF EXISTS "Anyone can view industry requirements" ON industry_compliance_requirements;
DROP POLICY IF EXISTS "Trike admins can manage industries" ON industries;
DROP POLICY IF EXISTS "Trike admins can manage industry requirements" ON industry_compliance_requirements;

CREATE POLICY "Anyone can view industries" ON industries FOR SELECT USING (true);
CREATE POLICY "Anyone can view industry requirements" ON industry_compliance_requirements FOR SELECT USING (true);

CREATE POLICY "Trike admins can manage industries" ON industries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
  ));

CREATE POLICY "Trike admins can manage industry requirements" ON industry_compliance_requirements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
  ));

-- Triggers
DROP TRIGGER IF EXISTS update_industries_updated_at ON industries;
CREATE TRIGGER update_industries_updated_at
  BEFORE UPDATE ON industries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
