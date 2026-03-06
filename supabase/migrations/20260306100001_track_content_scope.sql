-- ============================================================================
-- Track Content Scope System
-- Adds content_scope column to tracks and a polymorphic junction table
-- for linking tracks to scope entities (sectors, industries, states, etc.)
-- Also restructures the industries table into a 2-level hierarchy.
-- ============================================================================

-- 1. Add content_scope to tracks
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS content_scope TEXT DEFAULT 'universal'
  CHECK (content_scope IN (
    'universal', 'sector', 'industry', 'state',
    'program', 'company', 'unit'
  ));

-- 2. Add level column to industries for sector/industry hierarchy
ALTER TABLE industries ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'industry'
  CHECK (level IN ('sector', 'industry'));

-- 3. Create track_scope_assignments table
CREATE TABLE IF NOT EXISTS track_scope_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN (
    'sector', 'industry', 'state', 'program', 'company', 'unit'
  )),
  scope_ref_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track_id, scope_type, scope_ref_id)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracks_content_scope ON tracks(content_scope);
CREATE INDEX IF NOT EXISTS idx_track_scope_assignments_track_id ON track_scope_assignments(track_id);
CREATE INDEX IF NOT EXISTS idx_track_scope_assignments_scope_type ON track_scope_assignments(scope_type);
CREATE INDEX IF NOT EXISTS idx_track_scope_assignments_scope_ref ON track_scope_assignments(scope_type, scope_ref_id);
CREATE INDEX IF NOT EXISTS idx_industries_level ON industries(level);
CREATE INDEX IF NOT EXISTS idx_industries_parent_id ON industries(parent_id);

-- 5. Insert sector parent rows and reparent existing industries
-- Food & Beverage sector (groups: Convenience Retail, QSR, FSR, Grocery)
INSERT INTO industries (id, slug, name, code, description, level, parent_id, sort_order, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'food_and_beverage',
  'Food & Beverage',
  'food_and_beverage',
  'Food service, convenience stores, restaurants, and grocery',
  'sector',
  NULL,
  1,
  true
) ON CONFLICT (slug) DO UPDATE SET level = 'sector', parent_id = NULL;

-- Hospitality & Lodging sector
INSERT INTO industries (id, slug, name, code, description, level, parent_id, sort_order, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'hospitality_and_lodging',
  'Hospitality & Lodging',
  'hospitality_and_lodging',
  'Hotels, resorts, casinos',
  'sector',
  NULL,
  2,
  true
) ON CONFLICT (slug) DO UPDATE SET level = 'sector', parent_id = NULL;

-- Retail & Distribution sector
INSERT INTO industries (id, slug, name, code, description, level, parent_id, sort_order, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'retail_and_distribution',
  'Retail & Distribution',
  'retail_and_distribution',
  'General retail, wholesale, distribution',
  'sector',
  NULL,
  3,
  true
) ON CONFLICT (slug) DO UPDATE SET level = 'sector', parent_id = NULL;

-- Healthcare & Manufacturing sector
INSERT INTO industries (id, slug, name, code, description, level, parent_id, sort_order, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000004',
  'healthcare_and_manufacturing',
  'Healthcare & Manufacturing',
  'healthcare_and_manufacturing',
  'Healthcare facilities and food manufacturing',
  'sector',
  NULL,
  4,
  true
) ON CONFLICT (slug) DO UPDATE SET level = 'sector', parent_id = NULL;

-- Reparent existing industries under sectors
-- Food & Beverage children
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000001', level = 'industry'
  WHERE slug = 'convenience_retail' AND parent_id IS NULL;
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000001', level = 'industry'
  WHERE slug = 'qsr' AND parent_id IS NULL;
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000001', level = 'industry'
  WHERE slug = 'fsr' AND parent_id IS NULL;
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000001', level = 'industry'
  WHERE slug = 'grocery' AND parent_id IS NULL;

-- Hospitality & Lodging children
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000002', level = 'industry'
  WHERE slug = 'hospitality' AND parent_id IS NULL;

-- Retail & Distribution children
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000003', level = 'industry'
  WHERE slug = 'retail' AND parent_id IS NULL;
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000003', level = 'industry'
  WHERE slug = 'wholesale_fuel' AND parent_id IS NULL;

-- Healthcare & Manufacturing children
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000004', level = 'industry'
  WHERE slug = 'healthcare' AND parent_id IS NULL;
UPDATE industries SET parent_id = 'a0000000-0000-0000-0000-000000000004', level = 'industry'
  WHERE slug = 'manufacturing' AND parent_id IS NULL;

-- 6. Migrate existing state: tags to track_scope_assignments
-- Find tracks with state:XX tags and create scope assignments
INSERT INTO track_scope_assignments (track_id, scope_type, scope_ref_id)
SELECT DISTINCT
  tt.track_id,
  'state',
  UPPER(REPLACE(t.name, 'state:', ''))
FROM track_tags tt
JOIN tags t ON tt.tag_id = t.id
WHERE t.name LIKE 'state:%'
ON CONFLICT (track_id, scope_type, scope_ref_id) DO NOTHING;

-- Also set content_scope = 'state' for tracks that had state tags
UPDATE tracks SET content_scope = 'state'
WHERE id IN (
  SELECT DISTINCT tt.track_id
  FROM track_tags tt
  JOIN tags t ON tt.tag_id = t.id
  WHERE t.name LIKE 'state:%'
) AND content_scope = 'universal';

-- 7. RLS Policies for track_scope_assignments
ALTER TABLE track_scope_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_users_read_scope_assignments" ON track_scope_assignments;
CREATE POLICY "authenticated_users_read_scope_assignments"
  ON track_scope_assignments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "org_admins_manage_scope_assignments" ON track_scope_assignments;
CREATE POLICY "org_admins_manage_scope_assignments"
  ON track_scope_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tracks tr
      JOIN users u ON u.organization_id = tr.organization_id
      JOIN roles r ON u.role_id = r.id
      WHERE tr.id = track_scope_assignments.track_id
        AND u.auth_user_id = auth.uid()
        AND r.name IN ('Admin', 'Trike Super Admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM tracks tr
      WHERE tr.id = track_scope_assignments.track_id
        AND tr.is_system_content = true
        AND EXISTS (
          SELECT 1 FROM users u2
          JOIN roles r2 ON u2.role_id = r2.id
          WHERE u2.auth_user_id = auth.uid()
            AND r2.name = 'Trike Super Admin'
        )
    )
  );
