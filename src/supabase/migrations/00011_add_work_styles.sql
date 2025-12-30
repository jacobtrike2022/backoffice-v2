-- Work Styles customizations and merged RPC

CREATE TABLE IF NOT EXISTS role_work_style_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  work_style_id VARCHAR(20),
  action TEXT NOT NULL CHECK (action IN ('exclude', 'modify', 'add')),
  custom_name TEXT,
  custom_impact DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, work_style_id)
);

CREATE INDEX IF NOT EXISTS idx_role_work_style_customizations_role ON role_work_style_customizations(role_id);

ALTER TABLE role_work_style_customizations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view role work style customizations for their org'
      AND tablename = 'role_work_style_customizations'
  ) THEN
    CREATE POLICY "Users can view role work style customizations for their org"
      ON role_work_style_customizations FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM roles r 
        WHERE r.id = role_work_style_customizations.role_id
        AND r.organization_id = get_user_organization_id()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can manage role work style customizations for their org'
      AND tablename = 'role_work_style_customizations'
  ) THEN
    CREATE POLICY "Users can manage role work style customizations for their org"
      ON role_work_style_customizations FOR ALL
      USING (EXISTS (
        SELECT 1 FROM roles r 
        WHERE r.id = role_work_style_customizations.role_id
        AND r.organization_id = get_user_organization_id()
      ));
  END IF;
END $$;

-- Merged work styles (standard + customizations)
CREATE OR REPLACE FUNCTION get_role_work_styles(p_role_id uuid)
RETURNS TABLE(
  work_style_id text,
  name text,
  impact numeric,
  distinctiveness_rank integer,
  source text,
  is_active boolean,
  customization_id text,
  notes text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_onet_code VARCHAR(10);
BEGIN
  SELECT r.onet_code INTO v_onet_code
  FROM roles r WHERE r.id = p_role_id;
  
  IF v_onet_code IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    ws.work_style_id::text,
    ws.name::text,
    ows.impact,
    ows.distinctiveness_rank,
    CASE 
      WHEN rwsc.id IS NOT NULL AND rwsc.action = 'modify' THEN 'modified'
      WHEN rwsc.id IS NOT NULL AND rwsc.action = 'exclude' THEN 'excluded'
      ELSE 'standard'
    END::text as source,
    CASE 
      WHEN rwsc.action = 'exclude' THEN false
      ELSE true
    END as is_active,
    rwsc.id::text as customization_id,
    rwsc.notes::text
  FROM onet_work_styles ws
  JOIN onet_occupation_work_styles ows ON ows.work_style_id = ws.work_style_id
  LEFT JOIN role_work_style_customizations rwsc ON rwsc.role_id = p_role_id 
    AND rwsc.work_style_id = ws.work_style_id
  WHERE ows.onet_code = v_onet_code
  
  UNION ALL
  
  SELECT 
    rwsc.work_style_id::text,
    rwsc.custom_name::text as name,
    rwsc.custom_impact as impact,
    NULL::integer as distinctiveness_rank,
    'custom'::text as source,
    true as is_active,
    rwsc.id::text as customization_id,
    rwsc.notes::text
  FROM role_work_style_customizations rwsc
  WHERE rwsc.role_id = p_role_id 
    AND rwsc.action = 'add'
  
  ORDER BY impact DESC NULLS LAST, name;
END;
$$;

