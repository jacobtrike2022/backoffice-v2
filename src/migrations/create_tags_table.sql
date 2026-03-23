-- Create tags table for categorizing units and content
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('unit', 'content', 'general')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique tag names per type
  UNIQUE(name, tag_type)
);

-- Create junction table for unit-tag relationships
CREATE TABLE IF NOT EXISTS unit_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique tag assignments per unit
  UNIQUE(store_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_unit_tags_store ON unit_tags(store_id);
CREATE INDEX IF NOT EXISTS idx_unit_tags_tag ON unit_tags(tag_id);

-- RLS Policies for tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tags" ON tags;
CREATE POLICY "Anyone can view tags"
  ON tags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage tags" ON tags;
CREATE POLICY "Admins can manage tags"
  ON tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

-- RLS Policies for unit_tags
ALTER TABLE unit_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view unit tags in their organization" ON unit_tags;
CREATE POLICY "Users can view unit tags in their organization"
  ON unit_tags FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores
      WHERE organization_id IN (
        SELECT organization_id FROM users
        WHERE auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage unit tags" ON unit_tags;
CREATE POLICY "Admins can manage unit tags"
  ON unit_tags FOR ALL
  USING (
    store_id IN (
      SELECT id FROM stores
      WHERE organization_id IN (
        SELECT u.organization_id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid()
        AND r.name IN ('Admin', 'Trike Super Admin')
      )
    )
  );
