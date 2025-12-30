-- Add role ability customizations table and supporting function

-- Customizations table
CREATE TABLE IF NOT EXISTS role_ability_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  ability_id VARCHAR(20),
  action TEXT NOT NULL CHECK (action IN ('exclude', 'modify', 'add')),
  custom_name TEXT,
  custom_importance DECIMAL(5,2),
  custom_level DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, ability_id)
);

CREATE INDEX IF NOT EXISTS idx_role_ability_customizations_role ON role_ability_customizations(role_id);

-- RLS policies
ALTER TABLE role_ability_customizations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view role ability customizations for their org'
      AND tablename = 'role_ability_customizations'
  ) THEN
    CREATE POLICY "Users can view role ability customizations for their org"
      ON role_ability_customizations FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM roles r 
        WHERE r.id = role_ability_customizations.role_id
        AND r.organization_id = get_user_organization_id()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can manage role ability customizations for their org'
      AND tablename = 'role_ability_customizations'
  ) THEN
    CREATE POLICY "Users can manage role ability customizations for their org"
      ON role_ability_customizations FOR ALL
      USING (EXISTS (
        SELECT 1 FROM roles r 
        WHERE r.id = role_ability_customizations.role_id
        AND r.organization_id = get_user_organization_id()
      ));
  END IF;
END $$;

-- Function to return merged abilities for a role (standard + customizations)
CREATE OR REPLACE FUNCTION get_role_abilities(p_role_id uuid)
RETURNS TABLE(
  ability_id text,
  name text,
  importance numeric,
  level numeric,
  category text,
  source text,
  is_active boolean,
  customization_id text,
  notes text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_onet_code VARCHAR(10);
  v_org_id UUID;
BEGIN
  -- Get role's O*NET code and org_id
  SELECT r.onet_code, r.organization_id INTO v_onet_code, v_org_id
  FROM roles r WHERE r.id = p_role_id;
  
  IF v_onet_code IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    a.ability_id::text,
    a.name,
    oa.importance,
    oa.level,
    a.category,
    CASE 
      WHEN rac.id IS NOT NULL AND rac.action = 'modify' THEN 'modified'
      WHEN rac.id IS NOT NULL AND rac.action = 'exclude' THEN 'excluded'
      ELSE 'standard'
    END::text as source,
    CASE 
      WHEN rac.action = 'exclude' THEN false
      ELSE true
    END as is_active,
    rac.id::text as customization_id,
    rac.notes
  FROM onet_abilities a
  JOIN onet_occupation_abilities oa ON oa.ability_id = a.ability_id
  LEFT JOIN role_ability_customizations rac ON rac.role_id = p_role_id 
    AND rac.ability_id = a.ability_id
  WHERE oa.onet_code = v_onet_code
  
  UNION ALL
  
  -- Custom abilities added by organization
  SELECT 
    rac.ability_id::text,
    rac.custom_name as name,
    rac.custom_importance as importance,
    rac.custom_level as level,
    'Custom'::text as category,
    'custom'::text as source,
    true as is_active,
    rac.id::text as customization_id,
    rac.notes
  FROM role_ability_customizations rac
  WHERE rac.role_id = p_role_id 
    AND rac.action = 'add'
  
  ORDER BY importance DESC NULLS LAST, name;
END;
$$;

