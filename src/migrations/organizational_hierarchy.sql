-- =====================================================
-- ORGANIZATIONAL HIERARCHY MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================
-- Creates the foundational tables for multi-location organizations:
-- roles, districts, stores
-- =====================================================

-- =====================================================
-- 1. ROLES TABLE
-- =====================================================
-- Defines job roles within an organization (Store Manager, Sales Associate, etc.)

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER CHECK (level BETWEEN 1 AND 5) DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique role names per organization
  UNIQUE(organization_id, name)
);

-- Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add status column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='status') THEN
    ALTER TABLE roles ADD COLUMN status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active';
  END IF;
  
  -- Add permissions_json column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='permissions_json') THEN
    ALTER TABLE roles ADD COLUMN permissions_json JSONB DEFAULT '{}';
  END IF;
  
  -- Add description column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='description') THEN
    ALTER TABLE roles ADD COLUMN description TEXT;
  END IF;
  
  -- Add level column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='level') THEN
    ALTER TABLE roles ADD COLUMN level INTEGER CHECK (level BETWEEN 1 AND 5) DEFAULT 3;
  END IF;
END $$;

-- Indexes for performance (only create if status column exists)
CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(organization_id, status);
  END IF;
END $$;

-- RLS Policies
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view roles in their organization" ON roles;
CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage roles in their organization" ON roles;
CREATE POLICY "Admins can manage roles in their organization"
  ON roles FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

-- =====================================================
-- 2. DISTRICTS TABLE
-- =====================================================
-- Regional groupings of stores (e.g., "Northeast District")

CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique district names/codes per organization
  UNIQUE(organization_id, name),
  UNIQUE(organization_id, code)
);

-- Add status column if it doesn't exist (handles existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='districts' AND column_name='status') THEN
    ALTER TABLE districts ADD COLUMN status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active';
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_districts_org ON districts(organization_id);
CREATE INDEX IF NOT EXISTS idx_districts_manager ON districts(manager_id);

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='districts' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_districts_active ON districts(organization_id, status);
  END IF;
END $$;

-- RLS Policies
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view districts in their organization" ON districts;
CREATE POLICY "Users can view districts in their organization"
  ON districts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and District Managers can manage districts" ON districts;
CREATE POLICY "Admins and District Managers can manage districts"
  ON districts FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'District Manager', 'Trike Super Admin')
    )
  );

-- =====================================================
-- 3. STORES TABLE (may already exist - add missing columns)
-- =====================================================
-- Individual store locations

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique store names/codes per organization
  UNIQUE(organization_id, name),
  UNIQUE(organization_id, code)
);

-- Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add district_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stores' AND column_name='district_id') THEN
    ALTER TABLE stores ADD COLUMN district_id UUID REFERENCES districts(id) ON DELETE SET NULL;
  END IF;
  
  -- Add manager_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stores' AND column_name='manager_id') THEN
    ALTER TABLE stores ADD COLUMN manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  -- Add timezone if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stores' AND column_name='timezone') THEN
    ALTER TABLE stores ADD COLUMN timezone TEXT DEFAULT 'America/New_York';
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_org ON stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_stores_district ON stores(district_id);
CREATE INDEX IF NOT EXISTS idx_stores_manager ON stores(manager_id);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(organization_id, is_active);

-- RLS Policies
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view stores in their organization" ON stores;
CREATE POLICY "Users can view stores in their organization"
  ON stores FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all stores in their organization" ON stores;
CREATE POLICY "Admins can manage all stores in their organization"
  ON stores FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

DROP POLICY IF EXISTS "District Managers can manage stores in their district" ON stores;
CREATE POLICY "District Managers can manage stores in their district"
  ON stores FOR ALL
  USING (
    district_id IN (
      SELECT id FROM districts 
      WHERE manager_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Store Managers can update their own store" ON stores;
CREATE POLICY "Store Managers can update their own store"
  ON stores FOR UPDATE
  USING (
    manager_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- =====================================================
-- 4. UPDATE TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_districts_updated_at ON districts;
CREATE TRIGGER update_districts_updated_at
    BEFORE UPDATE ON districts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. SEED DEFAULT ROLES
-- =====================================================
-- Insert default roles for Demo Company organization

INSERT INTO roles (organization_id, name, description, level, permissions_json) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Trike Super Admin', 'Full system access across all organizations', 5, '{"all": true}'),
  ('10000000-0000-0000-0000-000000000001', 'Admin', 'Full access to organization settings and content', 5, '{"manage_users": true, "manage_content": true, "view_analytics": true}'),
  ('10000000-0000-0000-0000-000000000001', 'District Manager', 'Manages multiple stores in a district', 4, '{"manage_stores": true, "view_analytics": true, "assign_content": true}'),
  ('10000000-0000-0000-0000-000000000001', 'Store Manager', 'Manages a single store location', 3, '{"manage_team": true, "assign_content": true, "view_reports": true}'),
  ('10000000-0000-0000-0000-000000000001', 'Assistant Manager', 'Assists with store operations', 2, '{"view_reports": true, "complete_training": true}'),
  ('10000000-0000-0000-0000-000000000001', 'Sales Associate', 'Frontline sales team member', 1, '{"complete_training": true}')
ON CONFLICT (organization_id, name) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after migration to verify:
-- SELECT * FROM roles;
-- SELECT * FROM districts;
-- SELECT * FROM stores;
-- =====================================================